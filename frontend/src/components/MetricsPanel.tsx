import type { Metrics, Trade } from "../hooks/useBacktest";

interface Props {
  metrics: Metrics;
  trades: Trade[];
  system: 1 | 2;
  isMobile?: boolean;
}

export default function MetricsPanel({ metrics: m, trades, system, isMobile }: Props) {
  const fmt = (n: number) => n.toLocaleString("ko-KR");
  const pct  = (n: number, suffix = "%") => `${n > 0 ? "+" : ""}${n.toFixed(2)}${suffix}`;

  return (
    <div style={styles.panel}>
      {/* 수익률 요약 */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>수익 요약</h3>
        <div style={styles.grid2}>
          <BigStat
            label="총 수익률"
            value={pct(m.total_return)}
            color={m.total_return >= 0 ? "#22c55e" : "#ef4444"}
          />
          <BigStat
            label="최종 자산"
            value={`${fmt(m.final_capital)}원`}
            color="#6366f1"
          />
          <BigStat label="CAGR" value={pct(m.cagr)} />
          <BigStat label="MDD" value={`-${m.mdd.toFixed(2)}%`} color="#ef4444" />
        </div>
      </section>

      {/* 리스크 지표 */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>리스크 지표</h3>
        <div style={styles.grid3}>
          <Stat label="샤프비율" value={m.sharpe.toFixed(2)}
                color={m.sharpe > 1 ? "#22c55e" : m.sharpe > 0 ? "#f59e0b" : "#ef4444"} />
          <Stat label="소르티노" value={m.sortino.toFixed(2)}
                color={m.sortino > 1 ? "#22c55e" : m.sortino > 0 ? "#f59e0b" : "#ef4444"} />
          <Stat label="칼마비율" value={m.calmar.toFixed(2)}
                color={m.calmar > 0.5 ? "#22c55e" : m.calmar > 0 ? "#f59e0b" : "#ef4444"} />
        </div>
      </section>

      {/* 트레이드 통계 */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>트레이드 통계</h3>
        <div style={styles.grid3}>
          <Stat label="총 거래" value={`${m.num_trades}회`} />
          <Stat label="승률" value={`${m.win_rate.toFixed(1)}%`}
                color={m.win_rate >= 50 ? "#22c55e" : "#f59e0b"} />
          <Stat label="손익비" value={m.profit_factor.toFixed(2)}
                color={m.profit_factor >= 1.5 ? "#22c55e" : m.profit_factor >= 1 ? "#f59e0b" : "#ef4444"} />
          <Stat label="평균 수익" value={pct(m.avg_win_pct)} color="#22c55e" />
          <Stat label="평균 손실" value={pct(m.avg_loss_pct)} color="#ef4444" />
          <Stat label="최대연속손실" value={`${m.max_loss_streak}회`} color="#ef4444" />
        </div>
      </section>

      {/* 지표 해석 가이드 */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>지표 해석</h3>
        <div style={styles.guide}>
          <GuideRow label="샤프비율" good="> 1.0" great="> 1.5" />
          <GuideRow label="MDD" good="< 20%" great="< 10%" />
          <GuideRow label="손익비" good="> 1.5" great="> 2.0" />
          <GuideRow label="승률"  good="> 45%" great="> 55%" />
        </div>
      </section>

      {/* 거래 내역 */}
      <section style={{ ...styles.section, flex: 1, minHeight: 0 }}>
        <h3 style={styles.sectionTitle}>
          거래 내역
          <span style={{ fontWeight: 400, fontSize: 11, color: "#64748b", marginLeft: 8 }}>
            System {system} · {m.num_wins}승 {m.num_losses}패
          </span>
        </h3>
        <div style={{ ...styles.tradeList, ...(isMobile ? { maxHeight: "none" } : {}) }}>
          <div style={{ ...styles.tradeHeader, ...(isMobile ? styles.tradeRowMobile : {}) }}>
            <span>진입일</span>
            <span>방향</span>
            <span>단위</span>
            <span>진입가</span>
            <span>청산가</span>
            <span style={{ textAlign: "right" }}>손익(%)</span>
          </div>
          {[...trades].reverse().map((t, i) => (
            <TradeRow key={i} trade={t} isMobile={isMobile} />
          ))}
          {trades.length === 0 && (
            <div style={{ color: "#475569", fontSize: 12, padding: "12px 0", textAlign: "center" }}>
              거래 없음
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function BigStat({ label, value, color = "#f1f5f9" }: {
  label: string; value: string; color?: string;
}) {
  return (
    <div style={styles.bigStat}>
      <span style={styles.bigStatLabel}>{label}</span>
      <span style={{ ...styles.bigStatValue, color }}>{value}</span>
    </div>
  );
}

function Stat({ label, value, color = "#f1f5f9" }: {
  label: string; value: string; color?: string;
}) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{label}</span>
      <span style={{ ...styles.statValue, color }}>{value}</span>
    </div>
  );
}

function GuideRow({ label, good, great }: {
  label: string; good: string; great: string;
}) {
  return (
    <div style={styles.guideRow}>
      <span style={{ color: "#64748b", fontSize: 11 }}>{label}</span>
      <span style={{ color: "#f59e0b", fontSize: 11 }}>양호 {good}</span>
      <span style={{ color: "#22c55e", fontSize: 11 }}>우수 {great}</span>
    </div>
  );
}

function TradeRow({ trade: t, isMobile }: { trade: import("../hooks/useBacktest").Trade; isMobile?: boolean }) {
  const win    = t.pnl > 0;
  const dirColor = t.direction === "long" ? "#ef4444" : "#3b82f6";
  const fmtDate  = (ts: number) => {
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };
  return (
    <div style={{ ...styles.tradeRow, ...(isMobile ? styles.tradeRowMobile : {}), background: win ? "#22c55e08" : "#ef444408" }}>
      <span style={{ color: "#64748b" }}>{fmtDate(t.entry_date)}</span>
      <span style={{ color: dirColor, fontWeight: 600 }}>{t.direction === "long" ? "롱" : "숏"}</span>
      <span style={{ color: "#94a3b8" }}>{t.units}u</span>
      <span>{t.entry_price.toLocaleString()}</span>
      <span>{t.exit_price.toLocaleString()}</span>
      <span style={{ textAlign: "right", color: win ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
        {t.pnl_pct > 0 ? "+" : ""}{t.pnl_pct.toFixed(2)}%
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflowY: "auto",
    gap: 0,
  },
  section: {
    padding: "12px 16px",
    borderBottom: "1px solid #1e293b",
    flexShrink: 0,
  },
  sectionTitle: {
    margin: "0 0 10px",
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 6,
  },
  bigStat: {
    background: "#1e293b",
    borderRadius: 8,
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  bigStatLabel: {
    fontSize: 11,
    color: "#64748b",
  },
  bigStatValue: {
    fontSize: 18,
    fontWeight: 700,
  },
  stat: {
    background: "#1e293b",
    borderRadius: 6,
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  statLabel: {
    fontSize: 10,
    color: "#64748b",
  },
  statValue: {
    fontSize: 15,
    fontWeight: 600,
  },
  guide: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  guideRow: {
    display: "flex",
    justifyContent: "space-between",
    background: "#1e293b",
    borderRadius: 4,
    padding: "6px 10px",
  },
  tradeList: {
    overflowY: "auto",
    maxHeight: 280,
    fontSize: 12,
  },
  tradeHeader: {
    display: "grid",
    gridTemplateColumns: "90px 40px 35px 70px 70px 1fr",
    gap: 4,
    padding: "4px 8px",
    color: "#475569",
    fontSize: 11,
    borderBottom: "1px solid #1e293b",
    position: "sticky",
    top: 0,
    background: "#0f172a",
  },
  tradeRow: {
    display: "grid",
    gridTemplateColumns: "90px 40px 35px 70px 70px 1fr",
    gap: 4,
    padding: "6px 8px",
    borderBottom: "1px solid #1e293b22",
    fontSize: 12,
    color: "#f1f5f9",
  },
  tradeRowMobile: {
    gridTemplateColumns: "80px 36px 30px 1fr 1fr 56px",
    fontSize: 11,
  },
};
