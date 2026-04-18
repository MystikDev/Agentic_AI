"""FRED-backed macro data tools."""
from __future__ import annotations

import httpx

from .config import FRED_API_KEY, HTTP_TIMEOUT

BASE = "https://api.stlouisfed.org/fred"

COMMON_SERIES = {
    "DGS10": "10-Year Treasury yield",
    "DGS2": "2-Year Treasury yield",
    "DGS3MO": "3-Month Treasury yield",
    "T10Y2Y": "10Y-2Y yield spread (recession signal)",
    "FEDFUNDS": "Federal Funds effective rate",
    "DFF": "Federal Funds daily rate",
    "SOFR": "Secured Overnight Financing Rate",
    "CPIAUCSL": "Consumer Price Index (all items)",
    "CPILFESL": "Core CPI (ex food & energy)",
    "PCEPI": "PCE price index",
    "UNRATE": "Unemployment rate",
    "PAYEMS": "Nonfarm payrolls",
    "GDP": "Gross Domestic Product",
    "GDPC1": "Real GDP",
    "M2SL": "M2 money supply",
    "UMCSENT": "U. Michigan consumer sentiment",
    "VIXCLS": "CBOE VIX",
    "DEXUSEU": "USD/EUR exchange rate",
    "DCOILWTICO": "WTI crude oil",
    "GOLDAMGBD228NLBM": "London gold fixing",
}


def list_common_series() -> dict:
    """List commonly useful FRED series IDs and their descriptions."""
    return {"series": COMMON_SERIES}


def _need_key() -> dict | None:
    if not FRED_API_KEY:
        return {"error": "FRED_API_KEY not set"}
    return None


def get_macro_series(series_id: str, limit: int = 60) -> dict:
    """Latest observations for a FRED series (most recent first)."""
    if err := _need_key():
        return err
    params = {
        "series_id": series_id.upper(),
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "sort_order": "desc",
        "limit": limit,
    }
    r = httpx.get(f"{BASE}/series/observations", params=params, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    obs = r.json().get("observations", [])
    cleaned = []
    for o in obs:
        v = o.get("value")
        if v in (None, ".", ""):
            continue
        cleaned.append({"date": o["date"], "value": float(v)})
    desc = COMMON_SERIES.get(series_id.upper(), "")
    return {"series_id": series_id.upper(), "description": desc, "observations": cleaned}


def get_macro_snapshot() -> dict:
    """One-call snapshot of the key macro series most relevant to trading."""
    if err := _need_key():
        return err
    ids = ["DGS10", "DGS2", "T10Y2Y", "FEDFUNDS", "CPIAUCSL", "UNRATE", "VIXCLS", "DCOILWTICO"]
    snap = {}
    for sid in ids:
        try:
            res = get_macro_series(sid, limit=2)
            if res.get("observations"):
                latest = res["observations"][0]
                snap[sid] = {
                    "description": COMMON_SERIES.get(sid),
                    "latest_date": latest["date"],
                    "latest_value": latest["value"],
                }
        except Exception as e:
            snap[sid] = {"error": str(e)}
    return snap
