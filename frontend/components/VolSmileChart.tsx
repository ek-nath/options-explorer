'use client';

import React from 'react';
import InfoTooltip from './InfoTooltip';

interface StrikeData {
  strike: number;
  call_iv?: number;
  put_iv?: number;
}

interface VolSmileChartProps {
  strikes: StrikeData[];
  spotPrice: number;
}

const VolSmileChart: React.FC<VolSmileChartProps> = ({ strikes, spotPrice }) => {
  if (!strikes || strikes.length === 0) return null;

  // Filter strikes around spot for the smile
  const filtered = strikes.filter(s => s.strike >= spotPrice * 0.7 && s.strike <= spotPrice * 1.3);
  
  const width = 800;
  const height = 300;
  const padding = 50;

  const minStrike = Math.min(...filtered.map(s => s.strike));
  const maxStrike = Math.max(...filtered.map(s => s.strike));
  const validIvs = filtered.flatMap(s => [s.call_iv, s.put_iv]).filter((v): v is number => !!v && v > 0);
  const maxIv = Math.max(...validIvs, 0.5);
  const minIv = Math.min(...validIvs, 0);

  const getX = (strike: number) => padding + ((strike - minStrike) / (maxStrike - minStrike || 1)) * (width - 2 * padding);
  const getY = (iv: number) => height - padding - ((iv - minIv) / (maxIv - minIv || 0.1)) * (height - 2 * padding);

  const callData = filtered.filter(s => (s.call_iv ?? 0) > 0);
  const putData = filtered.filter(s => (s.put_iv ?? 0) > 0);

  const callPoints = callData.map(s => `${getX(s.strike)},${getY(s.call_iv!)}`).join(' ');
  const putPoints = putData.map(s => `${getX(s.strike)},${getY(s.put_iv!)}`).join(' ');

  return (
    <div className="w-full bg-white rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase flex items-center">
          Volatility Smile / Skew
          <InfoTooltip content="Plots Implied Volatility against Strike Price. Typically, out-of-the-money puts have higher IV than at-the-money options, creating a 'smile' or 'smirk' that reflects market fear of tail risk." />
        </h3>
        <div className="flex gap-4 text-[10px] font-bold uppercase">
          <span className="text-green-600 flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full" /> Call IV</span>
          <span className="text-red-600 flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full" /> Put IV</span>
        </div>
      </div>
      <div className="relative" style={{ height: `${height}px` }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {/* Grid Lines */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#f3f4f6" strokeWidth="1" />
          
          {/* Spot Line */}
          <line x1={getX(spotPrice)} y1={padding} x2={getX(spotPrice)} y2={height - padding} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" />
          <text x={getX(spotPrice)} y={padding - 10} fontSize="10" fill="#3b82f6" textAnchor="middle" fontWeight="bold">SPOT: {spotPrice.toFixed(2)}</text>

          {/* Curves */}
          <polyline fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" points={callPoints} />
          <polyline fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" points={putPoints} />

          {/* Points */}
          {callData.map((s, i) => (
            <circle key={`c-${i}`} cx={getX(s.strike)} cy={getY(s.call_iv!)} r="2" fill="#22c55e" />
          ))}
          {putData.map((s, i) => (
            <circle key={`p-${i}`} cx={getX(s.strike)} cy={getY(s.put_iv!)} r="2" fill="#ef4444" />
          ))}

          {/* Axis Labels */}
          <text x={padding} y={height - 10} fontSize="10" fill="#9ca3af" textAnchor="middle">{minStrike.toFixed(0)}</text>
          <text x={width - padding} y={height - 10} fontSize="10" fill="#9ca3af" textAnchor="middle">{maxStrike.toFixed(0)}</text>
          <text x={width / 2} y={height - 10} fontSize="10" fill="#9ca3af" textAnchor="middle">Strike Price</text>
        </svg>
      </div>
    </div>
  );
};

export default VolSmileChart;
