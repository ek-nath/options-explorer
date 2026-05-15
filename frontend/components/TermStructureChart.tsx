'use client';

import React from 'react';

interface TermStructureChartProps {
  data: { date: string; days_to_expiry: number; iv: number }[];
}

const TermStructureChart: React.FC<TermStructureChartProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const width = 600;
  const height = 300;
  const padding = 50;

  const minDays = Math.min(...data.map(d => d.days_to_expiry));
  const maxDays = Math.max(...data.map(d => d.days_to_expiry));
  const minIv = Math.min(...data.map(d => d.iv));
  const maxIv = Math.max(...data.map(d => d.iv));

  const getX = (days: number) => padding + ((days - minDays) / (maxDays - minDays || 1)) * (width - 2 * padding);
  const getY = (iv: number) => height - padding - ((iv - minIv) / (maxIv - minIv || 1)) * (height - 2 * padding);

  const points = data.map(d => `${getX(d.days_to_expiry)},${getY(d.iv)}`).join(' ');
  
  // Identify Contango vs Backwardation
  const isBackwardation = data.length > 1 && data[0].iv > data[data.length-1].iv;

  return (
    <div className="w-full bg-white rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase">ATM IV Term Structure</h3>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isBackwardation ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {isBackwardation ? 'Backwardation' : 'Contango'}
        </span>
      </div>
      <div className="relative" style={{ height: `${height}px` }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {/* Grid Lines */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e5e7eb" strokeWidth="1" />

          {/* Curve */}
          <polyline
            fill="none"
            stroke={isBackwardation ? "#ef4444" : "#10b981"}
            strokeWidth="3"
            strokeLinejoin="round"
            points={points}
          />
          
          {/* Data Points */}
          {data.map((d, i) => (
            <g key={i}>
              <circle 
                cx={getX(d.days_to_expiry)} 
                cy={getY(d.iv)} 
                r="4" 
                fill="white" 
                stroke={isBackwardation ? "#ef4444" : "#10b981"} 
                strokeWidth="2" 
              />
              <text 
                x={getX(d.days_to_expiry)} 
                y={getY(d.iv) - 10} 
                fontSize="10" 
                fill="#374151" 
                textAnchor="middle"
                fontWeight="bold"
              >
                {(d.iv * 100).toFixed(1)}%
              </text>
              <text 
                x={getX(d.days_to_expiry)} 
                y={height - padding + 20} 
                fontSize="10" 
                fill="#9ca3af" 
                textAnchor="middle"
              >
                {d.days_to_expiry}d
              </text>
            </g>
          ))}
          
          {/* Axis Labels */}
          <text x={width / 2} y={height - 5} fontSize="10" fill="#9ca3af" textAnchor="middle">Days to Expiration</text>
          <text x={10} y={height / 2} fontSize="10" fill="#9ca3af" textAnchor="middle" transform={`rotate(-90, 10, ${height / 2})`}>Implied Volatility</text>
        </svg>
      </div>
    </div>
  );
};

export default TermStructureChart;
