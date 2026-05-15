'use client';

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';

interface PriceChartProps {
  data: any[];
  optionLevels?: {
    call_wall: number;
    put_wall: number;
    spot_price: number;
    strikes: any[];
  } | null;
  targetStrike?: number;
}

const PriceChart: React.FC<PriceChartProps> = ({ data, optionLevels, targetStrike }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    const container = chartContainerRef.current;
    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth });
    };

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'white' },
        textColor: 'black',
      },
      width: container.clientWidth,
      height: 500,
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    candlestickSeries.setData(data);

    // Add Option Levels
    if (optionLevels) {
      if (optionLevels.call_wall) {
        candlestickSeries.createPriceLine({
          price: optionLevels.call_wall,
          color: '#ef5350',
          lineWidth: 2,
          lineStyle: 0, 
          axisLabelVisible: true,
          title: 'CALL WALL',
        });
      }
      if (optionLevels.put_wall) {
        candlestickSeries.createPriceLine({
          price: optionLevels.put_wall,
          color: '#26a69a',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: 'PUT WALL',
        });
      }
      if (optionLevels.spot_price) {
        candlestickSeries.createPriceLine({
          price: optionLevels.spot_price,
          color: '#2962FF',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'SPOT',
        });
      }

      // Highlight Top GEX Strikes
      if (optionLevels.strikes) {
          const topGex = [...optionLevels.strikes].sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex)).slice(0, 3);
          topGex.forEach(s => {
              if (s.strike !== optionLevels.call_wall && s.strike !== optionLevels.put_wall) {
                  candlestickSeries.createPriceLine({
                      price: s.strike,
                      color: s.gex > 0 ? '#4CAF50' : '#F44336',
                      lineWidth: 1,
                      lineStyle: 3, // Dotted
                      axisLabelVisible: true,
                      title: `GEX Peak`,
                  });
              }
          });
      }
    }

    if (targetStrike) {
        candlestickSeries.createPriceLine({
            price: targetStrike,
            color: '#FF9800',
            lineWidth: 2,
            lineStyle: 1,
            axisLabelVisible: true,
            title: `TARGET: ${targetStrike}`,
        });
    }

    chart.timeScale().fitContent();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} />;
};

export default PriceChart;
