"""yfinance-backed tools: quotes, history, fundamentals, options."""
from __future__ import annotations

from datetime import datetime
from typing import Any

import yfinance as yf


def _clean(obj: Any) -> Any:
    """Recursively strip NaN/inf and coerce pandas/numpy types for JSON."""
    import math

    import numpy as np
    import pandas as pd

    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items() if v is not None}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        v = float(obj)
        return v if math.isfinite(v) else None
    if isinstance(obj, (pd.Timestamp, datetime)):
        return obj.isoformat()
    if isinstance(obj, np.ndarray):
        return _clean(obj.tolist())
    return obj


def get_quote(symbol: str) -> dict:
    """Latest price + day range + session context for a ticker."""
    t = yf.Ticker(symbol)
    fast = getattr(t, "fast_info", {}) or {}
    info = {}
    try:
        info = t.info or {}
    except Exception:
        pass

    price = fast.get("last_price") or info.get("regularMarketPrice")
    prev_close = fast.get("previous_close") or info.get("regularMarketPreviousClose")
    change = None
    change_pct = None
    if price is not None and prev_close:
        change = price - prev_close
        change_pct = (change / prev_close) * 100

    return _clean({
        "symbol": symbol.upper(),
        "name": info.get("shortName") or info.get("longName"),
        "price": price,
        "previous_close": prev_close,
        "change": change,
        "change_pct": change_pct,
        "day_high": fast.get("day_high"),
        "day_low": fast.get("day_low"),
        "year_high": fast.get("year_high"),
        "year_low": fast.get("year_low"),
        "volume": fast.get("last_volume") or info.get("volume"),
        "avg_volume_10d": fast.get("ten_day_average_volume"),
        "market_cap": fast.get("market_cap") or info.get("marketCap"),
        "currency": fast.get("currency") or info.get("currency"),
        "exchange": info.get("exchange"),
    })


def get_multi_quote(symbols: list[str]) -> list[dict]:
    """Batch quotes for multiple tickers."""
    return [get_quote(s) for s in symbols]


def get_history(symbol: str, period: str = "6mo", interval: str = "1d") -> dict:
    """Historical OHLCV. period: 1d,5d,1mo,3mo,6mo,1y,2y,5y,10y,ytd,max. interval: 1m,5m,15m,1h,1d,1wk,1mo."""
    t = yf.Ticker(symbol)
    df = t.history(period=period, interval=interval, auto_adjust=False)
    if df.empty:
        return {"symbol": symbol.upper(), "bars": []}
    df = df.reset_index()
    date_col = "Date" if "Date" in df.columns else "Datetime"
    bars = [
        {
            "t": row[date_col].isoformat() if hasattr(row[date_col], "isoformat") else str(row[date_col]),
            "o": float(row["Open"]),
            "h": float(row["High"]),
            "l": float(row["Low"]),
            "c": float(row["Close"]),
            "v": int(row["Volume"]) if row["Volume"] == row["Volume"] else 0,
        }
        for _, row in df.iterrows()
    ]
    return _clean({
        "symbol": symbol.upper(),
        "period": period,
        "interval": interval,
        "bars": bars,
    })


def get_fundamentals(symbol: str) -> dict:
    """Valuation ratios, margins, growth, balance sheet highlights."""
    t = yf.Ticker(symbol)
    try:
        info = t.info or {}
    except Exception:
        info = {}

    keys = [
        "shortName", "longName", "sector", "industry", "country", "website",
        "marketCap", "enterpriseValue", "trailingPE", "forwardPE", "pegRatio",
        "priceToBook", "priceToSalesTrailing12Months", "enterpriseToRevenue",
        "enterpriseToEbitda", "profitMargins", "grossMargins", "operatingMargins",
        "returnOnAssets", "returnOnEquity", "revenueGrowth", "earningsGrowth",
        "totalRevenue", "grossProfits", "ebitda", "netIncomeToCommon",
        "totalCash", "totalDebt", "debtToEquity", "currentRatio", "quickRatio",
        "freeCashflow", "operatingCashflow",
        "trailingEps", "forwardEps",
        "dividendYield", "dividendRate", "payoutRatio",
        "beta", "52WeekChange",
        "recommendationMean", "numberOfAnalystOpinions", "targetMeanPrice",
        "targetHighPrice", "targetLowPrice",
    ]
    return _clean({"symbol": symbol.upper(), **{k: info.get(k) for k in keys}})


def get_options_expirations(symbol: str) -> dict:
    """List available options expiration dates for a ticker."""
    t = yf.Ticker(symbol)
    expirations = list(t.options or [])
    return {"symbol": symbol.upper(), "expirations": expirations}


def get_options_chain(symbol: str, expiration: str | None = None) -> dict:
    """Options chain (calls + puts) for a given expiration. If expiration is omitted, uses the nearest."""
    t = yf.Ticker(symbol)
    expirations = list(t.options or [])
    if not expirations:
        return {"symbol": symbol.upper(), "error": "no options data"}
    exp = expiration or expirations[0]
    chain = t.option_chain(exp)

    def rows(df):
        df = df.fillna(0)
        return [
            {
                "contract": r["contractSymbol"],
                "strike": float(r["strike"]),
                "last": float(r["lastPrice"]),
                "bid": float(r["bid"]),
                "ask": float(r["ask"]),
                "volume": int(r["volume"]) if r["volume"] == r["volume"] else 0,
                "open_interest": int(r["openInterest"]) if r["openInterest"] == r["openInterest"] else 0,
                "iv": float(r["impliedVolatility"]),
                "itm": bool(r["inTheMoney"]),
            }
            for _, r in df.iterrows()
        ]

    return _clean({
        "symbol": symbol.upper(),
        "expiration": exp,
        "calls": rows(chain.calls),
        "puts": rows(chain.puts),
    })


def search_tickers(query: str, limit: int = 10) -> dict:
    """Fuzzy search for tickers by name/keyword (stocks, ETFs, crypto, forex)."""
    try:
        res = yf.Search(query, max_results=limit, enable_fuzzy_query=True)
        quotes = getattr(res, "quotes", []) or []
    except Exception as e:
        return {"query": query, "error": str(e), "results": []}
    results = [
        {
            "symbol": q.get("symbol"),
            "name": q.get("shortname") or q.get("longname"),
            "type": q.get("quoteType"),
            "exchange": q.get("exchange"),
        }
        for q in quotes
    ]
    return {"query": query, "results": results}
