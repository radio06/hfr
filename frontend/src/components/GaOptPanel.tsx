import type { GaResult } from "../hooks/useGaResult";

interface Props {
  result: GaResult | null;
  loading: boolean;
  optimizing: boolean;
  error: string | null;
  onOptimize: () => void;
}

export default function GaOptPanel({ result, loading, optimizing, error, onOptimize }: Props) {
  const fmt = (n: number) => n.toLocaleString("ko-KR");
  const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>GA 최적화 결과</h3>
      <p style={styles.desc}>
        유전 알고리즘으로 최적의 진입/청산 기간을 탐색합니다.
        <br />
        적합도: Calmar Ratio (CAGR / MDD)
      </p>

      {/* 최적화 실행 버튼 */}
      <button
        style={{
          ...styles.btn,
          ...(optimizing ? styles.btnDisabled : {}),
        }}
        onClick={onOptimize}
        disabled={optimizing || loading}
      >
        {optimizing ? (
          <>
            <span style={styles.spinner} />
            최적화 진행 중... (~60초)
          </>
        ) : (
          "최적화 실행"
        )}
      </button>

      {error && (
        <p style={styles.error}>오류: {error}</p>
      )}

      {loading && !optimizing && (
        <p style={styles.hint}>결과 불러오는 중...</p>
      )}

      {!loading && !result && !optimizing && (
        <div style={styles.empty}>
          <p style={styles.emptyText}>저장된 최적화 결과가 없습니다.</p>
          <p style={styles.emptyHint}>위 버튼을 눌러 최적화를 실행하세요.</p>
        </div>
      )}

      {result && (
        <div style={styles.resultBox}>
          {/* 최적 파라미터 */}
          <div style={styles.paramRow}>
            <div style={styles.paramCard}>
              <span style={styles.paramLabel}>진입 기간</span>
              <span style={styles.paramValue}>{result.entry_period}일</span>
            </div>
            <div style={styles.paramCard}>
              <span style={styles.paramLabel}>청산 기간</span>
              <span style={styles.paramValue}>{result.exit_period}일</span>
            </div>
          </div>

          {/* 핵심 지표 */}
          <div style={styles.metricsGrid}>
            <MetricItem
              label="Calmar"
              value={result.metrics.calmar.toFixed(2)}
              color={result.metrics.calmar > 0.5 ? "#22c55e" : result.metrics.calmar > 0 ? "#f59e0b" : "#ef4444"}
            />
            <MetricItem
              label="CAGR"
              value={pct(result.metrics.cagr)}
              color={result.metrics.cagr > 0 ? "#22c55e" : "#ef4444"}
            />
            <MetricItem
              label="MDD"
              value={`-${result.metrics.mdd.toFixed(2)}%`}
              color="#ef4444"
            />
            <MetricItem
              label="총 수익률"
              value={pct(result.metrics.total_return)}
              color={result.metrics.total_return >= 0 ? "#22c55e" : "#ef4444"}
            />
            <MetricItem
              label="최종 자산"
              value={`${fmt(result.metrics.final_capital)}원`}
              color="#6366f1"
            />
            <MetricItem
              label="샤프비율"
              value={result.metrics.sharpe.toFixed(2)}
              color={result.metrics.sharpe > 1 ? "#22c55e" : result.metrics.sharpe > 0 ? "#f59e0b" : "#ef4444"}
            />
            <MetricItem
              label="승률"
              value={`${result.metrics.win_rate.toFixed(1)}%`}
              color={result.metrics.win_rate >= 50 ? "#22c55e" : "#f59e0b"}
            />
            <MetricItem
              label="거래 수"
              value={`${result.metrics.num_trades}회`}
            />
            <MetricItem
              label="손익비"
              value={result.metrics.profit_factor.toFixed(2)}
              color={result.metrics.profit_factor >= 1.5 ? "#22c55e" : result.metrics.profit_factor >= 1 ? "#f59e0b" : "#ef4444"}
            />
          </div>

          {result.created_at && (
            <p style={styles.timestamp}>
              마지막 실행: {new Date(result.created_at).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MetricItem({ label, value, color = "#f1f5f9" }: {
  label: string; value: string; color?: string;
}) {
  return (
    <div style={styles.metricItem}>
      <span style={styles.metricLabel}>{label}</span>
      <span style={{ ...styles.metricValue, color }}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: "#f1f5f9",
  },
  desc: {
    margin: 0,
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.5,
  },
  btn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "opacity 0.15s",
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  spinner: {
    display: "inline-block",
    width: 14,
    height: 14,
    border: "2px solid rgba(255,255,255,0.3)",
    borderTop: "2px solid #fff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  error: {
    margin: 0,
    fontSize: 12,
    color: "#ef4444",
  },
  hint: {
    margin: 0,
    fontSize: 12,
    color: "#64748b",
  },
  empty: {
    background: "#1e293b",
    borderRadius: 8,
    padding: "20px 16px",
    textAlign: "center",
  },
  emptyText: {
    margin: 0,
    fontSize: 13,
    color: "#94a3b8",
  },
  emptyHint: {
    margin: "6px 0 0",
    fontSize: 11,
    color: "#475569",
  },
  resultBox: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  paramRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  paramCard: {
    background: "linear-gradient(135deg, #1e293b, #334155)",
    borderRadius: 8,
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    border: "1px solid #475569",
  },
  paramLabel: {
    fontSize: 11,
    color: "#94a3b8",
  },
  paramValue: {
    fontSize: 22,
    fontWeight: 700,
    color: "#f59e0b",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 6,
  },
  metricItem: {
    background: "#1e293b",
    borderRadius: 6,
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  metricLabel: {
    fontSize: 10,
    color: "#64748b",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 600,
  },
  timestamp: {
    margin: 0,
    fontSize: 10,
    color: "#475569",
    textAlign: "right",
  },
};
