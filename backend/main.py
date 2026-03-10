from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

app = FastAPI(title="HFR Turtle Backtest API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Cloud Run 배포 후 프론트 URL로 제한 가능
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

TICKER = "230240.KQ"
ISC_TICKER = "095340.KQ"
INITIAL_CAPITAL = 100_000_000  # 1억원
RISK_PCT = 0.01               # 단위당 1% 리스크


# ── 데이터 로드 ────────────────────────────────────────────────────────────────

def _fetch_df(years: int) -> pd.DataFrame:
    end = datetime.today()
    start = end - timedelta(days=365 * years + 120)
    df = yf.download(
        TICKER,
        start=start.strftime("%Y-%m-%d"),
        end=end.strftime("%Y-%m-%d"),
        progress=False,
        auto_adjust=True,
    )
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.dropna().sort_index()
    df.index = pd.to_datetime(df.index)
    return df


def _fetch_df_range(ticker: str, start: str, end: str) -> pd.DataFrame:
    """지정 종목·기간 데이터 로드 (ATR 워밍업용 여유 120일 포함)"""
    start_dt = datetime.strptime(start, "%Y-%m-%d") - timedelta(days=120)
    df = yf.download(
        ticker,
        start=start_dt.strftime("%Y-%m-%d"),
        end=end,
        progress=False,
        auto_adjust=True,
    )
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for {ticker}")
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.dropna().sort_index()
    df.index = pd.to_datetime(df.index)
    return df


# ── ATR (Wilder's N) ───────────────────────────────────────────────────────────

def _compute_N(df: pd.DataFrame, period: int = 20) -> pd.Series:
    tr = pd.concat([
        df["High"] - df["Low"],
        (df["High"] - df["Close"].shift(1)).abs(),
        (df["Low"]  - df["Close"].shift(1)).abs(),
    ], axis=1).max(axis=1)

    result: list[float] = [float("nan")] * len(df)
    for i in range(len(df)):
        if i < period - 1:
            continue
        if i == period - 1:
            result[i] = float(tr.iloc[:period].mean())
        else:
            result[i] = (result[i - 1] * (period - 1) + float(tr.iloc[i])) / period
    return pd.Series(result, index=df.index)


# ── 핵심 백테스트 ──────────────────────────────────────────────────────────────

def _run_backtest(df: pd.DataFrame, system: int,
                  initial_capital: float, risk_pct: float,
                  pyramid_n_mult: float = 0.5,
                  trade_start_ts: int | None = None) -> dict:
    """
    trade_start_ts: 이 타임스탬프 이전에는 진입 불가 (워밍업 기간 격리용)
    """
    entry_period = 20 if system == 1 else 55
    exit_period  = 10 if system == 1 else 20

    N_series = _compute_N(df, 20)

    # 돈치안 채널 (1봉 시프트로 미래 데이터 방지)
    dc_eh  = df["High"].rolling(entry_period).max().shift(1)
    dc_el  = df["Low"].rolling(entry_period).min().shift(1)
    dc_exh = df["High"].rolling(exit_period).max().shift(1)
    dc_exl = df["Low"].rolling(exit_period).min().shift(1)

    # ── 상태 변수 ──
    capital      = initial_capital
    pos          = 0        # 0=flat, 1=long, -1=short
    units        = 0
    u_shares     = 0        # 단위당 주식 수
    ep_list: list[float] = []   # 각 단위 진입가
    avg_ep       = 0.0
    stop         = 0.0
    last_add     = 0.0
    cap_at_entry = 0.0
    entry_ts     = 0

    last_long_win:  bool | None = None
    last_short_win: bool | None = None

    signals: list[dict] = []
    trades:  list[dict] = []
    equity:  list[dict] = []
    ch: dict[str, list] = {"entry_high": [], "entry_low": [],
                            "exit_high":  [], "exit_low":  []}

    min_bar = max(entry_period, 20) + 1

    for i, (idx, bar) in enumerate(df.iterrows()):
        ts  = int(idx.timestamp())
        n_v = N_series.iloc[i]
        eh  = dc_eh.iloc[i]
        el  = dc_el.iloc[i]
        exh = dc_exh.iloc[i]
        exl = dc_exl.iloc[i]
        hi  = float(bar["High"])
        lo  = float(bar["Low"])
        cl  = float(bar["Close"])

        # 채널 데이터 수집
        for key, val in [("entry_high", eh), ("entry_low", el),
                         ("exit_high", exh), ("exit_low", exl)]:
            if not (isinstance(val, float) and np.isnan(val)):
                ch[key].append({"time": ts, "value": round(float(val), 2)})

        if i < min_bar or np.isnan(float(n_v)) or np.isnan(float(eh)):
            equity.append({"time": ts, "value": round(capital, 0)})
            continue

        n = float(n_v)

        # ── 청산 ──────────────────────────────────────────────────────────────
        if pos == 1:
            trig_ch   = not np.isnan(float(exl)) and lo < float(exl)
            trig_stop = lo < stop
            if trig_ch or trig_stop:
                xp  = float(exl) if trig_ch else stop
                xp  = max(xp, lo)
                tot = units * u_shares
                pnl = (xp - avg_ep) * tot
                capital += pnl
                last_long_win = pnl > 0
                trades.append(_make_trade(entry_ts, ts, "long",
                                          avg_ep, xp, units, tot, pnl, cap_at_entry))
                signals.append({"time": ts, "type": "exit_long",  "price": round(xp, 2)})
                pos = 0; units = 0; ep_list = []

        elif pos == -1:
            trig_ch   = not np.isnan(float(exh)) and hi > float(exh)
            trig_stop = hi > stop
            if trig_ch or trig_stop:
                xp  = float(exh) if trig_ch else stop
                xp  = min(xp, hi)
                tot = units * u_shares
                pnl = (avg_ep - xp) * tot
                capital += pnl
                last_short_win = pnl > 0
                trades.append(_make_trade(entry_ts, ts, "short",
                                          avg_ep, xp, units, tot, pnl, cap_at_entry))
                signals.append({"time": ts, "type": "exit_short", "price": round(xp, 2)})
                pos = 0; units = 0; ep_list = []

        # ── 피라미딩 (최대 4단위) ─────────────────────────────────────────────
        if pos == 1 and units < 4 and cl >= last_add + pyramid_n_mult * n:
            ep_list.append(cl)
            avg_ep   = sum(ep_list) / len(ep_list)
            stop     = avg_ep - 2 * n
            last_add = cl
            units   += 1
            signals.append({"time": ts, "type": "add_long",  "price": round(cl, 2)})

        elif pos == -1 and units < 4 and cl <= last_add - pyramid_n_mult * n:
            ep_list.append(cl)
            avg_ep   = sum(ep_list) / len(ep_list)
            stop     = avg_ep + 2 * n
            last_add = cl
            units   += 1
            signals.append({"time": ts, "type": "add_short", "price": round(cl, 2)})

        # ── 진입 ──────────────────────────────────────────────────────────────
        if pos == 0 and (trade_start_ts is None or ts >= trade_start_ts):
            if not np.isnan(float(eh)) and hi > float(eh):
                # System 1: 직전 롱이 수익이었으면 건너뜀
                skip = (system == 1 and last_long_win is True)
                if not skip:
                    xp       = float(eh)
                    u_shares = max(1, int(capital * risk_pct / n))
                    pos = 1; units = 1; ep_list = [xp]
                    avg_ep = xp; stop = xp - 2 * n; last_add = xp
                    cap_at_entry = capital; entry_ts = ts
                    signals.append({"time": ts, "type": "long",  "price": round(xp, 2)})
                last_long_win = None   # 신호 소비(스킵 포함)

            elif not np.isnan(float(el)) and lo < float(el):
                skip = (system == 1 and last_short_win is True)
                if not skip:
                    xp       = float(el)
                    u_shares = max(1, int(capital * risk_pct / n))
                    pos = -1; units = 1; ep_list = [xp]
                    avg_ep = xp; stop = xp + 2 * n; last_add = xp
                    cap_at_entry = capital; entry_ts = ts
                    signals.append({"time": ts, "type": "short", "price": round(xp, 2)})
                last_short_win = None

        # 시가평가 자본
        if pos == 1:
            mkt = capital + (cl - avg_ep) * units * u_shares
        elif pos == -1:
            mkt = capital + (avg_ep - cl) * units * u_shares
        else:
            mkt = capital
        equity.append({"time": ts, "value": round(mkt, 0)})

    # 마지막 열린 포지션 강제 청산
    if pos != 0 and len(df) > 0:
        last_bar = df.iloc[-1]
        cl  = float(last_bar["Close"])
        ts  = int(last_bar.name.timestamp())
        tot = units * u_shares
        pnl = (cl - avg_ep) * tot if pos == 1 else (avg_ep - cl) * tot
        capital += pnl
        trades.append(_make_trade(entry_ts, ts,
                                  "long" if pos == 1 else "short",
                                  avg_ep, cl, units, tot, pnl, cap_at_entry))

    return {
        "system":     system,
        "signals":    signals,
        "channels":   ch,
        "equity_curve": equity,
        "trades":     trades,
        "metrics":    _calc_metrics(equity, trades, initial_capital),
    }


def _make_trade(entry_ts, exit_ts, direction, avg_ep, xp,
                units, shares, pnl, cap_at_entry) -> dict:
    return {
        "entry_date":  entry_ts,
        "exit_date":   exit_ts,
        "direction":   direction,
        "entry_price": round(avg_ep, 2),
        "exit_price":  round(xp, 2),
        "units":       units,
        "shares":      shares,
        "pnl":         round(pnl, 0),
        "pnl_pct":     round(pnl / cap_at_entry * 100, 2) if cap_at_entry > 0 else 0,
    }


def _calc_metrics(equity: list[dict], trades: list[dict],
                  initial_capital: float) -> dict:
    if not equity:
        return {}

    vals  = [e["value"] for e in equity]
    final = vals[-1]

    total_ret = (final - initial_capital) / initial_capital * 100
    n_years   = len(vals) / 252
    cagr      = ((final / initial_capital) ** (1 / n_years) - 1) * 100 \
                if n_years > 0 and final > 0 else 0.0

    rets = np.array(
        [(vals[i] - vals[i - 1]) / vals[i - 1]
         for i in range(1, len(vals)) if vals[i - 1] > 0]
    )
    sharpe  = float(rets.mean() / rets.std() * np.sqrt(252)) \
              if len(rets) > 1 and rets.std() > 0 else 0.0
    down    = rets[rets < 0]
    sortino = float(rets.mean() / down.std() * np.sqrt(252)) \
              if len(down) > 1 and down.std() > 0 else 0.0

    # MDD
    peak = vals[0]; mdd = 0.0
    for v in vals:
        peak = max(peak, v)
        mdd  = max(mdd, (peak - v) / peak * 100)

    calmar = cagr / mdd if mdd > 0 else 0.0

    wins   = [t for t in trades if t["pnl"] > 0]
    losses = [t for t in trades if t["pnl"] <= 0]
    gw = sum(t["pnl"] for t in wins)
    gl = abs(sum(t["pnl"] for t in losses))
    pf = gw / gl if gl > 0 else 999.0

    # 최대 연속 손실
    streak = max_streak = 0
    for t in trades:
        if t["pnl"] <= 0:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 0

    return {
        "total_return":    round(total_ret, 2),
        "cagr":            round(cagr, 2),
        "sharpe":          round(sharpe, 2),
        "sortino":         round(sortino, 2),
        "calmar":          round(calmar, 2),
        "mdd":             round(mdd, 2),
        "win_rate":        round(len(wins) / len(trades) * 100, 1) if trades else 0,
        "profit_factor":   round(min(pf, 99.9), 2),
        "avg_win_pct":     round(float(np.mean([t["pnl_pct"] for t in wins])),  2) if wins   else 0,
        "avg_loss_pct":    round(float(np.mean([t["pnl_pct"] for t in losses])), 2) if losses else 0,
        "max_loss_streak": max_streak,
        "num_trades":      len(trades),
        "num_wins":        len(wins),
        "num_losses":      len(losses),
        "final_capital":   round(final, 0),
    }


# ── 엔드포인트 ─────────────────────────────────────────────────────────────────

@app.get("/api/ohlcv")
def get_ohlcv(years: int = 5):
    df = _fetch_df(years)
    records = [
        {"time": int(idx.timestamp()),
         "open":  round(float(r["Open"]),  2),
         "high":  round(float(r["High"]),  2),
         "low":   round(float(r["Low"]),   2),
         "close": round(float(r["Close"]), 2),
         "volume": int(r["Volume"])}
        for idx, r in df.iterrows()
    ]
    return {"ticker": TICKER, "name": "HFR (에이치에프알)",
            "count": len(records), "data": records}


@app.get("/api/backtest")
def get_backtest(
    system: int = Query(1, ge=1, le=2),
    years:  int = Query(5, ge=1, le=10),
):
    df     = _fetch_df(years)
    result = _run_backtest(df, system=system,
                           initial_capital=INITIAL_CAPITAL,
                           risk_pct=RISK_PCT)
    # OHLCV 포함 (프론트에서 별도 호출 불필요)
    result["ohlcv"] = [
        {"time": int(idx.timestamp()),
         "open":  round(float(r["Open"]),  2),
         "high":  round(float(r["High"]),  2),
         "low":   round(float(r["Low"]),   2),
         "close": round(float(r["Close"]), 2),
         "volume": int(r["Volume"])}
        for idx, r in df.iterrows()
    ]
    result["ticker"] = TICKER
    result["name"]   = "HFR (에이치에프알)"
    return result


@app.get("/api/backtest/isc")
def get_backtest_isc():
    """코스닥 ISC (095340.KQ) 터틀 System 1 백테스트 · 2020~2023 고정"""
    BACKTEST_START = "2020-01-01"
    BACKTEST_END   = "2024-01-01"   # yfinance end는 exclusive → 2023-12-31 포함

    df_full = _fetch_df_range(ISC_TICKER, BACKTEST_START, BACKTEST_END)

    # 2020-01-01 이전은 채널 워밍업만 — 실제 진입은 2020-01-01부터
    cutoff = int(datetime(2020, 1, 1).timestamp())
    result = _run_backtest(df_full, system=1,
                           initial_capital=INITIAL_CAPITAL,
                           risk_pct=RISK_PCT,
                           pyramid_n_mult=1.0,
                           trade_start_ts=cutoff)
    result["ohlcv"] = [
        {"time": int(idx.timestamp()),
         "open":  round(float(r["Open"]),  2),
         "high":  round(float(r["High"]),  2),
         "low":   round(float(r["Low"]),   2),
         "close": round(float(r["Close"]), 2),
         "volume": int(r["Volume"])}
        for idx, r in df_full.iterrows()
        if int(idx.timestamp()) >= cutoff
    ]
    result["channels"] = {
        k: [p for p in v if p["time"] >= cutoff]
        for k, v in result["channels"].items()
    }
    result["equity_curve"] = [
        e for e in result["equity_curve"] if e["time"] >= cutoff
    ]
    result["signals"] = [
        s for s in result["signals"] if s["time"] >= cutoff
    ]
    result["ticker"] = ISC_TICKER
    result["name"]   = "ISC (아이에스씨)"
    return result


@app.get("/api/health")
def health():
    return {"status": "ok"}
