import { useState, useEffect } from "react";

export interface OhlcvBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  time: number;
  type: "long" | "short" | "exit_long" | "exit_short" | "add_long" | "add_short";
  price: number;
}

export interface ChannelPoint {
  time: number;
  value: number;
}

export interface EquityPoint {
  time: number;
  value: number;
}

export interface Trade {
  entry_date: number;
  exit_date: number;
  direction: "long" | "short";
  entry_price: number;
  exit_price: number;
  units: number;
  shares: number;
  pnl: number;
  pnl_pct: number;
}

export interface Metrics {
  total_return: number;
  cagr: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  mdd: number;
  win_rate: number;
  profit_factor: number;
  avg_win_pct: number;
  avg_loss_pct: number;
  max_loss_streak: number;
  num_trades: number;
  num_wins: number;
  num_losses: number;
  final_capital: number;
}

export interface BacktestResult {
  system: number;
  ohlcv: OhlcvBar[];
  signals: Signal[];
  channels: {
    entry_high: ChannelPoint[];
    entry_low: ChannelPoint[];
    exit_high: ChannelPoint[];
    exit_low: ChannelPoint[];
  };
  equity_curve: EquityPoint[];
  trades: Trade[];
  metrics: Metrics;
  ticker: string;
  name: string;
}

function _useFetch(url: string, deps: unknown[]) {
  const [data, setData]       = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<BacktestResult>;
      })
      .then((json) => {
        if (!cancelled) { setData(json); setLoading(false); }
      })
      .catch((err: Error) => {
        if (!cancelled) { setError(err.message); setLoading(false); }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

export function useBacktest(system: 1 | 2, years = 5) {
  const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
  return _useFetch(`${API}/api/backtest?system=${system}&years=${years}`, [system, years]);
}

export function useIscBacktest() {
  const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
  return _useFetch(`${API}/api/backtest/isc`, []);
}

/**
 * 탭 전환에 반응하는 통합 훅 — URL이 바뀔 때마다 자동 re-fetch
 */
export function useActiveBacktest(
  ticker: "HFR" | "ISC",
  system: 1 | 2,
  years: number,
) {
  const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
  const url =
    ticker === "ISC"
      ? `${API}/api/backtest/isc`
      : `${API}/api/backtest?system=${system}&years=${years}`;
  return _useFetch(url, [url]);
}
