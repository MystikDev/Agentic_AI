"""Monthly budget targets by category + actual-vs-target status."""
from __future__ import annotations

from collections import defaultdict
from datetime import date

from .store import load, save


def set_budget(category: str, monthly_limit: float, notes: str = "") -> dict:
    """Set (or update) a monthly spending limit for a category."""
    data = load()
    for b in data["budgets"]:
        if b["category"] == category:
            b["monthly_limit"] = float(monthly_limit)
            b["notes"] = notes
            save(data)
            return {"ok": True, "budget": b}
    entry = {"category": category, "monthly_limit": float(monthly_limit), "notes": notes}
    data["budgets"].append(entry)
    save(data)
    return {"ok": True, "budget": entry}


def remove_budget(category: str) -> dict:
    """Remove a category's budget target."""
    data = load()
    before = len(data["budgets"])
    data["budgets"] = [b for b in data["budgets"] if b["category"] != category]
    save(data)
    return {"ok": True, "removed": before - len(data["budgets"])}


def list_budgets() -> dict:
    """List all category budget targets."""
    data = load()
    return {"budgets": data["budgets"]}


def _month_bounds(year: int | None = None, month: int | None = None) -> tuple[str, str]:
    today = date.today()
    y = year or today.year
    m = month or today.month
    start = date(y, m, 1)
    end_year = y + (1 if m == 12 else 0)
    end_month = 1 if m == 12 else m + 1
    end = date(end_year, end_month, 1)
    return start.isoformat(), end.isoformat()


def budget_status(year: int | None = None, month: int | None = None) -> dict:
    """Actual vs. budgeted spend per category for a given month (default: current)."""
    data = load()
    start, end = _month_bounds(year, month)
    spend: dict[str, float] = defaultdict(float)
    for t in data["transactions"]:
        if start <= t["date"] < end and t["amount"] < 0:
            spend[t["category"]] += -t["amount"]

    rows = []
    for b in data["budgets"]:
        actual = spend.get(b["category"], 0)
        limit = b["monthly_limit"]
        rows.append({
            "category": b["category"],
            "limit": limit,
            "actual": round(actual, 2),
            "remaining": round(limit - actual, 2),
            "used_pct": round(actual / limit * 100, 1) if limit else None,
            "over_budget": actual > limit,
        })

    unbudgeted_spend = sum(v for cat, v in spend.items() if not any(b["category"] == cat for b in data["budgets"]))
    return {
        "period": f"{start} to {end}",
        "categories": sorted(rows, key=lambda r: -(r["used_pct"] or 0)),
        "unbudgeted_spend": round(unbudgeted_spend, 2),
        "total_spend": round(sum(spend.values()), 2),
        "total_budgeted": sum(b["monthly_limit"] for b in data["budgets"]),
    }
