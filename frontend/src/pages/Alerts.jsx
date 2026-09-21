import React, { useState, useEffect } from 'react';
import { AlertTriangle, Filter, ChevronLeft, ChevronRight, ShieldAlert, Download } from 'lucide-react';
import AlertTable from '../components/AlertTable';
import Loader from '../components/Loader';
import { fetchAlerts } from '../services/firebase';

const FILTER_CLASSES = ["ALL", "DOS_DDOS", "PORT_SCAN", "BRUTE_FORCE", "BOTNET"];

export default function Alerts() {
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [alerts, setAlerts] = useState([]);
  const [pageHistory, setPageHistory] = useState([]); // stack of cursor docs
  const [currentCursor, setCurrentCursor] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  const loadAlertPage = async (cls, cursor = null) => {
    try {
      setLoading(true);
      const res = await fetchAlerts(cls, 25, cursor);
      setAlerts(res.alerts || []);
      setNextCursor(res.lastDoc || null);
    } catch (err) {
      console.error("Error loading alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset pagination on filter change
    setPageHistory([]);
    setCurrentCursor(null);
    setPageNumber(1);
    loadAlertPage(selectedClass, null);
  }, [selectedClass]);

  const handleNextPage = () => {
    if (!nextCursor) return;
    setPageHistory((prev) => [...prev, currentCursor]);
    setCurrentCursor(nextCursor);
    setPageNumber((p) => p + 1);
    loadAlertPage(selectedClass, nextCursor);
  };

  const handlePrevPage = () => {
    if (pageHistory.length === 0) return;
    const prevCursor = pageHistory[pageHistory.length - 1];
    setPageHistory((prev) => prev.slice(0, -1));
    setCurrentCursor(prevCursor);
    setPageNumber((p) => Math.max(1, p - 1));
    loadAlertPage(selectedClass, prevCursor);
  };

  const exportAlertsCSV = () => {
    if (alerts.length === 0) return;
    const headers = ["timestamp", "predictedClass", "confidence", "destinationPort", "totalFwdPackets", "flowDuration", "source"];
    const csvRows = [
      headers.join(","),
      ...alerts.map((a) => [
        a.timestamp,
        a.predictedClass,
        a.confidence,
        a.destinationPort,
        a.totalFwdPackets,
        a.flowDuration,
        a.source
      ].join(","))
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `unishield_alerts_page_${pageNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Threat Alerts & Incident Log
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Indexed by predictedClass + timestamp descending • 25 incidents per page
          </p>
        </div>

        <button
          onClick={exportAlertsCSV}
          disabled={alerts.length === 0}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium border border-slate-700 transition-all self-start md:self-auto disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-cyan-400" />
          <span>Export Page to CSV</span>
        </button>
      </div>

      {/* Class Filters */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-slate-400 mr-1 shrink-0" />
        <span className="text-xs text-slate-400 font-mono mr-2 shrink-0">Filter:</span>
        {FILTER_CLASSES.map((cls) => (
          <button
            key={cls}
            onClick={() => setSelectedClass(cls)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
              selectedClass === cls
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            {cls.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Table Container */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {loading ? (
          <Loader message="Querying Firestore alert logs..." />
        ) : (
          <AlertTable alerts={alerts} showSource={true} />
        )}

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">
            Page <strong className="text-white">{pageNumber}</strong> • Showing {alerts.length} alerts
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevPage}
              disabled={pageHistory.length === 0 || loading}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            <button
              onClick={handleNextPage}
              disabled={!nextCursor || loading}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
