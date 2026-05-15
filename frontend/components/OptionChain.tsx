'use client';

import React from 'react';
import InfoTooltip from './InfoTooltip';

interface OptionContract {
  contract: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  implied_vol: number | null;
  greeks: {
    delta: number;
    gamma: number;
  };
}

interface OptionChainProps {
  data: {
    chain?: OptionContract[];
  } | null;
  spotPrice?: number;
}

const OptionChain: React.FC<OptionChainProps> = ({ data, spotPrice }) => {
  if (!data || !data.chain) return <div className="p-4 text-center text-black">No data available. Search for a ticker.</div>;

  // Group by strike
  const groupedData: { [key: string]: { strike: number, call?: OptionContract, put?: OptionContract } } = {};
  
  data.chain.forEach((item: OptionContract) => {
    const strike = parseFloat(item.contract.slice(-8)) / 1000;
    const key = strike.toString();
    const type = item.contract.includes('C') ? 'call' : 'put';
    
    if (!groupedData[key]) {
      groupedData[key] = { strike };
    }
    groupedData[key][type] = item;
  });

  let sortedStrikes = Object.values(groupedData).sort((a, b) => a.strike - b.strike);

  // Filter for relevant strikes if spotPrice is provided
  if (spotPrice) {
      sortedStrikes = sortedStrikes.filter(s => s.strike >= spotPrice * 0.5 && s.strike <= spotPrice * 1.5);
  }

  const formatNum = (val: number | null | undefined) => (val !== null && val !== undefined) ? val.toFixed(2) : '--';

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow border max-h-[600px] overflow-y-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            <th colSpan={4} className="px-3 py-2 text-center text-xs font-bold text-green-700 uppercase border-r">Calls</th>
            <th className="px-3 py-2 text-center text-xs font-bold text-blue-600 uppercase bg-blue-50">Strike ($)</th>
            <th colSpan={4} className="px-3 py-2 text-center text-xs font-bold text-red-700 uppercase border-l">Puts</th>
          </tr>
          <tr>
            <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">IV <InfoTooltip content="Implied Volatility: Market's expectation of future volatility." /></th>
            <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">Bid</th>
            <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-500 uppercase">Ask</th>
            <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-500 uppercase border-r">Delta <InfoTooltip content="Sensitivity of option price to underlying price." /></th>
            <th className="px-3 py-1 bg-blue-50"></th>
            <th className="px-3 py-1 text-right text-[10px] font-medium text-gray-500 uppercase border-l">Delta</th>
            <th className="px-3 py-1 text-right text-[10px] font-medium text-gray-500 uppercase">Bid</th>
            <th className="px-3 py-1 text-right text-[10px] font-medium text-gray-500 uppercase">Ask</th>
            <th className="px-3 py-1 text-right text-[10px] font-medium text-gray-500 uppercase">IV</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedStrikes.map((row, idx) => {
            const isATM = spotPrice && Math.abs(row.strike - spotPrice) < 2.5; // Rough ATM highlight
            return (
              <tr key={idx} className={`${isATM ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                <td className="px-3 py-2 text-xs text-gray-500 font-mono">{(row.call?.implied_vol ?? 0) * 100 > 0 ? `${((row.call?.implied_vol ?? 0) * 100).toFixed(0)}%` : '--'}</td>
                <td className="px-3 py-2 text-xs text-gray-900 font-mono">{formatNum(row.call?.bid)}</td>
                <td className="px-3 py-2 text-xs text-gray-900 font-mono">{formatNum(row.call?.ask)}</td>
                <td className="px-3 py-2 text-xs text-green-600 font-mono border-r">{formatNum(row.call?.greeks.delta)}</td>
                <td className={`px-3 py-2 text-sm text-center font-bold bg-blue-50 ${isATM ? 'text-yellow-700' : 'text-blue-800'}`}>
                  {row.strike.toFixed(1)}
                </td> 
                <td className="px-3 py-2 text-xs text-right text-red-600 font-mono border-l">{formatNum(row.put?.greeks.delta)}</td>
                <td className="px-3 py-2 text-xs text-right text-gray-900 font-mono">{formatNum(row.put?.bid)}</td>
                <td className="px-3 py-2 text-xs text-right text-gray-900 font-mono">{formatNum(row.put?.ask)}</td>
                <td className="px-3 py-2 text-xs text-right text-gray-500 font-mono">{(row.put?.implied_vol ?? 0) * 100 > 0 ? `${((row.put?.implied_vol ?? 0) * 100).toFixed(0)}%` : '--'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default OptionChain;
