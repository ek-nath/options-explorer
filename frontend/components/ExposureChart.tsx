'use client';

import React, { useState } from 'react';

interface StrikeData {
  strike: number;
  gex: number;
  dex: number;
  call_oi?: number;
  put_oi?: number;
  call_vol?: number;
  put_vol?: number;
}

interface ExposureChartProps {
  strikes: StrikeData[];
  spotPrice: number;
}

const ExposureChart: React.FC<ExposureChartProps> = ({ strikes, spotPrice }) => {
  const [mode, setMode] = useState<'exposure' | 'positioning'>('exposure');

  if (!strikes || strikes.length === 0) return null;

  // Filter strikes around spot price for better visibility
  const filteredStrikes = strikes.filter(s => s.strike >= spotPrice * 0.8 && s.strike <= spotPrice * 1.2);
  
  const maxGex = Math.max(...filteredStrikes.map(s => Math.abs(s.gex)), 1);
  const maxDex = Math.max(...filteredStrikes.map(s => Math.abs(s.dex)), 1);
  
  const maxOi = Math.max(...filteredStrikes.map(s => Math.max(s.call_oi || 0, s.put_oi || 0)), 1);
  const maxVol = Math.max(...filteredStrikes.map(s => Math.max(s.call_vol || 0, s.put_vol || 0)), 1);

  const formatValue = (val: number) => {
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (absVal >= 1e9) return sign + (absVal / 1e9).toFixed(2) + 'B';
    if (absVal >= 1e6) return sign + (absVal / 1e6).toFixed(1) + 'M';
    if (absVal >= 1e3) return sign + (absVal / 1e3).toFixed(1) + 'K';
    return sign + absVal.toFixed(0);
  };

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
        <button 
          onClick={() => setMode('exposure')}
          className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${mode === 'exposure' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Exposure (GEX/DEX)
        </button>
        <button 
          onClick={() => setMode('positioning')}
          className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${mode === 'positioning' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Positioning (Vol/OI)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {mode === 'exposure' ? (
          <>
            <div>
              <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Gamma Exposure (GEX $)</h3>
              <div className="space-y-1 bg-gray-50 p-2 rounded border max-h-80 overflow-y-auto">
                {filteredStrikes.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className="w-8 font-mono text-gray-600">{s.strike}</span>
                    <div className="flex-1 h-3 bg-gray-200 rounded-sm overflow-hidden relative">
                      <div 
                        className={`h-full ${s.gex >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${(Math.abs(s.gex) / maxGex) * 100}%` }}
                      />
                    </div>
                    <span className="w-14 text-right font-mono text-gray-700">{formatValue(s.gex)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Delta Exposure (DEX $)</h3>
              <div className="space-y-1 bg-gray-50 p-2 rounded border max-h-80 overflow-y-auto">
                {filteredStrikes.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className="w-8 font-mono text-gray-600">{s.strike}</span>
                    <div className="flex-1 h-3 bg-gray-200 rounded-sm overflow-hidden relative">
                      <div 
                        className={`h-full ${s.dex >= 0 ? 'bg-blue-500' : 'bg-indigo-500'}`}
                        style={{ width: `${(Math.abs(s.dex) / maxDex) * 100}%` }}
                      />
                    </div>
                    <span className="w-14 text-right font-mono text-gray-700">{formatValue(s.dex)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Calls (Volume vs OI)</h3>
              <div className="space-y-1 bg-gray-50 p-2 rounded border max-h-80 overflow-y-auto">
                {filteredStrikes.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className="w-8 font-mono text-gray-600">{s.strike}</span>
                    <div className="flex-1 h-3 bg-gray-200 rounded-sm relative">
                      {/* OI Bar (Hollow) */}
                      <div 
                        className="absolute inset-y-0 left-0 border border-green-400 bg-green-50 opacity-50 rounded-sm"
                        style={{ width: `${((s.call_oi || 0) / maxOi) * 100}%` }}
                      />
                      {/* Volume Bar (Solid) */}
                      <div 
                        className="absolute inset-y-0 left-0 bg-green-500 rounded-sm z-10"
                        style={{ width: `${((s.call_vol || 0) / maxVol) * 100}%` }}
                      />
                    </div>
                    <span className="w-14 text-right font-mono text-gray-700">{formatValue(s.call_vol || 0)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Puts (Volume vs OI)</h3>
              <div className="space-y-1 bg-gray-50 p-2 rounded border max-h-80 overflow-y-auto">
                {filteredStrikes.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className="w-8 font-mono text-gray-600">{s.strike}</span>
                    <div className="flex-1 h-3 bg-gray-200 rounded-sm relative">
                      {/* OI Bar (Hollow) */}
                      <div 
                        className="absolute inset-y-0 left-0 border border-red-400 bg-red-50 opacity-50 rounded-sm"
                        style={{ width: `${((s.put_oi || 0) / maxOi) * 100}%` }}
                      />
                      {/* Volume Bar (Solid) */}
                      <div 
                        className="absolute inset-y-0 left-0 bg-red-500 rounded-sm z-10"
                        style={{ width: `${((s.put_vol || 0) / maxVol) * 100}%` }}
                      />
                    </div>
                    <span className="w-14 text-right font-mono text-gray-700">{formatValue(s.put_vol || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ExposureChart;
