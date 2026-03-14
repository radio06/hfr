import { useState, useEffect } from "react";
import { useBacktest } from "./hooks/useBacktest";
import BacktestChart from "./components/BacktestChart";
import MetricsPanel from "./components/MetricsPanel";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

type SystemTab = 1 | 2;

export default function App() {
  const [system, setSystem]   = useState<SystemTab>(1);
  const [years,  setYears]    = useState(5);
  const { data, loading, error } = useBacktest(system, years);
  const isMobile = useIsMobile();

  return (
    <div style={{ ...styles.page, ...(isMobile ? mobileStyles.page : {}) }}>
      {/* ── 헤더 ── */}
      <header style={{ ...styles.header, ...(isMobile ? mobileStyles.header : {}) }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h1 style={styles.title}>
            터틀 트레이딩 백테스트
            <span style={styles.badge}>HFR (230240.KQ)</span>
          </h1>
          <p style={styles.sub}>Turtle Trading System · Donchian Breakout · Position Sizing by N(ATR)</p>
        </div>

        <div style={{ ...styles.controls, ...(isMobile ? mobileStyles.controls : {}) }}>
          {/* 기간 선택 */}
          <div style={styles.controlGroup}>
            <span style={styles.controlLabel}>기간</span>
            {([3, 5, 7, 10] as const).map((y) => (
              <button
                key={y}
                style={{ ...styles.btn, ...(years === y ? styles.btnActive : {}) }}
                onClick={() => setYears(y)}
              >
                {y}년
              </button>
            ))}
          </div>

          {/* 시스템 탭 */}
          <div style={styles.controlGroup}>
            <span style={styles.controlLabel}>전략</span>
            <button
              style={{ ...styles.btn, ...(system === 1 ? styles.btnSys1 : {}) }}
              onClick={() => setSystem(1)}
            >
              System 1 <span style={styles.btnSub}>20/10일</span>
            </button>
            <button
              style={{ ...styles.btn, ...(system === 2 ? styles.btnSys2 : {}) }}
              onClick={() => setSystem(2)}
            >
              System 2 <span style={styles.btnSub}>55/20일</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 시스템 설명 배너 ── */}
      <div style={styles.banner}>
        {system === 1 ? (
          <>
            <BannerTag color="#f59e0b">진입</BannerTag> 20일 최고/저가 돌파 &nbsp;
            <BannerTag color="#64748b">청산</BannerTag> 10일 역돌파 &nbsp;
            <BannerTag color="#6366f1">스킵룰</BannerTag> 직전 승리 시 동방향 다음 신호 건너뜀 &nbsp;
            <BannerTag color="#22c55e">피라미딩</BannerTag> 0.5N마다 최대 4단위 추가
          </>
        ) : (
          <>
            <BannerTag color="#f59e0b">진입</BannerTag> 55일 최고/저가 돌파 &nbsp;
            <BannerTag color="#64748b">청산</BannerTag> 20일 역돌파 &nbsp;
            <BannerTag color="#6366f1">스킵룰 없음</BannerTag> 모든 신호 진입 &nbsp;
            <BannerTag color="#22c55e">피라미딩</BannerTag> 0.5N마다 최대 4단위 추가
          </>
        )}
        &nbsp;·&nbsp;
        <BannerTag color="#94a3b8">리스크</BannerTag> 단위당 1% · 2N 손절 · 초기자본 1억원
      </div>

      {/* ── 본문 ── */}
      <main style={{ ...styles.main, ...(isMobile ? mobileStyles.main : {}) }}>
        {loading && (
          <div style={styles.center}>
            <div style={styles.spinner} />
            <p style={{ color: "#64748b", fontSize: 14, marginTop: 16 }}>
              백테스트 계산 중... (데이터 다운로드 + 전략 시뮬레이션)
            </p>
          </div>
        )}
        {error && (
          <div style={styles.center}>
            <p style={{ color: "#ef4444", fontSize: 15 }}>오류: {error}</p>
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>
              백엔드 서버 확인: {import.meta.env.VITE_API_URL ?? "http://localhost:8000"}
            </p>
          </div>
        )}
        {!loading && !error && data && (
          <div style={{ ...styles.body, ...(isMobile ? mobileStyles.body : {}) }}>
            {/* 차트 영역 */}
            <div style={{ ...styles.chartArea, ...(isMobile ? mobileStyles.chartArea : {}) }}>
              <BacktestChart data={data} />
            </div>
            {/* 지표 패널 */}
            <div style={{ ...styles.sidePanel, ...(isMobile ? mobileStyles.sidePanel : {}) }}>
              <MetricsPanel
                metrics={data.metrics}
                trades={data.trades}
                system={system}
                isMobile={isMobile}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function BannerTag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      background: color + "22",
      color,
      padding: "1px 6px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

const mobileStyles: Record<string, React.CSSProperties> = {
  page: {
    height: "auto",
    minHeight: "100vh",
    overflow: "visible",
  },
  header: {
    flexDirection: "column",
    alignItems: "flex-start",
    padding: "10px 14px",
  },
  controls: {
    width: "100%",
    gap: 8,
  },
  main: {
    flex: "none",
    overflow: "visible",
    minHeight: 0,
  },
  body: {
    flexDirection: "column",
    height: "auto",
  },
  chartArea: {
    flex: "none",
    height: 360,
    padding: "8px 8px",
    overflow: "hidden",
  },
  sidePanel: {
    width: "100%",
    borderLeft: "none",
    borderTop: "1px solid #1e293b",
    overflowY: "visible",
    height: "auto",
  },
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "#0a0f1e",
    color: "#f1f5f9",
    fontFamily: "'Pretendard', 'Noto Sans KR', 'Inter', sans-serif",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: "1px solid #1e293b",
    background: "#0f172a",
    flexShrink: 0,
    gap: 16,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    fontSize: 12,
    fontWeight: 400,
    color: "#64748b",
    background: "#1e293b",
    padding: "2px 8px",
    borderRadius: 4,
  },
  sub: {
    margin: "3px 0 0",
    fontSize: 11,
    color: "#475569",
  },
  controls: {
    display: "flex",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  controlGroup: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: "#1e293b",
    borderRadius: 8,
    padding: "4px 8px",
  },
  controlLabel: {
    fontSize: 11,
    color: "#64748b",
    marginRight: 4,
  },
  btn: {
    background: "transparent",
    border: "none",
    color: "#64748b",
    padding: "4px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    transition: "all 0.15s",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  btnActive: {
    background: "#334155",
    color: "#f1f5f9",
  },
  btnSys1: {
    background: "#92400e44",
    color: "#f59e0b",
    fontWeight: 700,
  },
  btnSys2: {
    background: "#312e8144",
    color: "#818cf8",
    fontWeight: 700,
  },
  btnSub: {
    fontSize: 10,
    opacity: 0.7,
  },
  banner: {
    padding: "6px 20px",
    background: "#0f172a",
    borderBottom: "1px solid #1e293b",
    fontSize: 12,
    color: "#94a3b8",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  main: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  body: {
    display: "flex",
    height: "100%",
  },
  chartArea: {
    flex: 1,
    minWidth: 0,
    padding: "8px 0 8px 8px",
    overflow: "hidden",
  },
  sidePanel: {
    width: 340,
    flexShrink: 0,
    borderLeft: "1px solid #1e293b",
    overflowY: "auto",
    background: "#0f172a",
  },
  center: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid #1e293b",
    borderTop: "3px solid #6366f1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
