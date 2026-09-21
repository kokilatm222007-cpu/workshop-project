"""
UniShield Model Training Pipeline
Trains:
1. Unidirectional Random Forest (baseline)
2. Unidirectional XGBoost (MAIN DEPLOYED MODEL -> exported as native JSON)
3. Bidirectional Random Forest (baseline comparison)
4. Bidirectional XGBoost (comparison)
5. Isolation Forest (unsupervised anomaly detection trained on BENIGN only)
"""
import sys
import json
import time
import shutil
from pathlib import Path
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.utils.class_weight import compute_sample_weight
import xgboost as xgb

# Add current directory to path
sys.path.append(str(Path(__file__).resolve().parent))
import config

def load_data():
    """Loads preprocessed train and test parquet files."""
    train_path = config.PROCESSED_DATA_DIR / "train.parquet"
    test_path = config.PROCESSED_DATA_DIR / "test.parquet"
    
    if not train_path.exists() or not test_path.exists():
        raise FileNotFoundError("Processed datasets not found. Run preprocess.py first.")
        
    print(f"Loading train data from {train_path}...")
    train_df = pd.read_parquet(train_path)
    print(f"Loading test data from {test_path}...")
    test_df = pd.read_parquet(test_path)
    
    return train_df, test_df

def prepare_features(df: pd.DataFrame, feature_cols: list):
    """Extracts features, ensuring all columns exist and fill NaNs with 0."""
    available_cols = [c for c in feature_cols if c in df.columns]
    missing = set(feature_cols) - set(available_cols)
    if missing:
        print(f"[WARN] Missing {len(missing)} features, filling with 0: {missing}")
        for c in missing:
            df[c] = 0.0
    return df[feature_cols].copy().fillna(0.0)

def main():
    print("=== UniShield Model Training Pipeline ===")
    config.MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    train_df, test_df = load_data()
    y_train = train_df["class_id"].values
    y_test = test_df["class_id"].values
    
    # 1. Unidirectional Features
    uni_features = config.FINAL_UNIDIRECTIONAL_FEATURES
    print(f"\nUnidirectional feature count: {len(uni_features)}")
    X_train_uni = prepare_features(train_df, uni_features)
    X_test_uni = prepare_features(test_df, uni_features)
    
    # 2. Bidirectional Features
    bi_features = config.FINAL_BIDIRECTIONAL_FEATURES
    print(f"Bidirectional feature count:  {len(bi_features)}")
    X_train_bi = prepare_features(train_df, bi_features)
    X_test_bi = prepare_features(test_df, bi_features)
    
    # Save feature definitions to models/ and functions/
    feature_metadata = {
        "unidirectional_features": uni_features,
        "bidirectional_features": bi_features,
        "class_names": config.CLASS_NAMES,
        "n_classes": len(config.CLASS_NAMES)
    }
    with open(config.MODELS_DIR / "features.json", "w") as f:
        json.dump(feature_metadata, f, indent=2)
    print(f"Saved feature metadata to {config.MODELS_DIR / 'features.json'}")
    
    # Calculate sample weights for XGBoost
    print("\nComputing class sample weights for XGBoost...")
    sample_weights = compute_sample_weight(class_weight="balanced", y=y_train)

    # ==========================================
    # MODEL 1: Unidirectional Random Forest (Baseline)
    # ==========================================
    print("\n[1/5] Training Unidirectional Random Forest (balanced)...")
    start_t = time.time()
    rf_uni = RandomForestClassifier(
        n_estimators=100,
        max_depth=16,
        class_weight="balanced",
        random_state=config.RANDOM_STATE,
        n_jobs=-1
    )
    rf_uni.fit(X_train_uni, y_train)
    print(f"  Trained in {time.time() - start_t:.2f}s")
    joblib.dump(rf_uni, config.MODELS_DIR / "rf_uni.joblib")

    # ==========================================
    # MODEL 2: Unidirectional XGBoost (MAIN DEPLOYED MODEL)
    # ==========================================
    print("\n[2/5] Training Unidirectional XGBoost (Main Model)...")
    start_t = time.time()
    xgb_uni = xgb.XGBClassifier(
        n_estimators=150,
        max_depth=6,
        learning_rate=0.1,
        objective="multi:softprob",
        num_class=5,
        random_state=config.RANDOM_STATE,
        n_jobs=-1,
        tree_method="hist"
    )
    xgb_uni.fit(X_train_uni, y_train, sample_weight=sample_weights)
    print(f"  Trained in {time.time() - start_t:.2f}s")
    
    # Save as native XGBoost JSON (zero sklearn dependency for Cloud Function)
    xgb_uni_json_path = config.MODELS_DIR / "xgb_uni.json"
    xgb_uni.save_model(str(xgb_uni_json_path))
    print(f"  Exported native JSON model to {xgb_uni_json_path}")
    
    # Also save joblib version
    joblib.dump(xgb_uni, config.MODELS_DIR / "xgb_uni.joblib")

    # ==========================================
    # MODEL 3: Bidirectional Random Forest
    # ==========================================
    print("\n[3/5] Training Bidirectional Random Forest (Comparison)...")
    start_t = time.time()
    rf_bi = RandomForestClassifier(
        n_estimators=100,
        max_depth=16,
        class_weight="balanced",
        random_state=config.RANDOM_STATE,
        n_jobs=-1
    )
    rf_bi.fit(X_train_bi, y_train)
    print(f"  Trained in {time.time() - start_t:.2f}s")
    joblib.dump(rf_bi, config.MODELS_DIR / "rf_bi.joblib")

    # ==========================================
    # MODEL 4: Bidirectional XGBoost
    # ==========================================
    print("\n[4/5] Training Bidirectional XGBoost (Comparison)...")
    start_t = time.time()
    xgb_bi = xgb.XGBClassifier(
        n_estimators=150,
        max_depth=6,
        learning_rate=0.1,
        objective="multi:softprob",
        num_class=5,
        random_state=config.RANDOM_STATE,
        n_jobs=-1,
        tree_method="hist"
    )
    xgb_bi.fit(X_train_bi, y_train, sample_weight=sample_weights)
    print(f"  Trained in {time.time() - start_t:.2f}s")
    xgb_bi.save_model(str(config.MODELS_DIR / "xgb_bi.json"))
    joblib.dump(xgb_bi, config.MODELS_DIR / "xgb_bi.joblib")

    # ==========================================
    # MODEL 5: Isolation Forest (Unsupervised on BENIGN)
    # ==========================================
    print("\n[5/5] Training Isolation Forest (Unsupervised on BENIGN only)...")
    start_t = time.time()
    benign_mask = (y_train == 0)
    X_train_benign_uni = X_train_uni[benign_mask]
    
    # Sample 20,000 benign flows for Isolation Forest training
    iso_samples = min(25000, len(X_train_benign_uni))
    X_iso_train = X_train_benign_uni.sample(n=iso_samples, random_state=config.RANDOM_STATE)
    
    iso_forest = IsolationForest(
        n_estimators=100,
        max_samples="auto",
        contamination=0.03,  # expected ~3% anomaly in clean data
        random_state=config.RANDOM_STATE,
        n_jobs=-1
    )
    iso_forest.fit(X_iso_train)
    print(f"  Trained on {iso_samples:,} BENIGN flows in {time.time() - start_t:.2f}s")
    joblib.dump(iso_forest, config.MODELS_DIR / "iso_forest.joblib")

    # Copy xgb_uni.json and features.json to functions/model/
    functions_model_dir = config.BASE_DIR.parent / "functions" / "model"
    functions_model_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(xgb_uni_json_path, functions_model_dir / "xgb_uni.json")
    shutil.copy2(config.MODELS_DIR / "features.json", functions_model_dir / "features.json")
    print(f"\nCopied xgb_uni.json and features.json to Cloud Function dir: {functions_model_dir}")

    # Standalone XGBoost verification
    print("\nVerifying standalone XGBoost loading (zero sklearn dependency)...")
    booster = xgb.Booster()
    booster.load_model(str(xgb_uni_json_path))
    dummy_input = np.zeros((1, len(uni_features)), dtype=np.float32)
    dmatrix = xgb.DMatrix(dummy_input, feature_names=uni_features)
    dummy_pred = booster.predict(dmatrix)
    print(f"  Standalone Booster output shape: {dummy_pred.shape}")
    print(f"  Standalone Booster predicted probabilities: {dummy_pred[0]}")
    print("Standalone XGBoost verification passed!\n")
    print("Model training pipeline completed successfully!")

if __name__ == "__main__":
    main()
