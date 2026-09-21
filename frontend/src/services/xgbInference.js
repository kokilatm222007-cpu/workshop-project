/**
 * UniShield Client-Side XGBoost Inference Engine
 * Executes the native 750-tree XGBoost model (xgb_uni.json) directly in the browser
 * across 24 unidirectional network flow features with zero server dependency.
 */

let cachedModel = null;
let cachedMeta = null;
let loadPromise = null;

export const loadXGBModel = async () => {
  if (cachedModel && cachedMeta) {
    return { model: cachedModel, meta: cachedMeta };
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const [modelRes, metaRes] = await Promise.all([
      fetch("/model/xgb_uni.json"),
      fetch("/model/features.json")
    ]);

    if (!modelRes.ok || !metaRes.ok) {
      throw new Error("Failed to load XGBoost model assets from /model/");
    }

    const modelJson = await modelRes.json();
    const metaJson = await metaRes.json();

    const baseScoreRaw = modelJson.learner.learner_model_param.base_score;
    const baseScore = typeof baseScoreRaw === "string" ? JSON.parse(baseScoreRaw) : baseScoreRaw;

    cachedModel = {
      trees: modelJson.learner.gradient_booster.model.trees,
      treeInfo: modelJson.learner.gradient_booster.model.tree_info,
      baseScore: Array.isArray(baseScore) ? baseScore : [0, 0, 0, 0, 0]
    };
    cachedMeta = metaJson;

    return { model: cachedModel, meta: cachedMeta };
  })();

  return loadPromise;
};

/**
 * Predict threats on batch flows using the native 24-feature XGBoost ensemble.
 */
export const predictFlowsClientSide = async (rows) => {
  const { model, meta } = await loadXGBModel();
  const { trees, treeInfo, baseScore } = model;
  const feats = meta.unidirectional_features;
  const classNames = meta.class_names || ["BENIGN", "DOS_DDOS", "PORT_SCAN", "BRUTE_FORCE", "BOTNET"];

  const nRows = rows.length;
  const nTrees = trees.length;
  const predictions = new Array(nRows);
  const summary = { BENIGN: 0, DOS_DDOS: 0, PORT_SCAN: 0, BRUTE_FORCE: 0, BOTNET: 0 };

  for (let r = 0; r < nRows; r++) {
    const row = rows[r];
    const totLen = parseFloat(row["Total Length of Fwd Packets"] ?? 0) || 0;
    const totPkts = parseFloat(row["Total Fwd Packets"] ?? 1) || 1;
    const duration = parseFloat(row["Flow Duration"] ?? 1) || 1;
    const destPort = parseInt(row["Destination Port"] ?? 80, 10) || 80;

    // Derived forward features matching training pipeline
    const bytesPerPkt = totLen / (totPkts + 1e-6);
    const pktRate = totPkts / ((duration * 1e-6) + 1e-6);

    // Feature vector matching expected_features order
    const featVec = new Float32Array(feats.length);
    for (let i = 0; i < feats.length; i++) {
      const f = feats[i];
      if (f === "fwd_bytes_per_packet") {
        featVec[i] = bytesPerPkt;
      } else if (f === "fwd_pkt_rate") {
        featVec[i] = pktRate;
      } else {
        const v = parseFloat(row[f] ?? 0);
        featVec[i] = isNaN(v) ? 0 : v;
      }
    }

    // Accumulate tree margin scores for each class
    const scores = [baseScore[0], baseScore[1], baseScore[2], baseScore[3], baseScore[4]];
    for (let t = 0; t < nTrees; t++) {
      const c = treeInfo[t];
      const tree = trees[t];
      const left = tree.left_children;
      const right = tree.right_children;
      const s_idx = tree.split_indices;
      const s_cond = tree.split_conditions;
      const weights = tree.base_weights;
      const def_left = tree.default_left;

      let node = 0;
      while (left[node] !== -1) {
        const val = featVec[s_idx[node]];
        if (isNaN(val)) {
          node = def_left[node] === 1 ? left[node] : right[node];
        } else if (val < s_cond[node]) {
          node = left[node];
        } else {
          node = right[node];
        }
      }
      scores[c] += weights[node];
    }

    // Softmax probabilities
    const maxScore = Math.max(scores[0], scores[1], scores[2], scores[3], scores[4]);
    let sumExp = 0;
    const expScores = [0, 0, 0, 0, 0];
    for (let c = 0; c < 5; c++) {
      const e = Math.exp(scores[c] - maxScore);
      expScores[c] = e;
      sumExp += e;
    }

    let bestIdx = 0;
    let bestProb = expScores[0] / sumExp;
    for (let c = 1; c < 5; c++) {
      const p = expScores[c] / sumExp;
      if (p > bestProb) {
        bestProb = p;
        bestIdx = c;
      }
    }

    const predictedClass = classNames[bestIdx];
    summary[predictedClass] = (summary[predictedClass] || 0) + 1;

    predictions[r] = {
      rowIndex: r + 1,
      predictedClass,
      confidence: parseFloat(Math.min(0.9999, bestProb).toFixed(4)),
      destinationPort: destPort,
      totalFwdPackets: totPkts,
      flowDuration: duration
    };
  }

  return {
    success: true,
    totalRows: nRows,
    summary,
    predictions,
    isLocalFallback: false,
    isClientSideXGB: true,
    engine: "Standalone XGBoost (Client-Side Edge ML)"
  };
};
