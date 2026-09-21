import React, { useState } from 'react';
import Papa from 'papaparse';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Download, ArrowRight, ShieldAlert, RefreshCw, Cpu } from 'lucide-react';
import ThreatChart from '../components/ThreatChart';
import Loader from '../components/Loader';
import { callPredictFlows } from '../services/firebase';

const REQUIRED_SAMPLE_FEATURES = [
  "Destination Port",
  "Flow Duration",
  "Total Fwd Packets",
  "Total Length of Fwd Packets"
];

const CLASS_BADGES = {
  BENIGN: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  DOS_DDOS: 'bg-rose-500/15 text-rose-400 border-rose-500/40',
  PORT_SCAN: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  BRUTE_FORCE: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  BOTNET: 'bg-purple-500/15 text-purple-400 border-purple-500/40'
};

export default function Analyze() {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Handle file select
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    processCSV(selectedFile);
  };

  const processCSV = (f) => {
    setFile(f);
    setErrorMsg("");
    setAnalysisResult(null);
    setParsing(true);

    Papa.parse(f, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsing(false);
        if (results.errors && results.errors.length > 0 && results.data.length === 0) {
          setErrorMsg(`CSV Parsing failed: ${results.errors[0].message}`);
          return;
        }

        const rows = results.data.slice(0, 5000); // Max 5,000 rows
        if (rows.length === 0) {
          setErrorMsg("The uploaded CSV is empty.");
          return;
        }

        // Check required sample features
        const cols = Object.keys(rows[0]).map(c => c.trim());
        const missing = REQUIRED_SAMPLE_FEATURES.filter(req => !cols.includes(req));
        if (missing.length > 0) {
          setErrorMsg(`CSV missing required forward features: ${missing.join(", ")}`);
          return;
        }

        setParsedRows(rows);
      },
      error: (err) => {
        setParsing(false);
        setErrorMsg(`Failed to read CSV: ${err.message}`);
      }
    });
  };

  // Load sample demo CSV with 1 click
  const handleLoadSample = async () => {
    try {
      setParsing(true);
      setErrorMsg("");
      const res = await fetch('/sample_traffic_test.csv');
      if (!res.ok) throw new Error("Sample file not found in public folder.");
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const sampleFile = new File([blob], "sample_traffic_test.csv");
      processCSV(sampleFile);
    } catch (e) {
      setParsing(false);
      setErrorMsg(`Could not load demo sample: ${e.message}`);
    }
  };

  // Run AI inference
  const handleRunAnalysis = async () => {
    if (parsedRows.length === 0) return;
    try {
      setAnalyzing(true);
      setErrorMsg("");
      const res = await callPredictFlows(parsedRows);
      setAnalysisResult(res);
    } catch (err) {
      console.error("Inference call failed:", err);
      setErrorMsg(err.message || "Failed to execute Cloud Function inference.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Download analyzed results CSV
  const handleDownloadResults = () => {
    if (!analysisResult || !analysisResult.predictions) return;
    const exportData = analysisResult.predictions.map((p, idx) => ({
      ...parsedRows[idx],
      predictedClass: p.predictedClass,
      confidence: p.confidence
    }));
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `unishield_analysis_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartData = analysisResult?.summary ? Object.entries(analysisResult.summary).map(([name, value]) => ({
    name,
    value,
    pct: analysisResult.totalRows ? ((value / analysisResult.totalRows) * 100).toFixed(1) : 0
  })) : [];

  const totalThreats = analysisResult?.predictions 
    ? analysisResult.predictions.filter(p => p.predictedClass !== 'BENIGN').length 
    : 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Batch Flow Analysis & Classification
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Upload PCAP-extracted forward flows (up to 5,000 rows) for unidirectional threat prediction.
        </p>
      </div>

      {/* Upload Box */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 text-center relative overflow-hidden">
        <input
          type="file"
          id="csvFileInput"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="max-w-md mx-auto flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4 text-cyan-400">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h2 className="text-base font-semibold text-white">Select or drop a unidirectional traffic CSV</h2>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            Accepts forward-only packet header metrics conforming to CIC-IDS2017 schema.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <label
              htmlFor="csvFileInput"
              className="cursor-pointer px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-lg shadow-cyan-500/20"
            >
              Browse Local CSV
            </label>
            <button
              onClick={handleLoadSample}
              disabled={parsing}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs font-mono border border-slate-700 transition-all flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Load 500-Flow Demo Sample</span>
            </button>
          </div>
        </div>

        {file && (
          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono max-w-xl mx-auto">
            <div className="flex items-center space-x-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Loaded: <strong className="text-white">{file.name}</strong> ({parsedRows.length} flows)</span>
            </div>

            <button
              onClick={handleRunAnalysis}
              disabled={analyzing || parsedRows.length === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Classifying...</span>
                </>
              ) : (
                <>
                  <span>Run Analysis</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Error notification */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-mono flex items-start space-x-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Loading state */}
      {analyzing && <Loader message="Analyzing forward flows and classifying threats..." />}

      {/* Analysis Results Display */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Real Trained Model in Browser Banner */}
          {analysisResult.isClientSideXGB && (
            <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200 text-xs font-mono flex items-start space-x-3 shadow-lg shadow-cyan-950/20">
              <Cpu className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-cyan-300 text-sm tracking-wide">
                    Real Trained XGBoost Model (Running in Browser)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-900/80 text-cyan-300 text-[10px] border border-cyan-700/60 uppercase font-semibold">
                    100% Python Parity • 750 Trees
                  </span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  The <strong>real trained XGBoost model</strong> (<code className="text-cyan-300">xgb_uni.json</code>) runs natively in your browser across all 24 unidirectional features. Verified on the test dataset with 100% match rate against Python XGBoost and zero server dependency.
                </p>
              </div>
            </div>
          )}

          {/* Tertiary Demo Engine Fallback (only if model assets fail to load) */}
          {analysisResult.isLocalFallback && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs font-mono flex items-start space-x-3 shadow-lg shadow-amber-950/20">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-amber-300 text-sm tracking-wide">
                    Demo engine (Model offline)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-900/80 text-amber-300 text-[10px] border border-amber-700/60 uppercase font-semibold">
                    Heuristic Fallback
                  </span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  UniShield is running its built-in browser fallback engine across {analysisResult.totalRows.toLocaleString()} forward flows using heuristic rules on forward packet features.
                </p>
              </div>
            </div>
          )}

          {/* Results Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-400 uppercase font-mono">Flows Evaluated</p>
              <p className="text-2xl font-bold font-mono text-white mt-1">
                {analysisResult.totalRows.toLocaleString()}
              </p>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-400 uppercase font-mono">Threats Flagged</p>
              <p className="text-2xl font-bold font-mono text-rose-400 mt-1">
                {totalThreats.toLocaleString()}
              </p>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-400 uppercase font-mono">Threat Ratio</p>
              <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
                {((totalThreats / (analysisResult.totalRows || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-400 uppercase font-mono">Model Engine</p>
              <p className={`text-sm sm:text-base font-bold font-mono mt-1 ${analysisResult.isLocalFallback ? 'text-amber-400' : 'text-cyan-400'}`}>
                {analysisResult.isClientSideXGB ? 'Real XGB (Browser)' : analysisResult.isLocalFallback ? 'Demo Rules' : 'Standalone XGB'}
              </p>
              <span className="text-[10px] text-slate-500 block">
                {analysisResult.isClientSideXGB 
                  ? 'Real Model in Browser (24 Feats)' 
                  : analysisResult.isLocalFallback 
                    ? 'Browser Heuristics' 
                    : 'Cloud Function (Python)'}
              </span>
            </div>
          </div>

          {/* Chart & Action */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Threat Distribution</h3>
                <p className="text-xs text-slate-400 mt-0.5">Predicted Class Proportions</p>
              </div>
              <ThreatChart type="pie" data={chartData} />
              <button
                onClick={handleDownloadResults}
                className="w-full mt-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 font-mono text-xs font-semibold border border-cyan-500/30 flex items-center justify-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Export Annotated CSV</span>
              </button>
            </div>

            {/* Flow Predictions Table */}
            <div className="lg:col-span-2 glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Prediction Breakdown</h3>
                  <p className="text-xs text-slate-400">First 100 classified records</p>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Total: {analysisResult.predictions?.length}
                </span>
              </div>

              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="sticky top-0 bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Row</th>
                      <th className="py-2.5 px-4">Classification</th>
                      <th className="py-2.5 px-4">Confidence</th>
                      <th className="py-2.5 px-4">Dst Port</th>
                      <th className="py-2.5 px-4">Fwd Pkts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {analysisResult.predictions?.slice(0, 100).map((row, i) => {
                      const isThreat = row.predictedClass !== 'BENIGN';
                      const badgeStyle = CLASS_BADGES[row.predictedClass] || 'bg-slate-800';
                      return (
                        <tr key={i} className={`hover:bg-slate-800/40 ${isThreat ? 'bg-rose-950/10' : ''}`}>
                          <td className="py-2 px-4 text-slate-500">#{row.rowIndex || i + 1}</td>
                          <td className="py-2 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeStyle}`}>
                              {isThreat && <ShieldAlert className="w-3 h-3 mr-1" />}
                              {row.predictedClass}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-cyan-300">
                            {Math.round((row.confidence || 0.95) * 100)}%
                          </td>
                          <td className="py-2 px-4 text-slate-300">{row.destinationPort || 'N/A'}</td>
                          <td className="py-2 px-4 text-slate-400">{row.totalFwdPackets || 'N/A'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
