"""
UniShield Cloud Functions: predictFlows
Loads native XGBoost JSON model once at cold start and performs batch inference
on unidirectional network flows.
"""
import os
import json
import time
from pathlib import Path
import numpy as np
import xgboost as xgb
from firebase_functions import https_fn, options
import firebase_admin
from firebase_admin import firestore

# Initialize Firebase Admin
if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

# Cold-start global variables
MODEL = None
FEATURES = None
CLASS_NAMES = None

def get_model_and_features():
    """Loads XGBoost native JSON model and feature metadata once at cold start."""
    global MODEL, FEATURES, CLASS_NAMES
    if MODEL is None or FEATURES is None:
        model_dir = Path(__file__).resolve().parent / "model"
        model_path = model_dir / "xgb_uni.json"
        features_path = model_dir / "features.json"

        if not model_path.exists() or not features_path.exists():
            raise RuntimeError("Model or features metadata file missing in functions/model/")

        with open(features_path, "r") as f:
            meta = json.load(f)
            FEATURES = meta["unidirectional_features"]
            CLASS_NAMES = meta["class_names"]

        MODEL = xgb.Booster()
        MODEL.load_model(str(model_path))
        print(f"[UniShield] Loaded native XGBoost model with {len(FEATURES)} features.")

    return MODEL, FEATURES, CLASS_NAMES

@https_fn.on_call(
    memory=options.MemoryOption.GB_1,
    max_instances=3,
    region="us-central1"
)
def predictFlows(req: https_fn.CallableRequest) -> dict:
    """
    Callable Cloud Function to classify batch unidirectional IP traffic flows.
    Requires anonymous authentication.
    """
    # 1. Enforce Authentication
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Authentication required. Please sign in anonymously before requesting inference."
        )

    # 2. Validate Input Payload
    data = req.data
    if not isinstance(data, dict) or "rows" not in data:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Invalid payload. Expected object containing a 'rows' array."
        )

    rows = data.get("rows")
    if not isinstance(rows, list) or len(rows) == 0:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="'rows' must be a non-empty list of flow objects."
        )

    if len(rows) > 5000:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"Payload exceeds maximum limit of 5,000 flows per call (received {len(rows)})."
        )

    # 3. Load Model and Feature Order
    try:
        booster, expected_features, class_names = get_model_and_features()
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to load detection model: {str(e)}"
        )

    # 4. Feature Extraction & Validation
    n_rows = len(rows)
    n_feats = len(expected_features)
    matrix = np.zeros((n_rows, n_feats), dtype=np.float32)

    # Validate first row to catch missing required fields early
    first_row = rows[0]
    for feat in expected_features:
        # Check if base feature is missing (allow derived features to be computed)
        if feat not in first_row and feat not in ["fwd_bytes_per_packet", "fwd_pkt_rate"]:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message=f"Flow data is missing required feature: '{feat}'"
            )

    # Populate inference matrix
    for r_idx, row in enumerate(rows):
        total_fwd_len = float(row.get("Total Length of Fwd Packets", 0.0) or 0.0)
        total_fwd_pkts = float(row.get("Total Fwd Packets", 1.0) or 1.0)
        flow_duration = float(row.get("Flow Duration", 1.0) or 1.0)

        # Derived features
        fwd_bytes_per_pkt = total_fwd_len / (total_fwd_pkts + 1e-6)
        fwd_pkt_rate = total_fwd_pkts / ((flow_duration * 1e-6) + 1e-6)

        for f_idx, feat_name in enumerate(expected_features):
            if feat_name == "fwd_bytes_per_packet":
                matrix[r_idx, f_idx] = fwd_bytes_per_pkt
            elif feat_name == "fwd_pkt_rate":
                matrix[r_idx, f_idx] = fwd_pkt_rate
            else:
                val = row.get(feat_name, 0.0)
                try:
                    matrix[r_idx, f_idx] = float(val) if val is not None else 0.0
                except (ValueError, TypeError):
                    matrix[r_idx, f_idx] = 0.0

    # 5. Run Standalone Inference
    try:
        dmatrix = xgb.DMatrix(matrix, feature_names=expected_features)
        probabilities = booster.predict(dmatrix)
        pred_indices = np.argmax(probabilities, axis=1)
        confidences = np.max(probabilities, axis=1)
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Inference execution failed: {str(e)}"
        )

    # 6. Format Response
    predictions = []
    class_summary = {c: 0 for c in class_names}
    alerts_to_write = []
    now_ts = int(time.time())

    for idx in range(n_rows):
        c_id = int(pred_indices[idx])
        c_name = class_names[c_id]
        conf = round(float(confidences[idx]), 4)
        class_summary[c_name] += 1

        dest_port = int(rows[idx].get("Destination Port", 80) or 80)
        fwd_pkts = int(rows[idx].get("Total Fwd Packets", 1) or 1)
        duration = float(rows[idx].get("Flow Duration", 0) or 0)

        item = {
            "rowIndex": idx + 1,
            "predictedClass": c_name,
            "confidence": conf,
            "destinationPort": dest_port,
            "totalFwdPackets": fwd_pkts
        }
        predictions.append(item)

        # Write at most 50 alerts for high-confidence threats (confidence >= 0.70)
        if c_name != "BENIGN" and conf >= 0.70 and len(alerts_to_write) < 50:
            alerts_to_write.append({
                "timestamp": now_ts,
                "predictedClass": c_name,
                "confidence": conf,
                "destinationPort": dest_port,
                "totalFwdPackets": fwd_pkts,
                "flowDuration": duration,
                "source": "upload"
            })

    # Batch write alerts to Firestore (Admin SDK)
    if alerts_to_write:
        try:
            batch = db.batch()
            for a in alerts_to_write:
                ref = db.collection("alerts").document()
                batch.set(ref, a)
            batch.commit()
            print(f"[UniShield] Logged {len(alerts_to_write)} alerts from upload.")
        except Exception as e:
            print(f"[WARN] Failed to write upload alerts to Firestore: {e}")

    return {
        "success": True,
        "totalRows": n_rows,
        "summary": class_summary,
        "predictions": predictions
    }
