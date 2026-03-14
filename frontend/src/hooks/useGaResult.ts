import { useState, useEffect, useCallback } from "react";
import type { Metrics } from "./useBacktest";

export interface GaResult {
  found: boolean;
  stock_key: string;
  years: number;
  entry_period: number;
  exit_period: number;
  calmar: number;
  metrics: Metrics;
  created_at: string;
}

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function useGaResult(stock: string, years: number) {
  const [result, setResult] = useState<GaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 저장된 결과 조회
  const fetchResult = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/api/ga/result?stock=${encodeURIComponent(stock)}&years=${years}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setResult(json.found ? json : null);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [stock, years]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  // 최적화 실행
  const optimize = useCallback(() => {
    setOptimizing(true);
    setError(null);
    fetch(`${API}/api/ga/optimize?stock=${encodeURIComponent(stock)}&years=${years}`, {
      method: "POST",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setResult({ found: true, ...json, created_at: new Date().toISOString() });
        setOptimizing(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setOptimizing(false);
      });
  }, [stock, years]);

  return { result, loading, optimizing, error, optimize, refetch: fetchResult };
}
