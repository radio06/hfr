import { useState, useEffect } from "react";

export interface OhlcvBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface OhlcvResponse {
  ticker: string;
  name: string;
  count: number;
  data: OhlcvBar[];
}

export function useOhlcv() {
  const [data, setData] = useState<OhlcvBar[]>([]);
  const [meta, setMeta] = useState<{ ticker: string; name: string; count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
    fetch(`${API}/api/ohlcv`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<OhlcvResponse>;
      })
      .then((json) => {
        setData(json.data);
        setMeta({ ticker: json.ticker, name: json.name, count: json.count });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { data, meta, loading, error };
}
