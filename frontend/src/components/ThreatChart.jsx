import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line
} from 'recharts';

const CLASS_COLORS = {
  BENIGN: '#10b981',
  DOS_DDOS: '#f43f5e',
  PORT_SCAN: '#06b6d4',
  BRUTE_FORCE: '#f59e0b',
  BOTNET: '#8b5cf6'
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-xl backdrop-blur-md text-xs font-mono">
        <p className="font-semibold text-white mb-1">{data.name || data.payload.name || data.payload.seq}</p>
        <p className="text-cyan-400">
          Value: <span className="text-white font-bold">{data.value.toLocaleString()}</span>
        </p>
        {data.payload.pct && (
          <p className="text-slate-400">Percentage: {data.payload.pct}%</p>
        )}
      </div>
    );
  }
  return null;
};

export default function ThreatChart({ type = 'pie', data = [] }) {
  if (type === 'pie') {
    if (!data || data.length === 0) {
      return (
        <div className="h-64 w-full flex items-center justify-center text-xs font-mono text-slate-500">
          Loading class distribution...
        </div>
      );
    }

    return (
      <div className="w-full">
        <div className="h-56 w-full" style={{ minHeight: '224px' }}>
          <ResponsiveContainer width="100%" height={224} minHeight={224}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
                isAnimationActive={false}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CLASS_COLORS[entry.name] || '#64748b'} 
                    stroke="#070b14" 
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Class Breakdown List */}
        <div className="mt-2 space-y-1.5 pt-2 border-t border-slate-800/80">
          {data.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-[11px] font-mono">
              <div className="flex items-center space-x-2">
                <span 
                  className="w-2.5 h-2.5 rounded-full shrink-0" 
                  style={{ backgroundColor: CLASS_COLORS[item.name] || '#64748b' }} 
                />
                <span className="text-slate-300 font-medium">{item.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-slate-400">{item.value.toLocaleString()} flows</span>
                <span className="text-cyan-400 font-bold w-12 text-right">{item.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'line') {
    return (
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="tick" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="threats"
              stroke="#f43f5e"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#f43f5e' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}
