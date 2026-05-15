'use client';

import React, { useState } from 'react';
import { Search, TrendingUp, BarChart2, Activity } from 'lucide-react';
import { getOptionChain, getBars, getOptionLevels, getGammaProfile, getTermStructure, getExpiries, getGexHeatmap } from '@/services/api';
import OptionChain from '@/components/OptionChain';
import ChatWidget from '@/components/ChatWidget';
import PriceChart from '@/components/PriceChart';
import ExposureChart from '@/components/ExposureChart';
import GammaProfileChart from '@/components/GammaProfileChart';
import TermStructureChart from '@/components/TermStructureChart';
import VolSmileChart from '@/components/VolSmileChart';
import GexHeatmap from '@/components/GexHeatmap';
import InfoTooltip from '@/components/InfoTooltip';

export default function Home() {
  const [symbol, setSymbol] = useState('');
  const [expiry, setExpiry] = useState(''); 
  const [expiries, setExpiries] = useState<string[]>([]);
  const [data, setData] = useState<any>(null);
  const [levels, setLevels] = useState<any>(null);
  const [gammaProfile, setGammaProfile] = useState<any>(null);
  const [termStructure, setTermStructure] = useState<any>(null);
  const [gexHeatmap, setGexHeatmap] = useState<any>(null);
  const [bars, setBars] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const targetStrike = 55; // Highlighting the strike requested by user

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol) return;

    setLoading(true);
    setError('');
    try {
      const upperSymbol = symbol.toUpperCase();
      
      // Fetch expiries if not loaded for this symbol
      let currentExpiry = expiry;
      if (expiries.length === 0 || !expiries.includes(expiry)) {
          const expData = await getExpiries(upperSymbol);
          setExpiries(expData.expiries);
          if (expData.expiries.length > 0 && !currentExpiry) {
              currentExpiry = expData.expiries[0];
              setExpiry(currentExpiry);
          }
      }

      const [chainData, barData, levelData, profileData, termData, heatmapData] = await Promise.all([
        getOptionChain(upperSymbol, currentExpiry),
        getBars(upperSymbol),
        getOptionLevels(upperSymbol, currentExpiry),
        getGammaProfile(upperSymbol, currentExpiry),
        getTermStructure(upperSymbol),
        getGexHeatmap(upperSymbol)
      ]);
      setData(chainData);
      setBars(barData.bars);
      setLevels(levelData);
      setGammaProfile(profileData);
      setTermStructure(termData);
      setGexHeatmap(heatmapData);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-black">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Search */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="text-blue-600" /> Options Explorer
            </h1>
            <p className="text-gray-500 text-sm">Real-time Greeks, GEX & AI Analysis</p>
          </div>
          
          <form onSubmit={handleSearch} className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Ticker (e.g. ARMK)"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 text-black"
              />
            </div>
            
            <select
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black min-w-[140px]"
            >
              {expiries.length === 0 ? (
                <option value="">Fetch Expiries...</option>
              ) : (
                expiries.map(exp => (
                  <option key={exp} value={exp}>{exp}</option>
                ))
              )}
            </select>

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            >
              {loading ? 'Searching...' : 'Explore'}
            </button>
          </form>
        </header>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content: Option Chain & Charts */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="text-blue-600" /> Price Action & Exposure Levels
              </h2>
              <PriceChart data={bars} optionLevels={levels} targetStrike={symbol.toUpperCase() === 'ARMK' ? targetStrike : undefined} />
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border text-black">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="text-blue-600" /> Gamma Profile (GEX Curve)
              </h2>
              {gammaProfile && <GammaProfileChart profile={gammaProfile.profile} spotPrice={gammaProfile.spot_price} />}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border text-black">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="text-blue-600" /> Volatility Smile (Skew)
              </h2>
              {levels && <VolSmileChart strikes={levels.strikes} spotPrice={levels.spot_price} />}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border text-black">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="text-blue-600" /> GEX Concentration Heatmap
              </h2>
              {gexHeatmap && <GexHeatmap data={gexHeatmap.heatmap} strikes={gexHeatmap.strikes} />}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border text-black">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="text-blue-600" /> Exposure Profile (GEX/DEX)
              </h2>
              {levels && <ExposureChart strikes={levels.strikes} spotPrice={levels.spot_price} />}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart2 className="text-blue-600" /> Option Chain
              </h2>
              <OptionChain data={data} spotPrice={data?.spot_price} />
            </div>
          </div>

          {/* Sidebar: Metrics & GEX */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="text-blue-600" /> Key Metrics
              </h2>
              {data ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-500 flex items-center">
                      Spot Price
                      <InfoTooltip content="Current market price of the underlying asset." />
                    </span>
                    <span className="font-bold text-lg text-black">${data.spot_price.toFixed(2)}</span>
                  </div>
                  {levels?.gamma_flip && (
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-gray-500 flex items-center">
                        Gamma Flip
                        <InfoTooltip content="Price level where net Gamma transitions from positive to negative. Below this, market volatility often increases." />
                      </span>
                      <span className="font-bold text-purple-600">${levels.gamma_flip.toFixed(2)}</span>
                    </div>
                  )}
                  {levels?.max_pain && (
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-gray-500 flex items-center">
                        Max Pain
                        <InfoTooltip content="Strike price where total option value is minimized at expiration. Price often gravitates here on OpEx." />
                      </span>
                      <span className="font-bold text-orange-600">${levels.max_pain.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-500 flex items-center">
                      Total GEX
                      <InfoTooltip content="Aggregate Gamma Exposure. Large positive GEX mutes market moves; negative GEX amplifies them." />
                    </span>
                    <span className={`font-bold ${(levels?.total_gex || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.abs(levels?.total_gex || 0) >= 1e9 
                        ? `$${((levels?.total_gex || 0) / 1e9).toFixed(2)}B`
                        : Math.abs(levels?.total_gex || 0) >= 1e6
                        ? `$${((levels?.total_gex || 0) / 1e6).toFixed(2)}M`
                        : `$${((levels?.total_gex || 0) / 1e3).toFixed(1)}K`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-500">Total DEX</span>
                    <span className={`font-bold ${(levels?.total_dex || 0) >= 0 ? 'text-blue-600' : 'text-indigo-600'}`}>
                      {Math.abs(levels?.total_dex || 0) >= 1e9
                        ? `$${((levels?.total_dex || 0) / 1e9).toFixed(2)}B`
                        : Math.abs(levels?.total_dex || 0) >= 1e6
                        ? `$${((levels?.total_dex || 0) / 1e6).toFixed(2)}M`
                        : `$${((levels?.total_dex || 0) / 1e3).toFixed(1)}K`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Market Sentiment</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                      (levels?.total_gex || 0) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {(levels?.total_gex || 0) >= 0 ? 'Bullish' : 'Bearish'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Enter a ticker to see metrics.</p>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border text-black">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="text-blue-600" /> Volatility Term Structure
              </h2>
              {termStructure && <TermStructureChart data={termStructure.term_structure} />}
            </div>

            <div className="bg-blue-900 text-white p-6 rounded-xl shadow-lg border border-blue-800">
              <h3 className="font-bold mb-2">Pro Data Enabled</h3>
              <p className="text-blue-200 text-sm mb-4">You are currently using Alpaca Professional credentials with OPRA data feed.</p>
              <div className="bg-blue-800 rounded-lg p-3 text-xs font-mono">
                Feed: OPRA/SIP <br />
                Status: Real-time
              </div>
            </div>
          </div>
        </div>
      </div>

      <ChatWidget context={{ data, levels }} />
    </main>
  );
}
