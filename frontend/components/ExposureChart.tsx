'use client';

import React from 'react';

interface ExposureChartProps {
  strikes: any[];
  spotPrice: number;
}

const ExposureChart: React.FC<ExposureChartProps> = ({ strikes, spotPrice }) => {
  if (!strikes || strikes.length === 0) return null;

  // Filter strikes around spot price for better visibility
  const filteredStrikes = strikes.filter(s => s.strike >= spotPrice * 0.8 && s.strike <= spotPrice * 1.2);
  
  const maxGex = Math.max(...filteredStrikes.map(s => Math.abs(s.gex)), 1); // Avoid div by zero
  const maxDex = Math.max(...filteredStrikes.map(s => Math.abs(s.dex)), 1);

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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2 uppercase">Gamma Exposure (GEX $)</h3>
          <div className="space-y-1 bg-gray-50 p-2 rounded border max-h-64 overflow-y-auto">
            {filteredStrikes.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-8 font-mono">{s.strike}</span>
                <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden relative">
                  <div 
                    className={`h-full ${s.gex >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ 
                      width: `${(Math.abs(s.gex) / maxGex) * 100}%`
                    }}
                  />
                </div>
                <span className="w-16 text-right font-mono">{formatValue(s.gex)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2 uppercase">Delta Exposure (DEX $)</h3>
          <div className="space-y-1 bg-gray-50 p-2 rounded border max-h-64 overflow-y-auto">
            {filteredStrikes.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-8 font-mono">{s.strike}</span>
                <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden relative">
                  <div 
                    className={`h-full ${s.dex >= 0 ? 'bg-blue-500' : 'bg-indigo-500'}`}
                    style={{ 
                      width: `${(Math.abs(s.dex) / maxDex) * 100}%`
                    }}
                  />
                </div>
                <span className="w-16 text-right font-mono">{formatValue(s.dex)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExposureChart;
