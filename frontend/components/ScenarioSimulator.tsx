'use client';

import React, { useState, useEffect } from 'react';
import { simulateOptions } from '@/services/api';
import { Sliders, RotateCcw } from 'lucide-react';

interface ScenarioSimulatorProps {
  initialS: number;
  initialK: number;
  initialT: number;
  initialSigma: number;
}

interface SimulationResults {
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  vanna: number;
  charm: number;
}

const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({ initialS, initialK, initialT, initialSigma }) => {
  const [S, setS] = useState(initialS);
  const [K, setK] = useState(initialK);
  const [T, setT] = useState(initialT);
  const [sigma, setSigma] = useState(initialSigma);
  const [type, setType] = useState('call');
  const [results, setResults] = useState<SimulationResults | null>(null);

  useEffect(() => {
    const runSim = async () => {
      try {
        const res = await simulateOptions({ S, K, T_days: T, sigma, option_type: type });
        setResults(res);
      } catch (e) {
        console.error(e);
      }
    };
    
    const timeout = setTimeout(runSim, 100); 
    return () => clearTimeout(timeout);
  }, [S, K, T, sigma, type]);

  const reset = () => {
    setS(initialS);
    setK(initialK);
    setT(initialT);
    setSigma(initialSigma);
  };

  const formatNum = (val: number) => val?.toFixed(4) ?? '--';

  return (
    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-gray-700 flex items-center gap-2">
          <Sliders size={18} className="text-blue-600" /> Scenario Simulator
        </h3>
        <button onClick={reset} className="text-gray-400 hover:text-blue-600 transition-colors">
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <label className="flex justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
              <span>Spot Price: ${S.toFixed(2)}</span>
              <span>{(((S - initialS) / initialS) * 100).toFixed(1)}%</span>
            </label>
            <input 
              type="range" min={initialS * 0.8} max={initialS * 1.2} step="0.1" 
              value={S} onChange={(e) => setS(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
              Implied Volatility: {(sigma * 100).toFixed(1)}%
            </label>
            <input 
              type="range" min="0.01" max="2.0" step="0.01" 
              value={sigma} onChange={(e) => setSigma(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
              Days to Expiry: {T} days
            </label>
            <input 
              type="range" min="0" max="365" step="1" 
              value={T} onChange={(e) => setT(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div className="flex gap-2 p-1 bg-white rounded border w-fit">
            <button 
              onClick={() => setType('call')}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase ${type === 'call' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
            >
              Call
            </button>
            <button 
              onClick={() => setType('put')}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase ${type === 'put' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
            >
              Put
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="border-b border-gray-50 pb-2">
              <p className="text-[9px] font-bold text-gray-400 uppercase">Simulated Price</p>
              <p className="text-lg font-mono font-bold text-blue-600">${formatNum(results?.price)}</p>
            </div>
            <div className="border-b border-gray-50 pb-2">
              <p className="text-[9px] font-bold text-gray-400 uppercase">Delta</p>
              <p className="text-lg font-mono font-bold text-gray-800">{formatNum(results?.delta)}</p>
            </div>
            <div className="border-b border-gray-50 pb-2">
              <p className="text-[9px] font-bold text-gray-400 uppercase">Gamma</p>
              <p className="text-lg font-mono font-bold text-gray-800">{formatNum(results?.gamma)}</p>
            </div>
            <div className="border-b border-gray-50 pb-2">
              <p className="text-[9px] font-bold text-gray-400 uppercase">Theta (Daily)</p>
              <p className="text-lg font-mono font-bold text-gray-800">{formatNum(results?.theta / 365)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase">Vega</p>
              <p className="text-lg font-mono font-bold text-gray-800">{formatNum(results?.vega / 100)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase">Vanna</p>
              <p className="text-lg font-mono font-bold text-gray-800">{formatNum(results?.vanna)}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 text-center text-[9px] text-gray-400 italic">
        Simulation uses the Black-Scholes-Merton model assuming 4% risk-free rate and zero dividends.
      </div>
    </div>
  );
};

export default ScenarioSimulator;
