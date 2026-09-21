import React from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, Activity, UploadCloud, AlertTriangle, Cpu, Radio } from 'lucide-react';

export default function Navbar({ authUser }) {
  const navItems = [
    { name: 'Overview', path: '/', icon: Activity },
    { name: 'Live Monitor', path: '/live-monitor', icon: Radio },
    { name: 'Analyze', path: '/analyze', icon: UploadCloud },
    { name: 'Alerts', path: '/alerts', icon: AlertTriangle },
    { name: 'Model Performance', path: '/model-performance', icon: Cpu },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#070b14]/85 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <NavLink to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/10 group-hover:border-cyan-400 transition-all">
              <Shield className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
                  UniShield
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  AI IDS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5 font-mono">Unidirectional Traffic Defense</p>
            </div>
          </NavLink>

          {/* Nav Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Connection Status Badge */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700/60 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300 hidden sm:inline">Forward Traffic:</span>
              <span className="text-cyan-400 font-semibold">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Nav Links */}
      <div className="md:hidden border-t border-slate-800 px-4 py-2 flex items-center justify-between overflow-x-auto space-x-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </div>
    </header>
  );
}
