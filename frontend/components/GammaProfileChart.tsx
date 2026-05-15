'use client';

import React from 'react';

interface GammaProfileChartProps {
  profile: { price: number; gex: number }[];
  spotPrice: number;
}

const GammaProfileChart: React.FC<GammaProfileChartProps> = ({ profile, spotPrice }) => {
  if (!profile || profile.length === 0) return null;

  const width = 800;
  const height = 300;
  const padding = 40;

  const minPrice = Math.min(...profile.map(p => p.price));
  const maxPrice = Math.max(...profile.map(p => p.price));
  const maxGex = Math.max(...profile.map(p => Math.abs(p.gex)), 1);

  const getX = (price: number) => padding + ((price - minPrice) / (maxPrice - minPrice)) * (width - 2 * padding);
  const getY = (gex: number) => (height / 2) - (gex / maxGex) * (height / 2 - padding);

  const points = profile.map(p => `${getX(p.price)},${getY(p.gex)}`).join(' ');
  const spotX = getX(spotPrice);

  return (
    <div className="w-full bg-white rounded-lg p-4">
      <div className="relative" style={{ height: `${height}px` }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {/* Zero Line */}
          <line 
            x1={padding} 
            y1={height / 2} 
            x2={width - padding} 
            y2={height / 2} 
            stroke="#e5e7eb" 
            strokeWidth="1" 
          />
          
          {/* Spot Line */}
          <line 
            x1={spotX} 
            y1={padding} 
            x2={spotX} 
            y2={height - padding} 
            stroke="#3b82f6" 
            strokeWidth="2" 
            strokeDasharray="4"
          />
          <text x={spotX + 5} y={padding + 15} fontSize="12" fill="#3b82f6" fontWeight="bold">SPOT: {spotPrice.toFixed(2)}</text>

          {/* GEX Curve Area */}
          <path
            d={`M ${getX(profile[0].price)} ${height / 2} ${profile.map(p => `L ${getX(p.price)} ${getY(p.gex)}`).join(' ')} L ${getX(profile[profile.length-1].price)} ${height / 2} Z`}
            fill="rgba(59, 130, 246, 0.1)"
          />

          {/* GEX Curve Line */}
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points={points}
          />

          {/* Labels */}
          <text x={padding} y={height / 2 - 5} fontSize="10" fill="#9ca3af">LONG GAMMA</text>
          <text x={padding} y={height / 2 + 15} fontSize="10" fill="#9ca3af">SHORT GAMMA</text>
          
          <text x={padding} y={height - 5} fontSize="10" fill="#9ca3af">{minPrice.toFixed(0)}</text>
          <text x={width - padding} y={height - 5} fontSize="10" fill="#9ca3af" textAnchor="end">{maxPrice.toFixed(0)}</text>
        </svg>
      </div>
      <div className="mt-2 text-center text-xs text-gray-500 italic">
        The GEX Curve shows simulated net exposure across price levels. The zero-crossing is the Gamma Flip.
      </div>
    </div>
  );
};

export default GammaProfileChart;
