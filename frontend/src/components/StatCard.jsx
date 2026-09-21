import React from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'cyan', trend }) {
  const colorMap = {
    cyan: 'from-cyan-500/20 to-cyan-500/5 text-cyan-400 border-cyan-500/30 shadow-cyan-500/10',
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/30 shadow-rose-500/10',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30 shadow-amber-500/10',
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/30 shadow-blue-500/10',
    violet: 'from-violet-500/20 to-violet-500/5 text-violet-400 border-violet-500/30 shadow-violet-500/10',
  };

  const selectedColor = colorMap[color] || colorMap.cyan;

  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
      {/* Subtle background glow */}
      <div className={`absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-gradient-to-br ${selectedColor} blur-2xl opacity-40 group-hover:opacity-70 transition-opacity`}></div>
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 tracking-wider uppercase">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1.5 font-mono tracking-tight">
            {value}
          </h3>
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl bg-gradient-to-br ${selectedColor} border`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-slate-400">{subtitle}</span>
        {trend && (
          <span className="font-medium font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
