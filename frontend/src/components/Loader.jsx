import React from 'react';
import { Shield } from 'lucide-react';

export default function Loader({ message = "Analyzing unidirectional flows..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping"></div>
        <div className="absolute inset-0 rounded-full border-2 border-t-cyan-400 border-r-transparent border-b-cyan-600 border-l-transparent animate-spin"></div>
        <Shield className="w-7 h-7 text-cyan-400 animate-pulse" />
      </div>
      <p className="mt-4 text-sm font-mono text-slate-400">{message}</p>
    </div>
  );
}
