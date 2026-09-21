"""
UniShield Firestore Seeding Script
Populates Firestore (local emulator or production) with:
- metrics/latest (1 doc)
- stats/summary (1 doc)
- simulationChunks/chunk_001 ... chunk_020 (20 docs, each with 100 flows)
- alerts/alert_00001 ... alert_00500 (500 alert docs)

Idempotent: uses deterministic document IDs and set() with batched writes (<=500 docs per batch).
"""
import os
import sys
import json
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, firestore

sys.path.append(str(Path(__file__).resolve().parent))
import config

def init_firebase():
    """Initializes Firebase Admin / Firestore SDK for emulator or production."""
    emulator_host = os.environ.get("FIRESTORE_EMULATOR_HOST")
    if emulator_host:
        print(f"[INFO] Using Firestore Emulator at {emulator_host}")
        from google.cloud import firestore as g_firestore
        from google.auth.credentials import AnonymousCredentials
        return g_firestore.Client(
            project="workshop-project-5d2b3",
            credentials=AnonymousCredentials()
        )
        
    # Check serviceAccountKey.json
    key_path = config.BASE_DIR.parent / "serviceAccountKey.json"
    if key_path.exists():
        print(f"[INFO] Using Service Account Key at {key_path}")
        cred = credentials.Certificate(str(key_path))
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        return firestore.client()
        
    # Check GOOGLE_APPLICATION_CREDENTIALS
    gac = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if gac and Path(gac).exists():
        print(f"[INFO] Using credentials from GOOGLE_APPLICATION_CREDENTIALS: {gac}")
        cred = credentials.Certificate(gac)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        return firestore.client()

    # Check Firebase CLI credentials in user profile (~/.config/configstore/firebase-tools.json)
    cli_config = Path.home() / ".config" / "configstore" / "firebase-tools.json"
    if cli_config.exists():
        try:
            with open(cli_config, "r") as f:
                cli_data = json.load(f)
            tokens = cli_data.get("tokens", {})
            access_token = tokens.get("access_token")
            refresh_token = tokens.get("refresh_token")
            if access_token or refresh_token:
                print(f"[INFO] Using authenticated Firebase CLI credentials ({cli_data.get('user', {}).get('email')})")
                from google.oauth2.credentials import Credentials as OAuth2Credentials
                from google.cloud import firestore as g_firestore
                creds = OAuth2Credentials(
                    token=access_token,
                    refresh_token=refresh_token,
                    token_uri="https://oauth2.googleapis.com/token",
                    client_id="563584335869-fgrhgmd47bqnekij5i8b5pr03ho85qd6.apps.googleusercontent.com"
                )
                return g_firestore.Client(project="workshop-project-5d2b3", credentials=creds)
        except Exception as err:
            print(f"[WARN] Could not load Firebase CLI credentials: {err}")
        
    # Fallback to default project app
    print("[INFO] Attempting default credentials with project 'workshop-project-5d2b3'...")
    try:
        if not firebase_admin._apps:
            firebase_admin.initialize_app(options={"projectId": "workshop-project-5d2b3"})
        return firestore.client()
    except Exception as e:
        print(f"[ERROR] Could not initialize Firebase Admin SDK: {e}")
        print("To seed the Firestore emulator, set:")
        print("  $env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'")
        print("To seed production, provide serviceAccountKey.json in project root.")
        sys.exit(1)

def commit_batch(db, batch_operations):
    """Executes a list of (doc_ref, data) as Firestore batched writes."""
    batch = db.batch()
    for doc_ref, data in batch_operations:
        batch.set(doc_ref, data)
    batch.commit()

def main():
    print("=== UniShield Firestore Seeding Script ===")
    
    metrics_file = config.REPORTS_DIR / "metrics.json"
    sim_data_file = config.REPORTS_DIR / "simulation_data.json"
    
    if not metrics_file.exists() or not sim_data_file.exists():
        raise FileNotFoundError(
            "metrics.json or simulation_data.json missing. Run evaluate.py first!"
        )
        
    with open(metrics_file, "r") as f:
        metrics_data = json.load(f)
    with open(sim_data_file, "r") as f:
        sim_data = json.load(f)
        
    stats_data = sim_data["stats"]
    chunks_data = sim_data["chunks"]
    alerts_data = sim_data["alerts"]
    
    db = init_firebase()
    
    # 1. Seed metrics/latest
    metrics_ref = db.collection("metrics").document("latest")
    metrics_ref.set(metrics_data)
    
    # 2. Seed stats/summary
    stats_ref = db.collection("stats").document("summary")
    stats_ref.set(stats_data)
    
    # 3. Seed simulationChunks
    chunks_batch = []
    for chunk in chunks_data:
        doc_id = chunk["chunkId"]
        ref = db.collection("simulationChunks").document(doc_id)
        chunks_batch.append((ref, chunk))
    commit_batch(db, chunks_batch)
    
    # 4. Seed alerts in batches of <= 450
    alert_count = len(alerts_data)
    batch_size = 400
    for i in range(0, alert_count, batch_size):
        slice_alerts = alerts_data[i:i + batch_size]
        alerts_batch = []
        for alert in slice_alerts:
            doc_id = alert["alertId"]
            ref = db.collection("alerts").document(doc_id)
            alerts_batch.append((ref, alert))
        commit_batch(db, alerts_batch)
        
    # Output required exact format:
    print(f"Chunks: {len(chunks_data)}")
    print(f"Alerts: {len(alerts_data)}")
    print("Metrics: 1")
    print("Stats: 1")
    print("Seed completed successfully.")

if __name__ == "__main__":
    main()
