# UniShield: AI-Based Cyber Threat Detection in Unidirectional IP Traffic

> **Firebase Edition — Built with Google Antigravity**  
> *Detecting network intrusions when reverse-direction packet visibility is absent.*

---

## 1. Problem Statement & Motivation

Traditional Network Intrusion Detection Systems (NIDS) rely heavily on **bidirectional flow features**—such as TCP handshake completion, backward packet size distributions, request-response inter-arrival times, and server TCP flags.

However, in many critical security perimeters, bidirectional visibility is impossible:
- **Asymmetric Routing**: Forward packets take one ISP route while return packets traverse a completely distinct physical path.
- **Hardware Network Taps & Data Diodes**: High-security environments (industrial SCADA, defense networks, air-gapped enclaves) employ physical one-way optical fiber taps that only mirror transmission into monitoring enclaves, preventing any return feedback.
- **Resource Constraints & High-Speed Aggregators**: Maintaining flow state tables for bidirectional matching at 100 Gbps+ incurs immense memory and CPU overhead.

**UniShield** addresses this exact challenge: **Can machine learning accurately identify cyber threats using *only* forward-direction packet features?**

Our evaluation quantifies the exact trade-off between Unidirectional feature extraction (24 features) and full Bidirectional feature extraction (65 features).

---

## 2. Research Findings & Core Contribution

UniShield proves that **unidirectional traffic retains over 99% of bidirectional detection accuracy** while slashing state-tracking requirements by **63%**.

### Unidirectional vs. Bidirectional Comparison

| Model Architecture | Features Monitored | Accuracy | Macro F1-Score | Benign False Positive Rate (FPR) | F1 Performance Delta |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **XGBoost (Unidirectional)** *(Main)* | **24 (Forward-Only)** | **99.63%** | **98.28%** | **0.47%** | **-0.24%** |
| **XGBoost (Bidirectional)** *(Baseline)* | 65 (Full Flow) | 99.68% | 98.52% | 0.39% | *Baseline* |
| **Random Forest (Unidirectional)** | **24 (Forward-Only)** | **99.47%** | **97.52%** | **0.62%** | **-0.41%** |
| **Random Forest (Bidirectional)** | 65 (Full Flow) | 99.56% | 97.93% | 0.44% | *Baseline* |
| **Isolation Forest (Unsupervised)** | **24 (Forward-Only)** | — | **94.34%** *(Recall)* | **3.32%** *(FPR)* | *Out-of-Distribution* |

*Inference Speed: Standalone XGBoost executes inference at **2.67 ms per 1,000 flows**.*

---

## 3. Threat Classes

UniShield classifies network traffic into 5 distinct categories based on CIC-IDS2017:
1. **`BENIGN`**: Legitimate web, DNS, and TLS communication.
2. **`DOS_DDOS`**: DoS Hulk, GoldenEye, slowloris, Slowhttptest, DDoS.
3. **`PORT_SCAN`**: Reconnaissance probing ports across endpoints.
4. **`BRUTE_FORCE`**: Automated SSH and FTP credential attacks.
5. **`BOTNET`**: Command-and-control (C2) beaconing and suspicious outbound communication.

---

## 4. Feature Sets & Leakage Prevention

### A. Unidirectional Feature Set (Forward Traffic Only)
- `Destination Port`
- `Flow Duration`
- `Total Fwd Packets`, `Total Length of Fwd Packets`
- `Fwd Packet Length Max / Min / Mean / Std`
- `Fwd IAT Total / Mean / Std / Max / Min`
- `Fwd PSH Flags`, `Fwd URG Flags`, `Fwd Header Length`, `Fwd Packets/s`
- `Init_Win_bytes_forward`, `act_data_pkt_fwd`, `min_seg_size_forward`
- `Subflow Fwd Packets`, `Subflow Fwd Bytes`
- **Derived Features**: `fwd_bytes_per_packet`, `fwd_pkt_rate`

> **Data Leakage Strictly Prevented**: Features such as `Source IP`, `Destination IP`, `Flow ID`, `Timestamp`, and `Source Port` are completely excluded to ensure the model learns generalized protocol behavior rather than memorizing network topology.

---

## 5. System Architecture

```
ml/src/
  ├── preprocess.py      -> Cleans data, handles class imbalances, generates train/test
  ├── train.py           -> Trains RF, XGBoost, IsoForest; exports native JSON
  ├── evaluate.py        -> Compiles comparative metrics, confusion matrices, and replay chunks
  └── seed_firestore.py  -> Idempotently seeds Firestore with metrics and telemetry chunks
functions/
  ├── main.py            -> Python 2nd-gen Cloud Function (predictFlows)
  └── model/xgb_uni.json -> Standalone XGBoost JSON (zero scikit-learn dependency)
frontend/
  ├── src/pages/         -> Overview, LiveMonitor, Analyze, Alerts, ModelPerformance
  └── src/services/      -> firebase.js (Firestore, Auth, Functions, Emulator auto-detection)
```

---

## 6. Setup & Execution Guide

### Prerequisites
- **Python 3.10+** (tested on Python 3.11 with `uv`)
- **Node.js 18+** & `npm`
- **Firebase CLI**: `npx firebase-tools`

### Step 1: Python Environment & ML Pipeline
```powershell
# 1. Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\activate

# 2. Install ML dependencies
pip install -r ml/requirements.txt

# 3. Preprocess Dataset
python ml/src/preprocess.py

# 4. Train Models & Export Native XGBoost JSON
python ml/src/train.py

# 5. Evaluate & Generate Visual Reports
python ml/src/evaluate.py
```

### Step 2: Seed Cloud Firestore
```powershell
# For local Firestore Emulator:
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
python ml/src/seed_firestore.py

# For Production Firestore:
# Place serviceAccountKey.json in the project root and run:
python ml/src/seed_firestore.py
```

### Step 3: Run the Web Dashboard Locally
```powershell
# Inside frontend/ directory
cd frontend
npm install
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 7. Firebase Plan & Deployment Notes

- **Firebase Spark Plan (Free)**:
  Hosting, Cloud Firestore, and Anonymous Authentication run completely free. The dashboard, Live Monitor replay feed, Alerts triage, and Model Performance pages operate with 100% functionality without deploying any server.
- **Firebase Blaze Plan (Pay-as-you-go)**:
  Required **only** for deploying the Python Cloud Function (`predictFlows`) used on the **Analyze** page. If you are on the Spark plan, the Analyze page includes a built-in demo classification mode and an instant 500-flow sample dataset.

### Deploying to Firebase
```powershell
# 1. Authenticate with Firebase
npx firebase-tools login

# 2. Build Frontend
cd frontend
npm run build
cd ..

# 3. Deploy Firestore Security Rules, Indexes, and Hosting
npx firebase-tools deploy --only hosting,firestore

# 4. (Optional - Blaze Plan) Deploy Cloud Functions
npx firebase-tools deploy --only functions
```

---

## 8. Limitations & Engineering Disclaimers

1. **Lab-Generated Training Benchmark**: CIC-IDS2017 was created within a synthetic laboratory environment. While it remains a standard academic benchmark, traffic distributions may differ in live enterprise networks.
2. **Simulated Replay Stream**: The Live Monitor uses pre-scored sequential chunks rather than live kernel packet sniffing, keeping cloud read quotas minimal and operational costs at zero.
3. **CIC-IDS2017 Known Label Inconsistencies**: Academic research has identified occasional labeling artifacts in the raw dataset; UniShield mitigates this through aggressive sanitization, deduplication, and rare-label pruning.
4. **Cloud Function Requirements**: The custom batch inference endpoint requires the Firebase Blaze plan due to Google Cloud Run container execution.
