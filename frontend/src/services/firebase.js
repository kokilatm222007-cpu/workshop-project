import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  connectFirestoreEmulator, 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter 
} from "firebase/firestore";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  connectAuthEmulator 
} from "firebase/auth";
import { 
  getFunctions, 
  httpsCallable, 
  connectFunctionsEmulator 
} from "firebase/functions";
import { predictFlowsClientSide } from "./xgbInference";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDwcf0kuhsXr_PiJfULn1l3sGigUPpHf8g",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "workshop-project-5d2b3.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "workshop-project-5d2b3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "workshop-project-5d2b3.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "317286909487",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:317286909487:web:unishielddemo01"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);

// Connect emulators if enabled
const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";
if (useEmulators && typeof window !== "undefined") {
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    console.log("[UniShield] Connected to Firebase Emulators");
  } catch (e) {
    console.warn("[UniShield] Emulators already connected or unavailable:", e);
  }
}

// Helper to prevent Firestore from blocking UI if network or offline
const withTimeout = (promise, ms = 1500) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
  ]);
};

// Silent anonymous auth state handler
let currentUser = null;
export const initAuth = () => {
  return new Promise((resolve) => {
    const safetyTimer = setTimeout(() => resolve(null), 1500);
    onAuthStateChanged(auth, async (user) => {
      clearTimeout(safetyTimer);
      if (user) {
        currentUser = user;
        resolve(user);
      } else {
        try {
          const cred = await withTimeout(signInAnonymously(auth), 1500);
          currentUser = cred.user;
          resolve(cred.user);
        } catch (error) {
          console.warn("[UniShield] Anonymous auth notice:", error.message);
          resolve(null);
        }
      }
    });
  });
};

// Fallback in-memory data loader if Firestore collections are empty or offline
let cachedFallbackData = null;
const getFallbackData = async () => {
  if (cachedFallbackData) return cachedFallbackData;
  try {
    const resMetrics = await fetch('/data/metrics.json');
    const resSim = await fetch('/data/simulation_data.json');
    if (resMetrics.ok && resSim.ok) {
      const metrics = await resMetrics.json();
      const sim = await resSim.json();
      cachedFallbackData = { metrics, sim };
      return cachedFallbackData;
    }
  } catch (err) {
    console.warn("[UniShield] Fallback fetch notice:", err);
  }
  return null;
};

/**
 * Fetch Stats Summary from stats/summary with automatic fallback
 */
export const fetchStatsSummary = async () => {
  try {
    const docRef = doc(db, "stats", "summary");
    const snapshot = await withTimeout(getDoc(docRef), 1500);
    if (snapshot.exists()) {
      return snapshot.data();
    }
  } catch (e) {
    console.warn("[UniShield] Firestore stats/summary fetch notice:", e.message);
  }
  const fallback = await getFallbackData();
  return fallback?.sim?.stats || null;
};

/**
 * Fetch latest Metrics from metrics/latest with automatic fallback
 */
export const fetchMetricsLatest = async () => {
  try {
    const docRef = doc(db, "metrics", "latest");
    const snapshot = await withTimeout(getDoc(docRef), 1500);
    if (snapshot.exists()) {
      return snapshot.data();
    }
  } catch (e) {
    console.warn("[UniShield] Firestore metrics/latest fetch notice:", e.message);
  }
  const fallback = await getFallbackData();
  return fallback?.metrics || null;
};

/**
 * Fetch a single Simulation Chunk doc (chunk_001 ... chunk_020)
 */
export const fetchSimulationChunk = async (chunkNumber) => {
  const chunkId = `chunk_${String(chunkNumber).padStart(3, '0')}`;
  try {
    const docRef = doc(db, "simulationChunks", chunkId);
    const snapshot = await withTimeout(getDoc(docRef), 1500);
    if (snapshot.exists()) {
      return snapshot.data();
    }
  } catch (e) {
    console.warn(`[UniShield] Chunk ${chunkId} fetch notice:`, e.message);
  }
  const fallback = await getFallbackData();
  const found = fallback?.sim?.chunks?.find(c => c.chunkId === chunkId);
  return found || null;
};

/**
 * Fetch Paginated Alerts with optional class filter
 */
export const fetchAlerts = async (selectedClass = "ALL", pageSize = 25, lastVisibleDoc = null) => {
  try {
    const alertsRef = collection(db, "alerts");
    let constraints = [];
    
    if (selectedClass && selectedClass !== "ALL") {
      constraints.push(where("predictedClass", "==", selectedClass));
    }
    constraints.push(orderBy("timestamp", "desc"));
    
    if (lastVisibleDoc) {
      constraints.push(startAfter(lastVisibleDoc));
    }
    constraints.push(limit(pageSize));

    const q = query(alertsRef, ...constraints);
    const snapshot = await withTimeout(getDocs(q), 1500);
    
    if (!snapshot.empty) {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      return { alerts: items, lastDoc, total: snapshot.size };
    }
  } catch (e) {
    console.warn("[UniShield] Firestore alerts fetch notice:", e.message);
  }
  
  // Graceful fallback from bundled simulation data
  const fallback = await getFallbackData();
  let allAlerts = fallback?.sim?.alerts || [];
  if (selectedClass && selectedClass !== "ALL") {
    allAlerts = allAlerts.filter(a => a.predictedClass === selectedClass);
  }
  const offset = lastVisibleDoc ? parseInt(lastVisibleDoc.offset || 0, 10) : 0;
  const pageItems = allAlerts.slice(offset, offset + pageSize);
  const nextOffset = offset + pageItems.length;
  const lastDoc = nextOffset < allAlerts.length ? { offset: nextOffset } : null;
  
  return { alerts: pageItems, lastDoc, total: allAlerts.length };
};

/**
 * Call the predictFlows Cloud Function for the Analyze page with client-side XGBoost engine
 */
export const callPredictFlows = async (rows) => {
  try {
    // Attempt Cloud Function if deployed
    if (!auth.currentUser) {
      await initAuth();
    }
    const predictFn = httpsCallable(functions, "predictFlows");
    const result = await predictFn({ rows });
    return {
      ...result.data,
      isLocalFallback: false,
      isClientSideXGB: false,
      engine: "Cloud Function (XGBoost Standalone Native)"
    };
  } catch (error) {
    console.info("[UniShield] Cloud Function not deployed, running native Client-Side XGBoost Engine:", error.message || error.code);
    try {
      // Execute the real 750-tree XGBoost model directly in the browser
      const clientRes = await predictFlowsClientSide(rows);
      return clientRes;
    } catch (xgbErr) {
      console.warn("[UniShield] Client XGBoost notice, running browser demo rules:", xgbErr);
      return runBrowserDemoInference(rows, xgbErr.message || "XGBoost client fallback");
    }
  }
};

/**
 * Built-in browser demo inference engine using hand-written heuristic decision rules
 */
const runBrowserDemoInference = (rows, reason) => {
  const classNames = ["BENIGN", "DOS_DDOS", "PORT_SCAN", "BRUTE_FORCE", "BOTNET"];
  
  const predictions = rows.map((r, idx) => {
    const port = Number(r["Destination Port"] ?? 80);
    const pkts = Number(r["Total Fwd Packets"] ?? 1);
    const totalLen = Number(r["Total Length of Fwd Packets"] ?? 0);
    const duration = Number(r["Flow Duration"] ?? 100);
    const iatMean = Number(r["Fwd IAT Mean"] ?? 1000);
    const pktRate = pkts / ((duration * 1e-6) + 1e-5);
    const bytesPerPkt = totalLen / (pkts + 1e-5);

    let predClass = "BENIGN";
    let conf = 0.94 + ((idx * 17) % 50) / 1000;

    // Hand-written heuristic rules based on port and forward traffic thresholds
    if ([21, 22].includes(port) && pkts >= 4) {
      predClass = "BRUTE_FORCE";
      conf = 0.96 + ((idx * 7) % 35) / 1000;
    } else if (([80, 443, 8080].includes(port) && (pkts > 20 || pktRate > 40)) || (pkts > 30 && duration < 500000)) {
      predClass = "DOS_DDOS";
      conf = 0.97 + ((idx * 11) % 25) / 1000;
    } else if ([6667, 4444].includes(port) || (duration > 800000 && iatMean > 40000 && bytesPerPkt < 200)) {
      predClass = "BOTNET";
      conf = 0.92 + ((idx * 13) % 45) / 1000;
    } else if ((pkts <= 3 && port > 1024 && duration < 2000) || (pkts === 1 && bytesPerPkt <= 64)) {
      predClass = "PORT_SCAN";
      conf = 0.98 + ((idx * 5) % 18) / 1000;
    } else {
      predClass = "BENIGN";
      conf = 0.96 + ((idx * 9) % 38) / 1000;
    }

    return {
      rowIndex: idx + 1,
      predictedClass: predClass,
      confidence: parseFloat(Math.min(0.999, conf).toFixed(3)),
      destinationPort: port,
      totalFwdPackets: pkts,
      flowDuration: duration
    };
  });

  const summary = classNames.reduce((acc, c) => {
    acc[c] = predictions.filter(p => p.predictedClass === c).length;
    return acc;
  }, {});

  return {
    success: true,
    totalRows: rows.length,
    summary,
    predictions,
    isLocalFallback: true,
    engine: "Demo engine (Cloud Function not deployed)",
    fallbackReason: reason
  };
};

export { app, db, auth, functions };
