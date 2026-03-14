import sqlite3
import json
import os

DB_PATH = os.environ.get("GA_DB_PATH", "/app/data/ga.db")

def _conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ga_runs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                stock_key   TEXT    NOT NULL,
                years       INTEGER NOT NULL,
                entry_period INTEGER NOT NULL,
                exit_period  INTEGER NOT NULL,
                calmar      REAL,
                cagr        REAL,
                mdd         REAL,
                sharpe      REAL,
                sortino     REAL,
                total_return REAL,
                final_capital REAL,
                win_rate    REAL,
                profit_factor REAL,
                num_trades  INTEGER,
                metrics_json TEXT,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(stock_key, years)
            )
        """)


def upsert_result(stock_key: str, years: int, entry_period: int,
                  exit_period: int, metrics: dict):
    with _conn() as conn:
        conn.execute("""
            INSERT INTO ga_runs
                (stock_key, years, entry_period, exit_period,
                 calmar, cagr, mdd, sharpe, sortino,
                 total_return, final_capital, win_rate, profit_factor,
                 num_trades, metrics_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(stock_key, years) DO UPDATE SET
                entry_period  = excluded.entry_period,
                exit_period   = excluded.exit_period,
                calmar        = excluded.calmar,
                cagr          = excluded.cagr,
                mdd           = excluded.mdd,
                sharpe        = excluded.sharpe,
                sortino       = excluded.sortino,
                total_return  = excluded.total_return,
                final_capital = excluded.final_capital,
                win_rate      = excluded.win_rate,
                profit_factor = excluded.profit_factor,
                num_trades    = excluded.num_trades,
                metrics_json  = excluded.metrics_json,
                created_at    = CURRENT_TIMESTAMP
        """, (
            stock_key, years, entry_period, exit_period,
            metrics.get("calmar", 0), metrics.get("cagr", 0),
            metrics.get("mdd", 0), metrics.get("sharpe", 0),
            metrics.get("sortino", 0), metrics.get("total_return", 0),
            metrics.get("final_capital", 0), metrics.get("win_rate", 0),
            metrics.get("profit_factor", 0), metrics.get("num_trades", 0),
            json.dumps(metrics),
        ))


def get_result(stock_key: str, years: int) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM ga_runs WHERE stock_key = ? AND years = ?",
            (stock_key, years),
        ).fetchone()
    if not row:
        return None
    return {
        "stock_key": row["stock_key"],
        "years": row["years"],
        "entry_period": row["entry_period"],
        "exit_period": row["exit_period"],
        "calmar": row["calmar"],
        "metrics": json.loads(row["metrics_json"]),
        "created_at": row["created_at"],
    }
