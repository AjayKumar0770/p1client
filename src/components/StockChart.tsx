"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { createChart, UTCTimestamp, CandlestickSeries, LineSeries } from "lightweight-charts";
import {
  Candle,
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateVolumeProfile
} from "../lib/indicators/math";
import { Eye, EyeOff, BarChart3, LineChart } from "lucide-react";
import { useScreenerStore } from "../client-core";
import { formatVolume } from "../utils/formatters";

export default function StockChart({ symbol }: { symbol: string }) {
  const mainChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [showSMA, setShowSMA] = useState(true);
  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [showVolProfile, setShowVolProfile] = useState(true);
  const [showTabularData, setShowTabularData] = useState(false);

  const [history, setHistory] = useState<Candle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch candlestick history
  useEffect(() => {
    if (!symbol) return;
    let isMounted = true;
    const fetchHistory = async () => {
      await Promise.resolve(); // Push state update out of synchronous effect
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/stocks/${symbol}/history`);
        if (!res.ok) throw new Error("Candles request failed");
        const data = await res.json() as Candle[];
        if (isMounted) {
          setHistory(data);
          setIsLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError("Failed to load candles history");
          setIsLoading(false);
        }
      }
    };
    fetchHistory();
    return () => { isMounted = false; };
  }, [symbol]);

  // Live WebSocket Tick Binding for Chart
  const livePrice = useScreenerStore((state) => state.prices[symbol]);

  // Combine history with latest live price delta tick
  const historyWithLiveTick = useMemo(() => {
    if (history.length === 0) return [];
    if (!livePrice) return history;

    const last = history[history.length - 1];
    const liveTime = new Date().toISOString().split("T")[0];

    const currentLiveCandle: Candle = {
      time: liveTime,
      open: last.time === liveTime ? last.open : last.close,
      high: last.time === liveTime ? Math.max(last.high, livePrice.price) : Math.max(last.close, livePrice.price),
      low: last.time === liveTime ? Math.min(last.low, livePrice.price) : Math.min(last.close, livePrice.price),
      close: livePrice.price,
      volume: last.time === liveTime ? last.volume : livePrice.volume
    };

    if (last.time === liveTime) {
      return [...history.slice(0, -1), currentLiveCandle];
    } else {
      return [...history, currentLiveCandle];
    }
  }, [history, livePrice]);

  const indicators = useMemo(() => {
    if (historyWithLiveTick.length === 0) return null;

    const sma50 = calculateSMA(historyWithLiveTick, 50);
    const ema12 = calculateEMA(historyWithLiveTick, 12);
    const ema26 = calculateEMA(historyWithLiveTick, 26);
    const bb = calculateBollingerBands(historyWithLiveTick, 20, 2);
    const rsi = calculateRSI(historyWithLiveTick, 14);
    const volProfile = calculateVolumeProfile(historyWithLiveTick, 24);

    return { sma50, ema12, ema26, bb, rsi, volProfile };
  }, [historyWithLiveTick]);

  useEffect(() => {
    if (isLoading || historyWithLiveTick.length === 0 || !mainChartRef.current || !rsiChartRef.current) return;

    mainChartRef.current.innerHTML = "";
    rsiChartRef.current.innerHTML = "";

    const themeColors = {
      background: "#18181b",
      grid: "#27272a",
      text: "#a1a1aa",
      upColor: "#10b981",
      downColor: "#ef4444",
      smaColor: "#f59e0b",
      ema12Color: "#3b82f6",
      ema26Color: "#ec4899",
      bbMiddle: "#8b5cf6",
      bbLines: "rgba(139, 92, 246, 0.4)",
      rsiLine: "#06b6d4",
      rsiGuide: "#4b5563"
    };

    const mainChart = createChart(mainChartRef.current, {
      width: mainChartRef.current.clientWidth || 600,
      height: 320,
      layout: {
        background: { color: themeColors.background },
        textColor: themeColors.text
      },
      grid: {
        vertLines: { color: themeColors.grid },
        horzLines: { color: themeColors.grid }
      },
      timeScale: {
        borderColor: themeColors.grid,
        timeVisible: true
      }
    });

    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: themeColors.upColor,
      downColor: themeColors.downColor,
      borderDownColor: themeColors.downColor,
      borderUpColor: themeColors.upColor,
      wickDownColor: themeColors.downColor,
      wickUpColor: themeColors.upColor
    });

    candleSeries.setData(
      historyWithLiveTick.map((c) => ({
        time: c.time as unknown as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }))
    );

    if (showSMA && indicators?.sma50) {
      const smaSeries = mainChart.addSeries(LineSeries, {
        color: themeColors.smaColor,
        lineWidth: 2,
        title: "SMA 50"
      });
      smaSeries.setData(indicators.sma50.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.value })));
    }

    if (showEMA && indicators) {
      const ema12Series = mainChart.addSeries(LineSeries, {
        color: themeColors.ema12Color,
        lineWidth: 1,
        title: "EMA 12"
      });
      ema12Series.setData(indicators.ema12.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.value })));

      const ema26Series = mainChart.addSeries(LineSeries, {
        color: themeColors.ema26Color,
        lineWidth: 1,
        title: "EMA 26"
      });
      ema26Series.setData(indicators.ema26.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.value })));
    }

    if (showBB && indicators?.bb) {
      const bbUpperSeries = mainChart.addSeries(LineSeries, { color: themeColors.bbLines, lineWidth: 1, lineStyle: 1, title: "BB Upper" });
      const bbMiddleSeries = mainChart.addSeries(LineSeries, { color: themeColors.bbMiddle, lineWidth: 1, title: "BB Middle" });
      const bbLowerSeries = mainChart.addSeries(LineSeries, { color: themeColors.bbLines, lineWidth: 1, lineStyle: 1, title: "BB Lower" });

      bbUpperSeries.setData(indicators.bb.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.upper })));
      bbMiddleSeries.setData(indicators.bb.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.middle })));
      bbLowerSeries.setData(indicators.bb.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.lower })));
    }

    const rsiChart = createChart(rsiChartRef.current, {
      width: rsiChartRef.current.clientWidth || 600,
      height: 120,
      layout: {
        background: { color: themeColors.background },
        textColor: themeColors.text
      },
      grid: {
        vertLines: { color: themeColors.grid },
        horzLines: { color: themeColors.grid }
      },
      timeScale: {
        borderColor: themeColors.grid
      }
    });

    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: themeColors.rsiLine,
      lineWidth: 2,
      title: "RSI 14"
    });

    if (indicators?.rsi) {
      rsiSeries.setData(indicators.rsi.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.value })));
    }

    const rsi30Series = rsiChart.addSeries(LineSeries, { color: themeColors.rsiGuide, lineWidth: 1, lineStyle: 3 });
    rsi30Series.setData(historyWithLiveTick.map(c => ({ time: c.time as unknown as UTCTimestamp, value: 30 })));

    const rsi70Series = rsiChart.addSeries(LineSeries, { color: themeColors.rsiGuide, lineWidth: 1, lineStyle: 3 });
    rsi70Series.setData(historyWithLiveTick.map(c => ({ time: c.time as unknown as UTCTimestamp, value: 70 })));

    let rafId: number | null = null;

    const drawVolumeProfile = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas || !mainChartRef.current || !showVolProfile) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = mainChartRef.current.clientWidth;
        canvas.height = 320;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const range = mainChart.timeScale().getVisibleLogicalRange();
        let visibleData = historyWithLiveTick;
        if (range) {
          const startIdx = Math.max(0, Math.floor(range.from));
          const endIdx = Math.min(historyWithLiveTick.length - 1, Math.ceil(range.to));
          if (startIdx <= endIdx) {
            visibleData = historyWithLiveTick.slice(startIdx, endIdx + 1);
          }
        }

        if (visibleData.length === 0) return;
        // Dynamically divide into 30 to 50 buckets depending on data scale
        const dynamicBins = Math.max(30, Math.min(50, Math.floor(visibleData.length / 5)));
        const volProfile = calculateVolumeProfile(visibleData, dynamicBins);
        const { bins } = volProfile;

        const maxVol = Math.max(...bins.map(b => b.volume));
        const profileWidth = canvas.width * 0.25;

        bins.forEach((bin) => {
          const yMin = candleSeries.priceToCoordinate(bin.priceMin);
          const yMax = candleSeries.priceToCoordinate(bin.priceMax);

          if (yMin === null || yMax === null) return;

          const height = Math.abs(yMax - yMin);
          const y = Math.min(yMin, yMax);
          const width = (bin.volume / maxVol) * profileWidth;

          ctx.fillStyle = bin.isPoc ? "rgba(245, 158, 11, 0.4)" : "rgba(161, 161, 170, 0.15)";
          ctx.strokeStyle = bin.isPoc ? "rgba(245, 158, 11, 0.8)" : "rgba(161, 161, 170, 0.3)";
          ctx.lineWidth = 1;

          ctx.fillRect(10, y, width, height);
          ctx.strokeRect(10, y, width, height);

          if (bin.isPoc) {
            ctx.fillStyle = "#f59e0b";
            ctx.font = "10px sans-serif";
            ctx.fillText(`POC: $${((bin.priceMin + bin.priceMax)/2).toFixed(2)}`, width + 15, y + height/2 + 3);
          }
        });
      });
    };

    mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) {
        rsiChart.timeScale().setVisibleLogicalRange(range);
        drawVolumeProfile();
      }
    });

    rsiChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) mainChart.timeScale().setVisibleLogicalRange(range);
    });

    const handleResize = () => {
      if (!mainChartRef.current || !rsiChartRef.current) return;
      mainChart.resize(mainChartRef.current.clientWidth, 320);
      rsiChart.resize(rsiChartRef.current.clientWidth, 120);
      drawVolumeProfile();
    };

    window.addEventListener("resize", handleResize);
    const timer = setTimeout(drawVolumeProfile, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
      if (rafId) cancelAnimationFrame(rafId);
      mainChart.remove();
      rsiChart.remove();
    };
  }, [isLoading, historyWithLiveTick, showSMA, showEMA, showBB, showVolProfile, indicators]);

  if (isLoading) {
    return (
      <div className="flex h-[450px] w-full flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
        <p className="mt-4 text-sm font-medium">Recompiling Indicator Channels...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[450px] w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-red-400">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded text-sm font-mono border border-amber-500/20">{symbol}</span>
            Technical Indicator synchronizer
          </h2>
          <p className="text-xs text-zinc-400">Continuous canvas charting overlays & raw momentum evaluation</p>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setShowSMA(!showSMA)}
            aria-label={showSMA ? "Hide SMA" : "Show SMA"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition ${
              showSMA
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {showSMA ? <Eye className="h-3 w-3" aria-hidden="true" /> : <EyeOff className="h-3 w-3" aria-hidden="true" />}
            SMA 50
          </button>
          <button
            onClick={() => setShowEMA(!showEMA)}
            aria-label={showEMA ? "Hide EMA" : "Show EMA"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition ${
              showEMA
                ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {showEMA ? <Eye className="h-3 w-3" aria-hidden="true" /> : <EyeOff className="h-3 w-3" aria-hidden="true" />}
            EMA 12/26
          </button>
          <button
            onClick={() => setShowBB(!showBB)}
            aria-label={showBB ? "Hide Bollinger Bands" : "Show Bollinger Bands"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition ${
              showBB
                ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {showBB ? <Eye className="h-3 w-3" aria-hidden="true" /> : <EyeOff className="h-3 w-3" aria-hidden="true" />}
            Bollinger Bands
          </button>
          <button
            onClick={() => setShowVolProfile(!showVolProfile)}
            aria-label={showVolProfile ? "Hide Volume Profile" : "Show Volume Profile"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition ${
              showVolProfile
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {showVolProfile ? <Eye className="h-3 w-3" aria-hidden="true" /> : <EyeOff className="h-3 w-3" aria-hidden="true" />}
            Volume Profile
          </button>
          <button
            onClick={() => setShowTabularData(!showTabularData)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition ${
              showTabularData
                ? "bg-white/10 border-white/20 text-white"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            }`}
            aria-label="Toggle screen reader accessible historical table"
          >
            {showTabularData ? <LineChart className="h-3 w-3" aria-hidden="true" /> : <BarChart3 className="h-3 w-3" aria-hidden="true" />}
            Tabular View (Accessible)
          </button>
        </div>
      </div>

      <div className="relative">
        <div className={`space-y-2 ${showTabularData ? "sr-only" : ""}`}>
          <div className="relative h-[320px] w-full" ref={mainChartRef} />
          {showVolProfile && (
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 pointer-events-none z-10"
              style={{ height: 320 }}
            />
          )}
          <div className="h-[120px] w-full" ref={rsiChartRef} />
        </div>

        {showTabularData && (
          <div className="h-[448px] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 p-2 font-mono text-xs text-zinc-300">
            <table className="w-full text-left border-collapse" aria-label="Historical metrics data table">
              <caption className="text-left py-1 text-zinc-400 font-bold block">Historical metrics log (latest 30 days)</caption>
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px]">
                  <th scope="col" className="p-2">Date</th>
                  <th scope="col" className="p-2">Open</th>
                  <th scope="col" className="p-2">High</th>
                  <th scope="col" className="p-2">Low</th>
                  <th scope="col" className="p-2">Close</th>
                  <th scope="col" className="p-2">Volume</th>
                  <th scope="col" className="p-2">RSI (14)</th>
                </tr>
              </thead>
              <tbody>
                {historyWithLiveTick
                  .slice(-30)
                  .reverse()
                  .map((candle, idx) => {
                    const rsiVal = indicators?.rsi?.find(r => r.time === candle.time)?.value;
                    return (
                      <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-950/40">
                        <td className="p-2 text-zinc-400">{candle.time}</td>
                        <td className="p-2">${candle.open.toFixed(2)}</td>
                        <td className="p-2 text-emerald-500">${candle.high.toFixed(2)}</td>
                        <td className="p-2 text-rose-500">${candle.low.toFixed(2)}</td>
                        <td className="p-2 font-semibold">${candle.close.toFixed(2)}</td>
                        <td className="p-2 text-zinc-400">{formatVolume(candle.volume)}</td>
                        <td className="p-2 text-cyan-400">
                          {rsiVal !== undefined ? rsiVal.toFixed(2) : "N/A"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
