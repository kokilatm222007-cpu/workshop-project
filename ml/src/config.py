"""
UniShield Configuration: Feature Sets, Label Maps, and Paths
"""
import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
MODELS_DIR = BASE_DIR / "models"
REPORTS_DIR = BASE_DIR / "reports"

# 5 Target Classes mapping
LABEL_MAP = {
    # 0: Benign
    "BENIGN": 0,
    
    # 1: DoS / DDoS
    "DoS Hulk": 1,
    "DoS GoldenEye": 1,
    "DoS slowloris": 1,
    "DoS Slowhttptest": 1,
    "DDoS": 1,
    "DOS_DDOS": 1,
    
    # 2: PortScan
    "PortScan": 2,
    "PORT_SCAN": 2,
    
    # 3: Brute Force
    "FTP-Patator": 3,
    "SSH-Patator": 3,
    "BRUTE_FORCE": 3,
    
    # 4: Botnet
    "Bot": 4,
    "BOTNET": 4
}

CLASS_NAMES = [
    "BENIGN",
    "DOS_DDOS",
    "PORT_SCAN",
    "BRUTE_FORCE",
    "BOTNET"
]

# Leakage features that must never be used
LEAKAGE_FEATURES = [
    "Flow ID",
    "Source IP",
    "Destination IP",
    "Timestamp",
    "Source Port",
    "Src IP",
    "Dst IP",
    "Src Port"
]

# Forward-direction columns only (Unidirectional)
UNIDIRECTIONAL_FEATURES = [
    "Destination Port",
    "Flow Duration",
    "Total Fwd Packets",
    "Total Length of Fwd Packets",
    "Fwd Packet Length Max",
    "Fwd Packet Length Min",
    "Fwd Packet Length Mean",
    "Fwd Packet Length Std",
    "Fwd IAT Total",
    "Fwd IAT Mean",
    "Fwd IAT Std",
    "Fwd IAT Max",
    "Fwd IAT Min",
    "Fwd PSH Flags",
    "Fwd URG Flags",
    "Fwd Header Length",
    "Fwd Packets/s",
    "Init_Win_bytes_forward",
    "act_data_pkt_fwd",
    "min_seg_size_forward",
    "Subflow Fwd Packets",
    "Subflow Fwd Bytes"
]

# Optional derived forward features
DERIVED_FWD_FEATURES = [
    "fwd_bytes_per_packet",
    "fwd_pkt_rate"
]

# Full unidirectional feature list used for main model
FINAL_UNIDIRECTIONAL_FEATURES = UNIDIRECTIONAL_FEATURES + DERIVED_FWD_FEATURES

# Bidirectional backward and combined features
BIDIRECTIONAL_EXTRA_FEATURES = [
    "Total Backward Packets",
    "Total Length of Bwd Packets",
    "Bwd Packet Length Max",
    "Bwd Packet Length Min",
    "Bwd Packet Length Mean",
    "Bwd Packet Length Std",
    "Flow Bytes/s",
    "Flow Packets/s",
    "Flow IAT Mean",
    "Flow IAT Std",
    "Flow IAT Max",
    "Flow IAT Min",
    "Bwd IAT Total",
    "Bwd IAT Mean",
    "Bwd IAT Std",
    "Bwd IAT Max",
    "Bwd IAT Min",
    "Bwd PSH Flags",
    "Bwd URG Flags",
    "Bwd Header Length",
    "Bwd Packets/s",
    "Packet Length Min",
    "Packet Length Max",
    "Packet Length Mean",
    "Packet Length Std",
    "Packet Length Variance",
    "FIN Flag Count",
    "SYN Flag Count",
    "RST Flag Count",
    "PSH Flag Count",
    "ACK Flag Count",
    "URG Flag Count",
    "CWE Flag Count",
    "ECE Flag Count",
    "Down/Up Ratio",
    "Average Packet Size",
    "Avg Fwd Segment Size",
    "Avg Bwd Segment Size",
    "Subflow Bwd Packets",
    "Subflow Bwd Bytes",
    "Init_Win_bytes_backward"
]

FINAL_BIDIRECTIONAL_FEATURES = FINAL_UNIDIRECTIONAL_FEATURES + BIDIRECTIONAL_EXTRA_FEATURES

RANDOM_STATE = 42
MAX_SAMPLE_SIZE = 300000
