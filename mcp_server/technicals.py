"""Technical analysis: local indicators computed from yfinance history + Alpha Vantage fallbacks."""
from __future__ import annotations

import httpx
import numpy as np
import pandas as pd
import yfinance as yf

from .config import ALPHAVANTAGE_API_KEY, HTTP_TIMEOUT


def _closes(symbol: str, period: str = "1y", interval: str = "1d") -> pd.Series:
    df = yf.Ticker(symbol).history(period=period, interval=interval, auto_adjust=False)
    return df["Close"].dropna()


def compute_sma(symbol: str, window: int = 50, period: str = "1y") -> dict:
    """Simple moving average, plus current price vs SMA."""
    s = _closes(symbol, period=period)
    if len(s) < window:
        return {"symbol": symbol.upper(), "error": f"need {window} bars, got {len(s)}"}
    sma = s.rolling(window).mean().iloc[-1]
    price = float(s.iloc[-1])
    return {
        "symbol": symbol.upper(),
        "window": window,
        "sma": float(sma),
        "price": price,
        "price_vs_sma_pct": (price / float(sma) - 1) * 100,
    }


def compute_ema(symbol: str, window: int = 20, period: str = "1y") -> dict:
    """Exponential moving average."""
    s = _closes(symbol, period=period)
    if len(s) < window:
        return {"symbol": symbol.upper(), "error": f"need {window} bars, got {len(s)}"}
    ema = s.ewm(span=window, adjust=False).mean().iloc[-1]
    price = float(s.iloc[-1])
    return {
        "symbol": symbol.upper(),
        "window": window,
        "ema": float(ema),
        "price": price,
        "price_vs_ema_pct": (price / float(ema) - 1) * 100,
    }


def compute_rsi(symbol: str, period: int = 14, history: str = "1y") -> dict:
    """Relative Strength Index (Wilder's smoothing)."""
    s = _closes(symbol, period=history)
    if len(s) < period + 1:
        return {"symbol": symbol.upper(), "error": "not enough data"}
    delta = s.diff().dropna()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    value = float(rsi.iloc[-1])
    signal = "overbought" if value >= 70 else "oversold" if value <= 30 else "neutral"
    return {"symbol": symbol.upper(), "period": period, "rsi": value, "signal": signal}


def compute_macd(symbol: str, fast: int = 12, slow: int = 26, signal: int = 9, history: str = "1y") -> dict:
    """MACD line, signal line, histogram, and cross detection."""
    s = _closes(symbol, period=history)
    if len(s) < slow + signal:
        return {"symbol": symbol.upper(), "error": "not enough data"}
    ema_fast = s.ewm(span=fast, adjust=False).mean()
    ema_slow = s.ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    signal_line = macd.ewm(span=signal, adjust=False).mean()
    hist = macd - signal_line
    cross = "bullish" if hist.iloc[-1] > 0 and hist.iloc[-2] <= 0 else "bearish" if hist.iloc[-1] < 0 and hist.iloc[-2] >= 0 else "none"
    return {
        "symbol": symbol.upper(),
        "macd": float(macd.iloc[-1]),
        "signal": float(signal_line.iloc[-1]),
        "histogram": float(hist.iloc[-1]),
        "recent_cross": cross,
    }


def compute_bollinger(symbol: str, window: int = 20, num_std: float = 2.0, history: str = "1y") -> dict:
    """Bollinger bands + %B position."""
    s = _closes(symbol, period=history)
    if len(s) < window:
        return {"symbol": symbol.upper(), "error": "not enough data"}
    mid = s.rolling(window).mean()
    std = s.rolling(window).std()
    upper = mid + num_std * std
    lower = mid - num_std * std
    price = float(s.iloc[-1])
    pct_b = (price - float(lower.iloc[-1])) / (float(upper.iloc[-1]) - float(lower.iloc[-1])) if upper.iloc[-1] != lower.iloc[-1] else None
    return {
        "symbol": symbol.upper(),
        "window": window,
        "upper": float(upper.iloc[-1]),
        "middle": float(mid.iloc[-1]),
        "lower": float(lower.iloc[-1]),
        "price": price,
        "percent_b": pct_b,
    }


def compute_atr(symbol: str, period: int = 14, history: str = "6mo") -> dict:
    """Average True Range — volatility measure."""
    df = yf.Ticker(symbol).history(period=history, auto_adjust=False).dropna()
    if len(df) < period + 1:
        return {"symbol": symbol.upper(), "error": "not enough data"}
    high, low, close = df["High"], df["Low"], df["Close"]
    tr = pd.concat([
        (high - low),
        (high - close.shift()).abs(),
        (low - close.shift()).abs(),
    ], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1 / period, adjust=False).mean().iloc[-1]
    price = float(close.iloc[-1])
    return {
        "symbol": symbol.upper(),
        "period": period,
        "atr": float(atr),
        "atr_pct_of_price": float(atr) / price * 100,
    }


def compute_correlation(symbols: list[str], period: str = "6mo") -> dict:
    """Pairwise correlation matrix of daily returns."""
    prices = {}
    for s in symbols:
        prices[s.upper()] = _closes(s, period=period)
    df = pd.DataFrame(prices).dropna()
    if df.empty:
        return {"error": "no overlapping data"}
    returns = df.pct_change().dropna()
    corr = returns.corr()
    return {
        "period": period,
        "symbols": list(corr.columns),
        "matrix": corr.round(3).values.tolist(),
    }


def compute_volatility(symbol: str, period: str = "1y") -> dict:
    """Annualized volatility of daily log returns."""
    s = _closes(symbol, period=period)
    if len(s) < 30:
        return {"symbol": symbol.upper(), "error": "not enough data"}
    rets = np.log(s / s.shift(1)).dropna()
    daily = float(rets.std())
    return {
        "symbol": symbol.upper(),
        "period": period,
        "daily_vol_pct": daily * 100,
        "annualized_vol_pct": daily * (252 ** 0.5) * 100,
    }


def alphavantage_technical(symbol: str, indicator: str, interval: str = "daily", time_period: int = 14, series_type: str = "close") -> dict:
    """Fetch a technical indicator from Alpha Vantage. Indicators: RSI, MACD, SMA, EMA, BBANDS, STOCH, ADX, CCI, AROON, OBV, MFI, WILLR, ATR."""
    if not ALPHAVANTAGE_API_KEY:
        return {"error": "ALPHAVANTAGE_API_KEY not set"}
    params = {
        "function": indicator.upper(),
        "symbol": symbol,
        "interval": interval,
        "time_period": time_period,
        "series_type": series_type,
        "apikey": ALPHAVANTAGE_API_KEY,
    }
    r = httpx.get("https://www.alphavantage.co/query", params=params, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    data = r.json()
    tech_key = next((k for k in data if k.startswith("Technical")), None)
    if not tech_key:
        return {"symbol": symbol.upper(), "indicator": indicator, "raw": data}
    series = data[tech_key]
    items = sorted(series.items(), reverse=True)[:30]
    return {
        "symbol": symbol.upper(),
        "indicator": indicator.upper(),
        "interval": interval,
        "recent": [{"t": t, **{k: float(v) for k, v in vals.items()}} for t, vals in items],
    }


def alphavantage_forex(from_currency: str, to_currency: str) -> dict:
    """Real-time FX rate between two currencies."""
    if not ALPHAVANTAGE_API_KEY:
        return {"error": "ALPHAVANTAGE_API_KEY not set"}
    params = {
        "function": "CURRENCY_EXCHANGE_RATE",
        "from_currency": from_currency.upper(),
        "to_currency": to_currency.upper(),
        "apikey": ALPHAVANTAGE_API_KEY,
    }
    r = httpx.get("https://www.alphavantage.co/query", params=params, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    data = r.json().get("Realtime Currency Exchange Rate", {})
    return {
        "from": from_currency.upper(),
        "to": to_currency.upper(),
        "rate": float(data.get("5. Exchange Rate", 0) or 0),
        "bid": float(data.get("8. Bid Price", 0) or 0),
        "ask": float(data.get("9. Ask Price", 0) or 0),
        "timestamp": data.get("6. Last Refreshed"),
    }
