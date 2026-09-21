import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Navbar from './components/Navbar';
import Overview from './pages/Overview';
import LiveMonitor from './pages/LiveMonitor';
import Analyze from './pages/Analyze';
import Alerts from './pages/Alerts';
import ModelPerformance from './pages/ModelPerformance';
import { initAuth } from './services/firebase';

export default function App() {
  const [authUser, setAuthUser] = useState(null);

  useEffect(() => {
    // Silent anonymous auth init
    initAuth().then((user) => {
      setAuthUser(user);
    });
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#070b14] bg-cyber-grid text-slate-100 flex flex-col font-sans">
        <Navbar authUser={authUser} />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/live-monitor" element={<LiveMonitor />} />
            <Route path="/live" element={<LiveMonitor />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/model-performance" element={<ModelPerformance />} />
            <Route path="/performance" element={<ModelPerformance />} />
          </Routes>
        </main>

        <footer className="border-t border-slate-800/80 bg-[#070b14]/90 py-6 text-center text-xs font-mono text-slate-400">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>UniShield • AI-Based Cyber Threat Detection in Unidirectional IP Traffic</span>
            <span>Built with Google Antigravity & Firebase</span>
          </div>
        </footer>

        <ToastContainer
          position="bottom-right"
          theme="dark"
          autoClose={3000}
          hideProgressBar={false}
          toastClassName="!bg-slate-900 !border !border-slate-700 !text-slate-200 font-mono text-xs"
        />
      </div>
    </BrowserRouter>
  );
}
