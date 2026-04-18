"""Cashflow forecasting and runway analysis."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from statistics import mean

from .store import load

DISCRETIONARY_EXCLUDE = {
    "housing_rent", "housing_mortgage", "utilities", "utilities_telecom",
    "insurance", "subscriptions_media", "transfer_internal", "transfer_p2p",
    "income_salary", "income_interest",
}


def _liquid_balance(data: dict) -> float:
    """Sum of checking/savings/cash balances."""
    return sum(
        a.get("balance") or 0
        for a in data["accounts"]
        if a["type"] in ("checking", "savings", "cash")
    )


def _next_due(b: dict, after: date) -> date | None:
    if b.get("next_due"):
        try:
            due = date.fromisoformat(b["next_due"])
        except ValueError:
            return None
        return due if due >= after else None
    if b["frequency"] == "monthly" and b.get("due_day"):
        dd = int(b["due_day"])
        y, m = after.year, after.month
        try:
            cand = date(y, m, dd)
        except ValueError:
            cand = date(y, m, 28)
        if cand < after:
            m += 1
            if m > 12:
                m = 1
                y += 1
            try:
                cand = date(y, m, dd)
            except ValueError:
                cand = date(y, m, 28)
        return cand
    return None


def _project_paycheck_dates(data: dict, horizon_end: date) -> list[tuple[date, float]]:
    """Project future paycheck dates + amounts using the detected cadence."""
    pays = sorted(data["paychecks"], key=lambda p: p["date"])
    if len(pays) < 2:
        return []
    gaps = []
    for a, b in zip(pays, pays[1:]):
        gaps.append((datetime.fromisoformat(b["date"]) - datetime.fromisoformat(a["date"])).days)
    avg_gap = round(mean(gaps))
    if avg_gap <= 0:
        return []
    last_date = date.fromisoformat(pays[-1]["date"])
    avg_net = mean(p.get("net") or 0 for p in pays[-6:])
    out = []
    cur = last_date + timedelta(days=avg_gap)
    while cur <= horizon_end:
        out.append((cur, avg_net))
        cur += timedelta(days=avg_gap)
    return out


def _avg_discretionary_daily(data: dict, lookback_days: int = 60) -> float:
    cutoff = (date.today() - timedelta(days=lookback_days)).isoformat()
    total = 0.0
    for t in data["transactions"]:
        if t["date"] < cutoff or t["amount"] >= 0:
            continue
        if t["category"] in DISCRETIONARY_EXCLUDE:
            continue
        total += -t["amount"]
    return total / lookback_days


def cashflow_forecast(days_ahead: int = 30, include_discretionary: bool = True) -> dict:
    """Project daily balance over the next N days given scheduled bills + expected
    paychecks + average daily discretionary spending."""
    data = load()
    today = date.today()
    horizon_end = today + timedelta(days=days_ahead)

    events: list[dict] = []
    for b in data["bills"]:
        due = _next_due(b, today)
        if due and due <= horizon_end:
            events.append({"date": due.isoformat(), "label": f"bill: {b['name']}", "delta": -b["amount"]})

    for d, amt in _project_paycheck_dates(data, horizon_end):
        if d >= today:
            events.append({"date": d.isoformat(), "label": "paycheck", "delta": amt})

    discretionary_per_day = _avg_discretionary_daily(data) if include_discretionary else 0

    balance = _liquid_balance(data)
    days: list[dict] = []
    min_balance = balance
    min_date = today.isoformat()
    for i in range(days_ahead + 1):
        d = today + timedelta(days=i)
        day_events = [e for e in events if e["date"] == d.isoformat()]
        day_delta = sum(e["delta"] for e in day_events) - discretionary_per_day
        balance += day_delta
        if balance < min_balance:
            min_balance = balance
            min_date = d.isoformat()
        days.append({
            "date": d.isoformat(),
            "balance": round(balance, 2),
            "events": day_events,
            "discretionary_spend": round(discretionary_per_day, 2) if include_discretionary else 0,
        })

    shortfall_date = next((d["date"] for d in days if d["balance"] < 0), None)
    return {
        "starting_balance": _liquid_balance(data),
        "days_ahead": days_ahead,
        "ending_balance": round(balance, 2),
        "min_balance": round(min_balance, 2),
        "min_balance_date": min_date,
        "first_shortfall_date": shortfall_date,
        "avg_discretionary_per_day": round(discretionary_per_day, 2) if include_discretionary else 0,
        "daily": days,
    }


def runway_analysis() -> dict:
    """How many months of expenses does liquid cash cover if income stops tomorrow?"""
    data = load()
    liquid = _liquid_balance(data)

    # Fixed monthly obligations from bills.
    factor = {"weekly": 52 / 12, "biweekly": 26 / 12, "monthly": 1, "quarterly": 1 / 3, "annual": 1 / 12}
    fixed_monthly = sum(b["amount"] * factor.get(b["frequency"], 1) for b in data["bills"])

    # Variable spending: discretionary daily * 30.
    variable_monthly = _avg_discretionary_daily(data) * 30
    total_monthly_burn = fixed_monthly + variable_monthly

    months = liquid / total_monthly_burn if total_monthly_burn else None
    return {
        "liquid_cash": round(liquid, 2),
        "fixed_monthly_expenses": round(fixed_monthly, 2),
        "variable_monthly_expenses": round(variable_monthly, 2),
        "total_monthly_burn": round(total_monthly_burn, 2),
        "months_of_runway": round(months, 1) if months is not None else None,
        "emergency_fund_status": (
            "healthy (6+ months)" if months and months >= 6 else
            "adequate (3-6 months)" if months and months >= 3 else
            "thin (1-3 months)" if months and months >= 1 else
            "critical (<1 month)" if months else "unknown"
        ),
    }
