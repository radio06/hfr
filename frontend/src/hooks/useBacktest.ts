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

export function useBacktest(system: 1 | 2, years = 5) {
  const [data, setData]       = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
    fetch(`${API}/api/backtest?system=${system}&years=${years}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<BacktestResult>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [system, years]);

  return { data, loading, error };
}
