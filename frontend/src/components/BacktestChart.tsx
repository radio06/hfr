import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  createSeriesMarkers,
  LineStyle,
} from "lightweight-charts";
import type { UTCTimestamp, SeriesMarker } from "lightweight-charts";
import type { BacktestResult } from "../hooks/useBacktest";

interface Props {
  data: BacktestResult;
}

const ts = (t: number) => t as unknown as UTCTimestamp;

export default function BacktestChart({ data }: Props) {
  const mainRef   = useRef<HTMLDivElement>(null);
  const equityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mainRef.current || !equityRef.current || data.ohlcv.length === 0) return;

    const CHART_OPTS = {
      layout: {
        background: { type: ColorType.Solid, color: "#0f172a" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#334155" },
      timeScale: { borderColor: "#334155", timeVisible: true, secondsVisible: false },
    };

    // ── 메인 차트 (캔들 + 채널 + 볼륨) ──────────────────────────────────────
    const mainChart = createChart(mainRef.current, {
      ...CHART_OPTS,
      width:  mainRef.current.clientWidth,
      height: mainRef.current.clientHeight,
    });

    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor:        "#ef4444",
      downColor:      "#3b82f6",
      borderUpColor:  "#ef4444",
      borderDownColor:"#3b82f6",
      wickUpColor:    "#ef4444",
      wickDownColor:  "#3b82f6",
    });

    // 볼륨 (보조 스케일)
    const volSeries = mainChart.addSeries(HistogramSeries, {
      color:       "#334155",
      priceFormat: { type: "volume" },
      priceScaleId:"volume",
    });
    mainChart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    // 돈치안 진입 채널
    const ehSeries = mainChart.addSeries(LineSeries, {
      color:     "#f59e0b",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const elSeries = mainChart.addSeries(LineSeries, {
      color:     "#f59e0b",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // 돈치안 청산 채널
    const exhSeries = mainChart.addSeries(LineSeries, {
      color:     "#64748b",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const exlSeries = mainChart.addSeries(LineSeries, {
      color:     "#64748b",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // 데이터 세팅
    candleSeries.setData(data.ohlcv.map((d) => ({
      time: ts(d.time), open: d.open, high: d.high, low: d.low, close: d.close,
    })));
    volSeries.setData(data.ohlcv.map((d) => ({
      time: ts(d.time), value: d.volume,
      color: d.close >= d.open ? "#ef444440" : "#3b82f640",
    })));
    ehSeries.setData(data.channels.entry_high.map((p) => ({ time: ts(p.time), value: p.value })));
    elSeries.setData(data.channels.entry_low.map((p)  => ({ time: ts(p.time), value: p.value })));
    exhSeries.setData(data.channels.exit_high.map((p) => ({ time: ts(p.time), value: p.value })));
    exlSeries.setData(data.channels.exit_low.map((p)  => ({ time: ts(p.time), value: p.value })));

    // 트레이딩 마커
    const markers: SeriesMarker<UTCTimestamp>[] = data.signals
      .filter((s) => ["long","short","exit_long","exit_short"].includes(s.type))
      .map((s) => {
        switch (s.type) {
          case "long":
            return { time: ts(s.time), position: "belowBar" as const,
                     color: "#22c55e", shape: "arrowUp" as const,
                     text: `L${data.system === 1 ? "20" : "55"}` };
          case "short":
            return { time: ts(s.time), position: "aboveBar" as const,
                     color: "#f97316", shape: "arrowDown" as const,
                     text: `S${data.system === 1 ? "20" : "55"}` };
          case "exit_long":
            return { time: ts(s.time), position: "aboveBar" as const,
                     color: "#94a3b8", shape: "square" as const, text: "XL" };
          case "exit_short":
            return { time: ts(s.time), position: "belowBar" as const,
                     color: "#94a3b8", shape: "square" as const, text: "XS" };
          default:
            return null;
        }
      })
      .filter(Boolean) as SeriesMarker<UTCTimestamp>[];

    createSeriesMarkers(candleSeries, markers);
    mainChart.timeScale().fitContent();

    // ── 에쿼티 차트 ────────────────────────────────────────────────────────────
    const eqChart = createChart(equityRef.current, {
      ...CHART_OPTS,
      width:  equityRef.current.clientWidth,
      height: equityRef.current.clientHeight,
    });

    const eqSeries = eqChart.addSeries(LineSeries, {
      color:     "#6366f1",
      lineWidth: 2,
      priceLineVisible: false,
    });

    // 수익구간 AreaSeries (에쿼티)
    eqSeries.setData(
      data.equity_curve.map((e) => ({ time: ts(e.time), value: e.value }))
    );
    eqChart.timeScale().fitContent();

    let disposed = false;

    // 리사이즈 옵저버
    const mainRo = new ResizeObserver(() => {
      if (!disposed && mainRef.current)
        mainChart.applyOptions({ width: mainRef.current.clientWidth,
                                  height: mainRef.current.clientHeight });
    });
    const eqRo = new ResizeObserver(() => {
      if (!disposed && equityRef.current)
        eqChart.applyOptions({ width: equityRef.current.clientWidth,
                                height: equityRef.current.clientHeight });
    });
    mainRo.observe(mainRef.current);
    eqRo.observe(equityRef.current);

    // 시간축 동기화
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const syncMainToEq = (range: any) => {
      if (!disposed && range) eqChart.timeScale().setVisibleLogicalRange(range);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const syncEqToMain = (range: any) => {
      if (!disposed && range) mainChart.timeScale().setVisibleLogicalRange(range);
    };
    mainChart.timeScale().subscribeVisibleLogicalRangeChange(syncMainToEq);
    eqChart.timeScale().subscribeVisibleLogicalRangeChange(syncEqToMain);

    return () => {
      disposed = true;
      mainRo.disconnect();
      eqRo.disconnect();
      mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncMainToEq);
      eqChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncEqToMain);
      mainChart.remove();
      eqChart.remove();
    };
  }, [data]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 4 }}>
      {/* 범례 */}
      <div style={styles.legend}>
        <LegendItem color="#f59e0b" label={`진입 채널 (${data.system === 1 ? "20" : "55"}일)`} dashed />
        <LegendItem color="#64748b" label={`청산 채널 (${data.system === 1 ? "10" : "20"}일)`} dotted />
        <LegendItem color="#22c55e" label="롱 진입" arrow="↑" />
        <LegendItem color="#f97316" label="숏 진입" arrow="↓" />
        <LegendItem color="#94a3b8" label="청산" square />
      </div>

      {/* 캔들 차트 */}
      <div style={{ flex: "0 0 62%", minHeight: 0 }}>
        <div ref={mainRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* 에쿼티 차트 */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <div style={styles.equityLabel}>에쿼티 커브 (1억 시작)</div>
        <div ref={equityRef} style={{ width: "100%", height: "calc(100% - 20px)" }} />
      </div>
    </div>
  );
}

function LegendItem({ color, label, dashed, dotted, arrow, square }: {
  color: string; label: string;
  dashed?: boolean; dotted?: boolean; arrow?: string; square?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#94a3b8" }}>
      {arrow ? (
        <span style={{ color, fontSize: 14, lineHeight: 1 }}>{arrow}</span>
      ) : square ? (
        <span style={{ width: 8, height: 8, background: color, display: "inline-block", borderRadius: 1 }} />
      ) : (
        <span style={{
          width: 18, height: 2, display: "inline-block",
          background: dashed || dotted ? "none" : color,
          borderTop: dashed ? `2px dashed ${color}` : dotted ? `2px dotted ${color}` : undefined,
        }} />
      )}
      {label}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  legend: {
    display: "flex",
    gap: 16,
    padding: "4px 8px",
    flexWrap: "wrap",
    flexShrink: 0,
  },
  equityLabel: {
    fontSize: 11,
    color: "#475569",
    padding: "2px 8px",
    height: 20,
  },
};
