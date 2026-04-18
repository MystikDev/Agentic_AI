"""Spending analytics: category breakdowns, top merchants, savings rate, trends."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from .store import load


def _window(days_back: int) -> str:
    return (date.today() - timedelta(days=days_back)).isoformat()


def spending_by_category(days_back: int = 30) -> dict:
    """Total spending per category over the given window."""
    data = load()
    cutoff = _window(days_back)
    totals: dict[str, float] = defaultdict(float)
    counts: dict[str, int] = defaultdict(int)
    for t in data["transactions"]:
        if t["date"] < cutoff or t["amount"] >= 0:
            continue
        totals[t["category"]] += -t["amount"]
        counts[t["category"]] += 1
    rows = [
        {"category": c, "total": round(v, 2), "transactions": counts[c]}
        for c, v in sorted(totals.items(), key=lambda x: -x[1])
    ]
    grand = round(sum(totals.values()), 2)
    return {"days_back": days_back, "total_spend": grand, "categories": rows}


def top_merchants(days_back: int = 30, limit: int = 15) -> dict:
    """Top merchants by spend in the window."""
    data = load()
    cutoff = _window(days_back)
    buckets: dict[str, dict] = defaultdict(lambda: {"total": 0.0, "count": 0, "category": None})
    for t in data["transactions"]:
        if t["date"] < cutoff or t["amount"] >= 0:
            continue
        k = t.get("merchant") or t["description"][:40]
        b = buckets[k]
        b["total"] += -t["amount"]
        b["count"] += 1
        b["category"] = b["category"] or t["category"]
    rows = sorted(
        ({"merchant": k, **v, "total": round(v["total"], 2)} for k, v in buckets.items()),
        key=lambda r: -r["total"],
    )[:limit]
    return {"days_back": days_back, "merchants": rows}


def income_vs_spending(days_back: int = 30) -> dict:
    """Total inflows vs outflows (transactions only; ignores internal transfers)."""
    data = load()
    cutoff = _window(days_back)
    income = 0.0
    spend = 0.0
    for t in data["transactions"]:
        if t["date"] < cutoff:
            continue
        if t["category"] in ("transfer_internal", "transfer_p2p"):
            continue
        if t["amount"] > 0:
            income += t["amount"]
        else:
            spend += -t["amount"]
    return {
        "days_back": days_back,
        "income": round(income, 2),
        "spending": round(spend, 2),
        "net_cashflow": round(income - spend, 2),
        "spending_as_pct_of_income": round(spend / income * 100, 1) if income else None,
    }


def savings_rate(months: int = 3) -> dict:
    """Savings rate from paychecks: (net - spending) / gross over the last N months.
    Uses paycheck totals for gross/net and transactions for spending."""
    data = load()
    cutoff = _window(months * 30)
    gross = sum(
        p.get("gross") or 0
        for p in data["paychecks"]
        if p["date"] >= cutoff
    )
    net = sum(
        p.get("net") or 0
        for p in data["paychecks"]
        if p["date"] >= cutoff
    )
    spend = sum(
        -t["amount"]
        for t in data["transactions"]
        if t["date"] >= cutoff
        and t["amount"] < 0
        and t["category"] not in ("transfer_internal", "transfer_p2p")
    )
    saved = net - spend
    return {
        "months": months,
        "gross_income": round(gross, 2),
        "net_income": round(net, 2),
        "spending": round(spend, 2),
        "estimated_saved": round(saved, 2),
        "savings_rate_of_gross_pct": round(saved / gross * 100, 1) if gross else None,
        "savings_rate_of_net_pct": round(saved / net * 100, 1) if net else None,
    }


def monthly_summary(year: int | None = None) -> dict:
    """Per-month spend, income, and net for a year (default: current year)."""
    data = load()
    y = year or date.today().year
    months: dict[str, dict] = defaultdict(lambda: {"income": 0.0, "spend": 0.0})
    for t in data["transactions"]:
        if not t["date"].startswith(str(y)):
            continue
        if t["category"] in ("transfer_internal", "transfer_p2p"):
            continue
        key = t["date"][:7]
        if t["amount"] > 0:
            months[key]["income"] += t["amount"]
        else:
            months[key]["spend"] += -t["amount"]
    rows = [
        {"month": k, "income": round(v["income"], 2), "spend": round(v["spend"], 2), "net": round(v["income"] - v["spend"], 2)}
        for k, v in sorted(months.items())
    ]
    return {"year": y, "months": rows}
