'use client';

import React from 'react';
import InfoTooltip from './InfoTooltip';

interface StrikeGex {
    strike: number;
    gex: number;
}

interface ExpirationGex {
    expiration: string;
    data: StrikeGex[];
}

interface GexHeatmapProps {
  data: ExpirationGex[];
  strikes: number[];
}

const GexHeatmap: React.FC<GexHeatmapProps> = ({ data, strikes }) => {
  if (!data || data.length === 0) return null;

  const maxGex = Math.max(...data.flatMap(d => d.data.map(s => Math.abs(s.gex))), 1);

  const getColor = (gex: number) => {
      if (Math.abs(gex) < 1) return 'transparent';
      const alpha = Math.min(Math.abs(gex) / (maxGex * 0.3), 1); 
      if (gex >= 0) return `rgba(34, 197, 94, ${alpha})`; 
      return `rgba(239, 68, 68, ${alpha})`; 
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold text-gray-400 uppercase flex items-center">
          GEX Concentration Heatmap
          <InfoTooltip content="Visualizes Gamma Exposure across both Strike and Expiration. Darker green indicates large positive GEX (support/stability); darker red indicates large negative GEX (accelerated moves)." />
        </h3>
      </div>
      <div className="overflow-x-auto bg-gray-50 p-6 rounded-lg border border-gray-200">
        <div className="min-w-max">
          {/* Header: Strikes */}
          <div className="flex mb-4">
              <div className="w-28 shrink-0" />
              {strikes.map((s, i) => (
                  i % 2 === 0 ? (
                    <div key={s} className="w-10 text-[9px] font-mono text-gray-400 -rotate-45 h-10 flex items-end justify-center">
                        {s}
                    </div>
                  ) : <div key={s} className="w-10" />
              ))}
          </div>

          {/* Rows: Expiries */}
          {data.map(row => (
              <div key={row.expiration} className="flex items-center h-6">
                  <div className="w-28 shrink-0 text-[10px] font-bold text-gray-500 font-mono">{row.expiration}</div>
                  <div className="flex">
                    {row.data.map((d, i) => (
                        <div 
                            key={i} 
                            className="w-10 h-6 border-[0.5px] border-gray-200 relative group cursor-crosshair hover:border-blue-500 transition-colors"
                            style={{ backgroundColor: getColor(d.gex) }}
                        >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 bg-gray-900 text-white text-[9px] p-2 rounded shadow-xl whitespace-nowrap pointer-events-none">
                                <p className="font-bold border-b border-gray-700 pb-1 mb-1">{row.expiration}</p>
                                <p>Strike: {d.strike}</p>
                                <p>GEX: ${d.gex.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                            </div>
                        </div>
                    ))}
                  </div>
              </div>
          ))}
          
          <div className="mt-8 flex justify-center gap-8 text-[10px] font-bold uppercase text-gray-400">
             <div className="flex items-center gap-2">
                <span>Negative GEX</span>
                <div className="w-24 h-2 bg-gradient-to-r from-red-600 to-transparent rounded-full" />
                <span>Zero</span>
                <div className="w-24 h-2 bg-gradient-to-r from-transparent to-green-600 rounded-full" />
                <span>Positive GEX</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GexHeatmap;
