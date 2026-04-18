"""Local portfolio + watchlist state with performance analytics."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

from .config import PORTFOLIO_PATH, WATCHLIST_PATH


def _load(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def _save(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2))


def _load_portfolio() -> dict:
    return _load(PORTFOLIO_PATH, {"holdings": [], "cash": 0.0})


def _load_watchlist() -> list:
    return _load(WATCHLIST_PATH, [])


def add_holding(symbol: str, shares: float, cost_basis: float, purchase_date: str | None = None, notes: str = "") -> dict:
    """Add (or stack onto) a position. cost_basis is per-share price paid."""
    p = _load_portfolio()
    purchase_date = purchase_date or datetime.utcnow().date().isoformat()
    p["holdings"].append({
        "symbol": symbol.upper(),
        "shares": float(shares),
        "cost_basis": float(cost_basis),
        "purchase_date": purchase_date,
        "notes": notes,
    })
    _save(PORTFOLIO_PATH, p)
    return {"ok": True, "holdings_count": len(p["holdings"])}


def remove_holding(symbol: str, purchase_date: str | None = None) -> dict:
    """Remove a holding by symbol (and optionally purchase_date to disambiguate lots)."""
    p = _load_portfolio()
    before = len(p["holdings"])
    p["holdings"] = [
        h for h in p["holdings"]
        if not (h["symbol"] == symbol.upper() and (purchase_date is None or h.get("purchase_date") == purchase_date))
    ]
    _save(PORTFOLIO_PATH, p)
    return {"ok": True, "removed": before - len(p["holdings"])}


def set_cash(amount: float) -> dict:
    """Set available cash balance."""
    p = _load_portfolio()
    p["cash"] = float(amount)
    _save(PORTFOLIO_PATH, p)
    return {"ok": True, "cash": p["cash"]}


def get_portfolio() -> dict:
    """Return the raw portfolio (holdings + cash)."""
    return _load_portfolio()


def portfolio_performance() -> dict:
    """Value each holding at current price; return P&L per lot and total."""
    p = _load_portfolio()
    if not p["holdings"]:
        return {"cash": p.get("cash", 0), "holdings": [], "total_value": p.get("cash", 0), "total_cost": 0, "total_pnl": 0}

    symbols = list({h["symbol"] for h in p["holdings"]})
    prices = {}
    for s in symbols:
        try:
            fast = yf.Ticker(s).fast_info
            prices[s] = float(fast.get("last_price") or 0)
        except Exception:
            prices[s] = 0.0

    rows = []
    total_value = p.get("cash", 0)
    total_cost = 0
    for h in p["holdings"]:
        px = prices.get(h["symbol"], 0)
        value = px * h["shares"]
        cost = h["cost_basis"] * h["shares"]
        pnl = value - cost
        total_value += value
        total_cost += cost
        rows.append({
            "symbol": h["symbol"],
            "shares": h["shares"],
            "cost_basis": h["cost_basis"],
            "price": px,
            "value": value,
            "cost": cost,
            "pnl": pnl,
            "pnl_pct": (pnl / cost * 100) if cost else 0,
            "purchase_date": h.get("purchase_date"),
        })

    return {
        "cash": p.get("cash", 0),
        "holdings": rows,
        "total_value": total_value,
        "total_cost": total_cost,
        "total_pnl": total_value - total_cost - p.get("cash", 0),
        "total_return_pct": ((total_value - p.get("cash", 0)) / total_cost - 1) * 100 if total_cost else 0,
    }


def portfolio_risk() -> dict:
    """Portfolio-level risk metrics: vol, beta vs SPY, concentration, correlations."""
    perf = portfolio_performance()
    holdings = perf["holdings"]
    if not holdings:
        return {"error": "no holdings"}

    symbols = [h["symbol"] for h in holdings]
    weights = np.array([h["value"] for h in holdings], dtype=float)
    if weights.sum() == 0:
        return {"error": "positions have zero value"}
    weights = weights / weights.sum()

    tickers = yf.download(symbols + ["SPY"], period="1y", interval="1d", progress=False, auto_adjust=False)["Close"]
    rets = tickers.pct_change().dropna()
    if rets.empty:
        return {"error": "no return data"}

    spy = rets["SPY"]
    port_rets = (rets[symbols] * weights).sum(axis=1)

    port_vol_annual = float(port_rets.std() * np.sqrt(252) * 100)
    cov = np.cov(port_rets, spy)[0, 1]
    beta = float(cov / np.var(spy))

    concentrations = sorted(
        ({"symbol": s, "weight_pct": float(w * 100)} for s, w in zip(symbols, weights)),
        key=lambda x: -x["weight_pct"],
    )

    corr = rets[symbols].corr().round(3)
    return {
        "annualized_vol_pct": port_vol_annual,
        "beta_vs_spy": beta,
        "concentrations": concentrations,
        "hhi": float(np.sum(weights ** 2)),
        "correlation_matrix": {
            "symbols": list(corr.columns),
            "matrix": corr.values.tolist(),
        },
    }


def add_watchlist(symbol: str, note: str = "") -> dict:
    """Add a symbol to the watchlist."""
    wl = _load_watchlist()
    if not any(w["symbol"] == symbol.upper() for w in wl):
        wl.append({"symbol": symbol.upper(), "note": note, "added": datetime.utcnow().date().isoformat()})
        _save(WATCHLIST_PATH, wl)
    return {"ok": True, "count": len(wl)}


def remove_watchlist(symbol: str) -> dict:
    """Remove a symbol from the watchlist."""
    wl = _load_watchlist()
    wl = [w for w in wl if w["symbol"] != symbol.upper()]
    _save(WATCHLIST_PATH, wl)
    return {"ok": True, "count": len(wl)}


def get_watchlist() -> dict:
    """Get the full watchlist with current quotes."""
    wl = _load_watchlist()
    out = []
    for w in wl:
        try:
            fast = yf.Ticker(w["symbol"]).fast_info
            out.append({
                **w,
                "price": float(fast.get("last_price") or 0),
                "day_change_pct": (
                    (float(fast.get("last_price") or 0) / float(fast.get("previous_close") or 1) - 1) * 100
                    if fast.get("previous_close") else None
                ),
            })
        except Exception as e:
            out.append({**w, "error": str(e)})
    return {"watchlist": out}
