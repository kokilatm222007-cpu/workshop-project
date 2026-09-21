import React from 'react';
import { ShieldAlert, CheckCircle2, Radio, UploadCloud } from 'lucide-react';

const CLASS_BADGES = {
  BENIGN: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  DOS_DDOS: 'bg-rose-500/15 text-rose-400 border-rose-500/40 animate-pulse',
  PORT_SCAN: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  BRUTE_FORCE: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  BOTNET: 'bg-purple-500/15 text-purple-400 border-purple-500/40'
};

export default function AlertTable({ alerts = [], showSource = true }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/30 rounded-xl border border-slate-800">
        <CheckCircle2 className="w-10 h-10 text-emerald-400/60 mx-auto mb-2" />
        <p className="text-sm text-slate-300 font-medium">No threats detected</p>
        <p className="text-xs text-slate-500 mt-1">All monitored traffic streams are normal.</p>
      </div>
    );
  }

  const formatTime = (ts) => {
    if (!ts) return 'Just now';
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs font-mono">
        <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
          <tr>
            <th className="py-3 px-4">Time</th>
            <th className="py-3 px-4">Threat Class</th>
            <th className="py-3 px-4">Confidence</th>
            <th className="py-3 px-4">Dst Port</th>
            <th className="py-3 px-4">Fwd Pkts</th>
            <th className="py-3 px-4">Duration</th>
            {showSource && <th className="py-3 px-4">Source</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 text-slate-200">
          {alerts.map((alert, idx) => {
            const badgeStyle = CLASS_BADGES[alert.predictedClass] || 'bg-slate-800 text-slate-300 border-slate-700';
            const isThreat = alert.predictedClass !== 'BENIGN';
            const confPct = Math.round((alert.confidence || 0.9) * 100);

            return (
              <tr key={alert.id || alert.alertId || idx} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                  {formatTime(alert.timestamp)}
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeStyle}`}>
                    {isThreat && <ShieldAlert className="w-3 h-3 mr-1" />}
                    {alert.predictedClass}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${confPct > 90 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                        style={{ width: `${confPct}%` }}
                      ></div>
                    </div>
                    <span className="text-slate-300">{confPct}%</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-cyan-400">
                  {alert.destinationPort || 80}
                </td>
                <td className="py-3 px-4 text-slate-300">
                  {alert.totalFwdPackets || 1}
                </td>
                <td className="py-3 px-4 text-slate-400">
                  {alert.flowDuration ? `${alert.flowDuration.toLocaleString()} μs` : 'N/A'}
                </td>
                {showSource && (
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                      alert.source === 'upload' 
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {alert.source === 'upload' ? (
                        <><UploadCloud className="w-2.5 h-2.5 mr-1" /> Upload</>
                      ) : (
                        <><Radio className="w-2.5 h-2.5 mr-1" /> Replay</>
                      )}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
