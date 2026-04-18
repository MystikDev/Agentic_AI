"""Finnhub-backed tools: news, sentiment, earnings, recommendations, insider txns."""
from __future__ import annotations

from datetime import date, timedelta

import httpx

from .config import FINNHUB_API_KEY, HTTP_TIMEOUT

BASE = "https://finnhub.io/api/v1"


def _need_key() -> dict | None:
    if not FINNHUB_API_KEY:
        return {"error": "FINNHUB_API_KEY not set"}
    return None


def _get(path: str, **params) -> list | dict:
    params["token"] = FINNHUB_API_KEY
    r = httpx.get(f"{BASE}{path}", params=params, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    return r.json()


def get_company_news(symbol: str, days_back: int = 7, limit: int = 15) -> dict:
    """Recent news articles for a ticker."""
    if err := _need_key():
        return err
    end = date.today()
    start = end - timedelta(days=days_back)
    articles = _get("/company-news", symbol=symbol.upper(), **{"from": start.isoformat(), "to": end.isoformat()})
    trimmed = [
        {
            "datetime": a.get("datetime"),
            "headline": a.get("headline"),
            "summary": (a.get("summary") or "")[:500],
            "source": a.get("source"),
            "url": a.get("url"),
            "category": a.get("category"),
        }
        for a in (articles or [])[:limit]
    ]
    return {"symbol": symbol.upper(), "days_back": days_back, "articles": trimmed}


def get_news_sentiment(symbol: str) -> dict:
    """Aggregate news sentiment score + bullish/bearish article breakdown."""
    if err := _need_key():
        return err
    data = _get("/news-sentiment", symbol=symbol.upper())
    return {
        "symbol": symbol.upper(),
        "company_news_score": data.get("companyNewsScore"),
        "sector_avg_news_score": data.get("sectorAverageNewsScore"),
        "bullish_pct": data.get("sentiment", {}).get("bullishPercent"),
        "bearish_pct": data.get("sentiment", {}).get("bearishPercent"),
        "buzz_articles_in_last_week": data.get("buzz", {}).get("articlesInLastWeek"),
        "buzz_weekly_avg": data.get("buzz", {}).get("weeklyAverage"),
    }


def get_recommendation_trends(symbol: str) -> dict:
    """Analyst buy/hold/sell ratings over the last several months."""
    if err := _need_key():
        return err
    data = _get("/stock/recommendation", symbol=symbol.upper())
    return {"symbol": symbol.upper(), "recommendations": data}


def get_price_target(symbol: str) -> dict:
    """Analyst consensus price target."""
    if err := _need_key():
        return err
    data = _get("/stock/price-target", symbol=symbol.upper())
    return {
        "symbol": symbol.upper(),
        "target_mean": data.get("targetMean"),
        "target_high": data.get("targetHigh"),
        "target_low": data.get("targetLow"),
        "target_median": data.get("targetMedian"),
        "num_analysts": data.get("numberOfAnalysts"),
        "last_updated": data.get("lastUpdated"),
    }


def get_earnings_calendar(days_ahead: int = 14, symbol: str | None = None) -> dict:
    """Upcoming earnings announcements (optionally filtered to a single symbol)."""
    if err := _need_key():
        return err
    start = date.today()
    end = start + timedelta(days=days_ahead)
    params = {"from": start.isoformat(), "to": end.isoformat()}
    if symbol:
        params["symbol"] = symbol.upper()
    data = _get("/calendar/earnings", **params)
    return {"window": f"{start} to {end}", "earnings": data.get("earningsCalendar", [])[:100]}


def get_earnings_surprises(symbol: str, limit: int = 8) -> dict:
    """Historical quarterly earnings surprises (actual vs estimate)."""
    if err := _need_key():
        return err
    data = _get("/stock/earnings", symbol=symbol.upper(), limit=limit)
    return {"symbol": symbol.upper(), "earnings": data}


def get_insider_transactions(symbol: str, days_back: int = 90) -> dict:
    """Insider buy/sell transactions."""
    if err := _need_key():
        return err
    end = date.today()
    start = end - timedelta(days=days_back)
    data = _get("/stock/insider-transactions", symbol=symbol.upper(), **{"from": start.isoformat(), "to": end.isoformat()})
    return {"symbol": symbol.upper(), "transactions": data.get("data", [])[:50]}


def get_ipo_calendar(days_ahead: int = 30) -> dict:
    """Upcoming IPOs."""
    if err := _need_key():
        return err
    start = date.today()
    end = start + timedelta(days=days_ahead)
    data = _get("/calendar/ipo", **{"from": start.isoformat(), "to": end.isoformat()})
    return {"window": f"{start} to {end}", "ipos": data.get("ipoCalendar", [])}


def get_market_news(category: str = "general", limit: int = 20) -> dict:
    """General market news. Categories: general, forex, crypto, merger."""
    if err := _need_key():
        return err
    data = _get("/news", category=category)
    trimmed = [
        {
            "datetime": a.get("datetime"),
            "headline": a.get("headline"),
            "summary": (a.get("summary") or "")[:500],
            "source": a.get("source"),
            "url": a.get("url"),
            "related": a.get("related"),
        }
        for a in (data or [])[:limit]
    ]
    return {"category": category, "articles": trimmed}
