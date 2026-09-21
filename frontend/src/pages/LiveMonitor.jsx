import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Radio, ShieldAlert, CheckCircle2, Activity } from 'lucide-react';
import ThreatChart from '../components/ThreatChart';
import { fetchSimulationChunk } from '../services/firebase';

const CLASS_BADGES = {
  BENIGN: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  DOS_DDOS: 'bg-rose-500/15 text-rose-400 border-rose-500/40',
  PORT_SCAN: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  BRUTE_FORCE: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  BOTNET: 'bg-purple-500/15 text-purple-400 border-purple-500/40'
};

export default function LiveMonitor() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [chunkNum, setChunkNum] = useState(1);
  const [revealedFlows, setRevealedFlows] = useState([]);
  const [currentChunkBuffer, setCurrentChunkBuffer] = useState([]);
  const [bufferIndex, setBufferIndex] = useState(0);
  const [totalMonitored, setTotalMonitored] = useState(0);
  const [threatCount, setThreatCount] = useState(0);
  const [threatHistory, setThreatHistory] = useState([
    { tick: 'T-0', threats: 0 }
  ]);
  const [tick, setTick] = useState(0);

  const timerRef = useRef(null);

  // Load a chunk into buffer
  const loadChunk = async (cNum) => {
    try {
      const data = await fetchSimulationChunk(cNum);
      if (data && data.flows && data.flows.length > 0) {
        setCurrentChunkBuffer(data.flows);
        setBufferIndex(0);
      }
    } catch (err) {
      console.warn("Error fetching chunk:", err);
    }
  };

  // Initial load of Chunk 1
  useEffect(() => {
    loadChunk(1);
  }, []);

  // Tick timer: reveal 20 flows every 2 seconds
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setTick((prevTick) => {
          const nextTick = prevTick + 1;
          
          setBufferIndex((prevIdx) => {
            // If buffer has flows to reveal
            if (currentChunkBuffer.length > 0) {
              const nextSlice = currentChunkBuffer.slice(prevIdx, prevIdx + 20);
              if (nextSlice.length > 0) {
                setRevealedFlows((prev) => [...nextSlice, ...prev].slice(0, 100));
                setTotalMonitored((t) => t + nextSlice.length);
                
                const newThreats = nextSlice.filter((f) => f.predictedClass !== 'BENIGN').length;
                setThreatCount((tc) => tc + newThreats);

                setThreatHistory((prevHist) => [
                  ...prevHist.slice(-15),
                  { tick: `T-${nextTick}`, threats: newThreats }
                ]);
              }

              const newIndex = prevIdx + 20;
              // If reached end of current chunk buffer (100 flows), advance to next chunk
              if (newIndex >= currentChunkBuffer.length) {
                const nextChunk = chunkNum >= 20 ? 1 : chunkNum + 1;
                setChunkNum(nextChunk);
                loadChunk(nextChunk);
                return 0;
              }
              return newIndex;
            }
            return prevIdx;
          });

          return nextTick;
        });
      }, 2000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentChunkBuffer, chunkNum]);

  const handleStart = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleReset = () => {
    setIsPlaying(false);
    setChunkNum(1);
    setBufferIndex(0);
    setRevealedFlows([]);
    setTotalMonitored(0);
    setThreatCount(0);
    setTick(0);
    setThreatHistory([{ tick: 'T-0', threats: 0 }]);
    loadChunk(1);
  };

  const threatPct = totalMonitored > 0 ? ((threatCount / totalMonitored) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Controls */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Radio className={`w-5 h-5 ${isPlaying ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Live Stream Telemetry Replay
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Quota-friendly chunk batching: 1 chunk (100 flows) fetched on-demand • 20 flows emitted / 2s
          </p>
        </div>

        {/* Player Controls */}
        <div className="flex items-center space-x-3">
          {!isPlaying ? (
            <button
              onClick={handleStart}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-lg shadow-cyan-500/20"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Stream</span>
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-lg shadow-amber-500/20"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause</span>
            </button>
          )}

          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs font-mono border border-slate-700 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Live Status Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <p className="text-xs font-mono text-slate-400 uppercase">Current Chunk</p>
          <p className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            #{chunkNum} <span className="text-xs text-slate-500 font-normal">/ 20</span>
          </p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <p className="text-xs font-mono text-slate-400 uppercase">Streamed Flows</p>
          <p className="text-2xl font-bold font-mono text-white mt-1">
            {totalMonitored.toLocaleString()}
          </p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <p className="text-xs font-mono text-slate-400 uppercase">Threats Detected</p>
          <p className="text-2xl font-bold font-mono text-rose-400 mt-1">
            {threatCount.toLocaleString()}
          </p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <p className="text-xs font-mono text-slate-400 uppercase">Incident Density</p>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {threatPct}%
          </p>
        </div>
      </div>

      {/* Rolling Threats Line Chart */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400" />
            Rolling Threat Frequency (Incidents per 2-Second Tick)
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            {isPlaying ? '● Streaming Active' : '○ Paused'}
          </span>
        </div>
        <ThreatChart type="line" data={threatHistory} />
      </div>

      {/* Replay Stream Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Forward Telemetry Stream</h2>
            <p className="text-xs text-slate-400">Displaying most recent 100 emitted flows</p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Status: <strong className={isPlaying ? "text-emerald-400" : "text-amber-400"}>{isPlaying ? "PLAYING" : "PAUSED"}</strong>
          </span>
        </div>

        {revealedFlows.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            Stream is paused. Click <strong className="text-cyan-400">"Start Stream"</strong> above to begin telemetry replay.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Seq</th>
                  <th className="py-2.5 px-4">Predicted Class</th>
                  <th className="py-2.5 px-4">Confidence</th>
                  <th className="py-2.5 px-4">True Label</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Dst Port</th>
                  <th className="py-2.5 px-4">Fwd Pkts</th>
                  <th className="py-2.5 px-4">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {revealedFlows.map((flow) => {
                  const isThreat = flow.predictedClass !== 'BENIGN';
                  const isCorrect = flow.predictedClass === flow.trueLabel;
                  const badgeStyle = CLASS_BADGES[flow.predictedClass] || 'bg-slate-800 text-slate-400';

                  return (
                    <tr
                      key={flow.seq}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isThreat ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 text-slate-500">#{flow.seq}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeStyle}`}>
                          {isThreat && <ShieldAlert className="w-3 h-3 mr-1" />}
                          {flow.predictedClass}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-cyan-300">
                        {Math.round((flow.confidence || 0.95) * 100)}%
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        {flow.trueLabel}
                      </td>
                      <td className="py-2.5 px-4">
                        {isCorrect ? (
                          <span className="inline-flex items-center text-[10px] text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Match
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] text-amber-400 font-semibold">
                            Mismatch
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300">{flow.destinationPort}</td>
                      <td className="py-2.5 px-4 text-slate-400">{flow.totalFwdPackets}</td>
                      <td className="py-2.5 px-4 text-slate-500">{flow.flowDuration} μs</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
