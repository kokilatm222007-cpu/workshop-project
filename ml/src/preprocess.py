"""
UniShield Data Preprocessing Pipeline
Cleans CIC-IDS2017 dataset or generates synthetic dataset if raw files are absent.
Produces stratified train and test datasets and a test sample for the Analyze page.
"""
import os
import sys
import glob
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

# Add current dir to path to import config
sys.path.append(str(Path(__file__).resolve().parent))
import config

def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Cleans column names, filters labels, handles NaNs/Infs, removes duplicates."""
    print(f"Initial raw rows: {len(df):,}")
    
    # Strip whitespace from column names
    df.columns = df.columns.str.strip()
    
    # Target label column name check
    label_col = "Label" if "Label" in df.columns else "label"
    if label_col not in df.columns:
        raise ValueError(f"Label column not found. Available columns: {list(df.columns[:5])}...")
        
    df["clean_label"] = df[label_col].astype(str).str.strip()
    
    # Map to 5 target classes
    df["class_id"] = df["clean_label"].map(config.LABEL_MAP)
    
    # Drop rows with unmapped/rare labels
    unmapped_count = df["class_id"].isna().sum()
    if unmapped_count > 0:
        print(f"Dropping {unmapped_count:,} rows with rare/unsupported labels.")
        df = df.dropna(subset=["class_id"])
    df["class_id"] = df["class_id"].astype(int)
    
    # Drop data leakage columns if present
    cols_to_drop = [c for c in config.LEAKAGE_FEATURES if c in df.columns]
    if cols_to_drop:
        print(f"Dropping data leakage columns: {cols_to_drop}")
        df = df.drop(columns=cols_to_drop)
        
    # Replace inf with NaN and drop NaNs
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].replace([np.inf, -np.inf], np.nan)
    before_nan_drop = len(df)
    df = df.dropna()
    print(f"Dropped {before_nan_drop - len(df):,} rows containing NaNs or Infs.")
    
    # Drop duplicates
    before_dup_drop = len(df)
    df = df.drop_duplicates()
    print(f"Dropped {before_dup_drop - len(df):,} duplicate rows.")
    
    # Compute derived forward features
    total_fwd_len = df["Total Length of Fwd Packets"] if "Total Length of Fwd Packets" in df.columns else 0
    total_fwd_pkts = df["Total Fwd Packets"] if "Total Fwd Packets" in df.columns else 1
    duration = df["Flow Duration"] if "Flow Duration" in df.columns else 1
    
    df["fwd_bytes_per_packet"] = total_fwd_len / (total_fwd_pkts + 1e-6)
    # duration in microseconds in CIC-IDS2017 -> convert to seconds
    df["fwd_pkt_rate"] = total_fwd_pkts / ((duration * 1e-6) + 1e-6)
    
    print(f"Cleaned dataset rows: {len(df):,}")
    return df

def generate_synthetic_dataset(n_samples: int = 150000) -> pd.DataFrame:
    """
    Generates an authentic synthetic dataset matching CIC-IDS2017 schema and 5 classes
    when raw CSVs are not provided.
    """
    print(f"Generating synthetic dataset with {n_samples:,} samples across 5 classes...")
    rng = np.random.RandomState(config.RANDOM_STATE)
    
    # Realistic class distribution: Benign (70%), DoS (15%), PortScan (8%), BruteForce (5%), Botnet (2%)
    class_probs = [0.70, 0.15, 0.08, 0.05, 0.02]
    class_assignments = rng.choice(5, size=n_samples, p=class_probs)
    
    data = {"class_id": class_assignments}
    
    # Generate realistic features conditioned on class
    dest_ports = np.zeros(n_samples, dtype=int)
    flow_duration = np.zeros(n_samples, dtype=float)
    total_fwd_pkts = np.zeros(n_samples, dtype=float)
    total_len_fwd = np.zeros(n_samples, dtype=float)
    fwd_iat_mean = np.zeros(n_samples, dtype=float)
    init_win_fwd = np.zeros(n_samples, dtype=float)
    
    # Class 0: BENIGN - web, DNS, TLS traffic
    idx_0 = (class_assignments == 0)
    n_0 = np.sum(idx_0)
    dest_ports[idx_0] = rng.choice([80, 443, 53, 8080, 8443, 22], size=n_0, p=[0.35, 0.45, 0.10, 0.05, 0.03, 0.02])
    flow_duration[idx_0] = rng.exponential(scale=250000, size=n_0) + 100
    total_fwd_pkts[idx_0] = rng.negative_binomial(5, 0.5, size=n_0) + 1
    total_len_fwd[idx_0] = total_fwd_pkts[idx_0] * rng.uniform(40, 600, size=n_0)
    fwd_iat_mean[idx_0] = rng.exponential(scale=50000, size=n_0)
    init_win_fwd[idx_0] = rng.choice([8192, 14600, 29200, 65535], size=n_0)
    
    # Class 1: DOS_DDOS - High volume, rapid packets, web ports
    idx_1 = (class_assignments == 1)
    n_1 = np.sum(idx_1)
    dest_ports[idx_1] = rng.choice([80, 443, 8080], size=n_1, p=[0.6, 0.3, 0.1])
    flow_duration[idx_1] = rng.exponential(scale=800000, size=n_1) + 5000
    total_fwd_pkts[idx_1] = rng.negative_binomial(25, 0.2, size=n_1) + 15
    total_len_fwd[idx_1] = total_fwd_pkts[idx_1] * rng.uniform(100, 900, size=n_1)
    fwd_iat_mean[idx_1] = rng.exponential(scale=2000, size=n_1) + 10  # very fast packets
    init_win_fwd[idx_1] = rng.choice([256, 1024, 8192], size=n_1)
    
    # Class 2: PORT_SCAN - Probing many ports, low packet count per flow
    idx_2 = (class_assignments == 2)
    n_2 = np.sum(idx_2)
    dest_ports[idx_2] = rng.randint(1, 65535, size=n_2)
    flow_duration[idx_2] = rng.exponential(scale=500, size=n_2) + 10  # short probe
    total_fwd_pkts[idx_2] = rng.choice([1, 2, 3], size=n_2, p=[0.7, 0.2, 0.1])
    total_len_fwd[idx_2] = total_fwd_pkts[idx_2] * rng.choice([0, 40, 64], size=n_2)
    fwd_iat_mean[idx_2] = rng.exponential(scale=100, size=n_2)
    init_win_fwd[idx_2] = rng.choice([1024, 2048, 65535], size=n_2)
    
    # Class 3: BRUTE_FORCE - SSH (22) / FTP (21) login attempts
    idx_3 = (class_assignments == 3)
    n_3 = np.sum(idx_3)
    dest_ports[idx_3] = rng.choice([21, 22], size=n_3, p=[0.45, 0.55])
    flow_duration[idx_3] = rng.exponential(scale=400000, size=n_3) + 20000
    total_fwd_pkts[idx_3] = rng.negative_binomial(12, 0.4, size=n_3) + 5
    total_len_fwd[idx_3] = total_fwd_pkts[idx_3] * rng.uniform(60, 200, size=n_3)
    fwd_iat_mean[idx_3] = rng.exponential(scale=30000, size=n_3) + 500
    init_win_fwd[idx_3] = rng.choice([14600, 29200, 65535], size=n_3)
    
    # Class 4: BOTNET - Periodic beaconing / C2 on unusual ports
    idx_4 = (class_assignments == 4)
    n_4 = np.sum(idx_4)
    dest_ports[idx_4] = rng.choice([6667, 8080, 80, 443, 4444], size=n_4, p=[0.3, 0.25, 0.2, 0.15, 0.1])
    flow_duration[idx_4] = rng.exponential(scale=1200000, size=n_4) + 100000
    total_fwd_pkts[idx_4] = rng.negative_binomial(8, 0.35, size=n_4) + 3
    total_len_fwd[idx_4] = total_fwd_pkts[idx_4] * rng.uniform(80, 400, size=n_4)
    fwd_iat_mean[idx_4] = rng.normal(loc=60000, scale=5000, size=n_4).clip(min=1000)  # regular intervals
    init_win_fwd[idx_4] = rng.choice([8192, 14600, 65535], size=n_4)

    df = pd.DataFrame({
        "Destination Port": dest_ports,
        "Flow Duration": flow_duration.clip(min=1),
        "Total Fwd Packets": total_fwd_pkts,
        "Total Length of Fwd Packets": total_len_fwd,
        "Fwd Packet Length Max": (total_len_fwd / (total_fwd_pkts + 1e-5) * 1.5).clip(max=1500),
        "Fwd Packet Length Min": rng.choice([0, 20, 40], size=n_samples),
        "Fwd Packet Length Mean": total_len_fwd / (total_fwd_pkts + 1e-5),
        "Fwd Packet Length Std": rng.exponential(scale=50, size=n_samples),
        "Fwd IAT Total": flow_duration * 0.9,
        "Fwd IAT Mean": fwd_iat_mean,
        "Fwd IAT Std": fwd_iat_mean * rng.uniform(0.1, 0.8, size=n_samples),
        "Fwd IAT Max": fwd_iat_mean * rng.uniform(1.2, 3.0, size=n_samples),
        "Fwd IAT Min": (fwd_iat_mean * rng.uniform(0.01, 0.2, size=n_samples)).clip(min=0),
        "Fwd PSH Flags": rng.choice([0, 1], size=n_samples, p=[0.85, 0.15]),
        "Fwd URG Flags": np.zeros(n_samples),
        "Fwd Header Length": total_fwd_pkts * 20,
        "Fwd Packets/s": total_fwd_pkts / ((flow_duration * 1e-6) + 1e-5),
        "Init_Win_bytes_forward": init_win_fwd,
        "act_data_pkt_fwd": (total_fwd_pkts * 0.7).astype(int),
        "min_seg_size_forward": rng.choice([20, 32], size=n_samples),
        "Subflow Fwd Packets": total_fwd_pkts,
        "Subflow Fwd Bytes": total_len_fwd,
        # Bidirectional extras
        "Total Backward Packets": total_fwd_pkts * rng.uniform(0.5, 1.5, size=n_samples),
        "Total Length of Bwd Packets": total_len_fwd * rng.uniform(0.5, 2.5, size=n_samples),
        "Bwd Packet Length Max": rng.uniform(50, 1500, size=n_samples),
        "Bwd Packet Length Min": rng.choice([0, 20, 40], size=n_samples),
        "Bwd Packet Length Mean": rng.uniform(40, 800, size=n_samples),
        "Bwd Packet Length Std": rng.uniform(10, 200, size=n_samples),
        "Flow Bytes/s": (total_len_fwd * 2) / ((flow_duration * 1e-6) + 1e-5),
        "Flow Packets/s": (total_fwd_pkts * 2) / ((flow_duration * 1e-6) + 1e-5),
        "Flow IAT Mean": fwd_iat_mean * 0.8,
        "Flow IAT Std": fwd_iat_mean * 0.5,
        "Flow IAT Max": fwd_iat_mean * 2.0,
        "Flow IAT Min": 0.0,
        "Bwd IAT Total": flow_duration * 0.85,
        "Bwd IAT Mean": fwd_iat_mean * 0.9,
        "Bwd IAT Std": fwd_iat_mean * 0.6,
        "Bwd IAT Max": fwd_iat_mean * 2.2,
        "Bwd IAT Min": 0.0,
        "Bwd PSH Flags": rng.choice([0, 1], size=n_samples, p=[0.9, 0.1]),
        "Bwd URG Flags": np.zeros(n_samples),
        "Bwd Header Length": total_fwd_pkts * 20,
        "Bwd Packets/s": total_fwd_pkts / ((flow_duration * 1e-6) + 1e-5),
        "Packet Length Min": 0.0,
        "Packet Length Max": 1500.0,
        "Packet Length Mean": rng.uniform(50, 700, size=n_samples),
        "Packet Length Std": rng.uniform(20, 250, size=n_samples),
        "Packet Length Variance": rng.uniform(400, 62500, size=n_samples),
        "FIN Flag Count": rng.choice([0, 1], size=n_samples, p=[0.95, 0.05]),
        "SYN Flag Count": rng.choice([0, 1], size=n_samples, p=[0.92, 0.08]),
        "RST Flag Count": rng.choice([0, 1], size=n_samples, p=[0.97, 0.03]),
        "PSH Flag Count": rng.choice([0, 1], size=n_samples, p=[0.85, 0.15]),
        "ACK Flag Count": rng.choice([0, 1], size=n_samples, p=[0.30, 0.70]),
        "URG Flag Count": np.zeros(n_samples),
        "CWE Flag Count": np.zeros(n_samples),
        "ECE Flag Count": np.zeros(n_samples),
        "Down/Up Ratio": rng.choice([0, 1, 2], size=n_samples, p=[0.2, 0.6, 0.2]),
        "Average Packet Size": rng.uniform(60, 800, size=n_samples),
        "Avg Fwd Segment Size": total_len_fwd / (total_fwd_pkts + 1e-5),
        "Avg Bwd Segment Size": rng.uniform(60, 800, size=n_samples),
        "Subflow Bwd Packets": total_fwd_pkts,
        "Subflow Bwd Bytes": total_len_fwd * 1.5,
        "Init_Win_bytes_backward": rng.choice([8192, 14600, 29200, 65535], size=n_samples),
        "class_id": class_assignments
    })
    
    # Derived forward features
    df["fwd_bytes_per_packet"] = df["Total Length of Fwd Packets"] / (df["Total Fwd Packets"] + 1e-6)
    df["fwd_pkt_rate"] = df["Total Fwd Packets"] / ((df["Flow Duration"] * 1e-6) + 1e-6)
    df["Label"] = [config.CLASS_NAMES[i] for i in class_assignments]
    
    return df

def sample_dataset(df: pd.DataFrame, max_samples: int = config.MAX_SAMPLE_SIZE) -> pd.DataFrame:
    """Downsamples dominant classes while preserving all rare class rows."""
    if len(df) <= max_samples:
        return df
        
    print(f"Sampling dataset to <= {max_samples:,} rows while keeping rare classes...")
    class_counts = df["class_id"].value_counts()
    print("Class distribution before sampling:")
    for cid, cnt in class_counts.items():
        print(f"  Class {cid} ({config.CLASS_NAMES[cid]}): {cnt:,}")
        
    # Keep 100% of minority classes, downsample majority class (typically Benign / DoS)
    subsets = []
    # Reserve slots for minority classes
    target_non_benign = df[df["class_id"] != 0]
    benign = df[df["class_id"] == 0]
    
    remaining_budget = max_samples - len(target_non_benign)
    if remaining_budget > 0 and len(benign) > remaining_budget:
        sampled_benign = benign.sample(n=remaining_budget, random_state=config.RANDOM_STATE)
        df_sampled = pd.concat([sampled_benign, target_non_benign], ignore_index=True)
    else:
        # If non-benign alone exceeds budget, stratify
        df_sampled = df.groupby("class_id", group_keys=False).apply(
            lambda x: x.sample(int(np.rint(max_samples * len(x) / len(df))), random_state=config.RANDOM_STATE)
        )
        
    print(f"Sampled dataset rows: {len(df_sampled):,}")
    return df_sampled

def main():
    print("=== UniShield Data Preprocessing Pipeline ===")
    
    raw_csvs = glob.glob(str(config.RAW_DATA_DIR / "*.csv"))
    
    if not raw_csvs:
        print(f"\n[INFO] No raw CSVs found in {config.RAW_DATA_DIR}.")
        print("[INFO] Generating synthetic dataset matching CIC-IDS2017 specifications...")
        df = generate_synthetic_dataset(n_samples=150000)
    else:
        print(f"Found {len(raw_csvs)} raw CSV file(s) in {config.RAW_DATA_DIR}:")
        for f in raw_csvs:
            print(f"  - {Path(f).name}")
        dfs = []
        for f in raw_csvs:
            print(f"Loading {Path(f).name}...")
            part = pd.read_csv(f, low_memory=False)
            dfs.append(part)
        df = pd.concat(dfs, ignore_index=True)
        df = clean_dataframe(df)

    df = sample_dataset(df, config.MAX_SAMPLE_SIZE)
    
    print("\nFinal Class Distribution:")
    for cid in range(len(config.CLASS_NAMES)):
        c_name = config.CLASS_NAMES[cid]
        cnt = (df["class_id"] == cid).sum()
        pct = (cnt / len(df)) * 100
        print(f"  [{cid}] {c_name:<12}: {cnt:8,} ({pct:5.2f}%)")

    # Stratified 80/20 train/test split
    train_df, test_df = train_test_split(
        df,
        test_size=0.2,
        stratify=df["class_id"],
        random_state=config.RANDOM_STATE
    )
    
    print(f"\nTrain set: {len(train_df):,} rows")
    print(f"Test set:  {len(test_df):,} rows")
    
    # Save processed files
    config.PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    train_path = config.PROCESSED_DATA_DIR / "train.parquet"
    test_path = config.PROCESSED_DATA_DIR / "test.parquet"
    
    train_df.to_parquet(train_path, index=False)
    test_df.to_parquet(test_path, index=False)
    print(f"Saved train dataset to: {train_path}")
    print(f"Saved test dataset to:  {test_path}")
    
    # Also export a sample CSV (e.g. 500 rows) for testing the Analyze page
    sample_analyze_df = test_df.sample(n=min(500, len(test_df)), random_state=config.RANDOM_STATE)
    sample_cols = config.UNIDIRECTIONAL_FEATURES.copy()
    sample_csv_path = config.BASE_DIR / "data" / "sample_traffic_test.csv"
    sample_analyze_df[sample_cols].to_csv(sample_csv_path, index=False)
    print(f"Exported Analyze page test sample to: {sample_csv_path}")
    print("Preprocessing completed successfully!")

if __name__ == "__main__":
    main()
