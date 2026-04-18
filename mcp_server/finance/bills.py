"""Bills + subscriptions: explicit tracking plus auto-detection from transactions."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from statistics import mean, stdev

from .store import load, new_id, save

FREQUENCIES = {"weekly", "biweekly", "monthly", "quarterly", "annual"}


def add_bill(
    name: str,
    amount: float,
    frequency: str,
    due_day: int | None = None,
    next_due: str | None = None,
    category: str = "bills",
    autopay: bool = False,
    account_id: str | None = None,
    notes: str = "",
) -> dict:
    """Register a recurring bill or subscription.
    `frequency`: weekly, biweekly, monthly, quarterly, annual.
    `due_day`: for monthly bills, day of month (1-31). Optional if next_due is given.
    `next_due`: explicit next due date YYYY-MM-DD. Optional."""
    if frequency not in FREQUENCIES:
        return {"error": f"frequency must be one of {sorted(FREQUENCIES)}"}
    data = load()
    bill = {
        "id": new_id("bill"),
        "name": name,
        "amount": float(amount),
        "frequency": frequency,
        "due_day": due_day,
        "next_due": next_due,
        "category": category,
        "autopay": bool(autopay),
        "account_id": account_id,
        "notes": notes,
    }
    data["bills"].append(bill)
    save(data)
    return {"ok": True, "bill": bill}


def remove_bill(bill_id: str) -> dict:
    """Delete a bill/subscription."""
    data = load()
    before = len(data["bills"])
    data["bills"] = [b for b in data["bills"] if b["id"] != bill_id]
    save(data)
    return {"ok": True, "removed": before - len(data["bills"])}


def list_bills() -> dict:
    """List all registered bills + subscriptions."""
    data = load()
    rows = sorted(data["bills"], key=lambda b: (b.get("next_due") or "", b.get("due_day") or 99))
    return {"bills": rows, "monthly_total_estimate": _monthly_total(rows)}


def _monthly_total(bills: list[dict]) -> float:
    factor = {"weekly": 52 / 12, "biweekly": 26 / 12, "monthly": 1, "quarterly": 1 / 3, "annual": 1 / 12}
    return round(sum(b["amount"] * factor.get(b["frequency"], 1) for b in bills), 2)


def _next_due_from_day(due_day: int, today: date) -> date:
    y, m = today.year, today.month
    if due_day < today.day:
        m += 1
        if m > 12:
            m = 1
            y += 1
    try:
        return date(y, m, due_day)
    except ValueError:
        return date(y, m, 28)


def upcoming_bills(days_ahead: int = 30) -> dict:
    """Bills due in the next N days, with projected due dates."""
    data = load()
    today = date.today()
    horizon = today + timedelta(days=days_ahead)
    upcoming = []
    for b in data["bills"]:
        if b.get("next_due"):
            try:
                due = date.fromisoformat(b["next_due"])
            except ValueError:
                continue
        elif b.get("due_day") and b["frequency"] == "monthly":
            due = _next_due_from_day(int(b["due_day"]), today)
        else:
            continue
        if today <= due <= horizon:
            upcoming.append({**b, "projected_due": due.isoformat(), "days_until": (due - today).days})
    upcoming.sort(key=lambda x: x["projected_due"])
    return {
        "window_days": days_ahead,
        "bills": upcoming,
        "total_due": round(sum(b["amount"] for b in upcoming), 2),
    }


def detect_recurring(days_back: int = 120, min_occurrences: int = 3) -> dict:
    """Scan transactions for merchants that charge on a monthly cadence with
    stable amounts — likely subscriptions/bills you may not have registered."""
    data = load()
    cutoff = (date.today() - timedelta(days=days_back)).isoformat()
    buckets: dict[str, list[dict]] = defaultdict(list)
    for t in data["transactions"]:
        if t["date"] < cutoff or t["amount"] >= 0:
            continue
        key = t.get("merchant") or t["description"][:40].lower()
        buckets[key].append(t)

    existing_names = {b["name"].lower() for b in data["bills"]}
    results = []
    for merchant, txns in buckets.items():
        if len(txns) < min_occurrences:
            continue
        amounts = [abs(t["amount"]) for t in txns]
        dates = sorted(datetime.fromisoformat(t["date"]) for t in txns)
        gaps = [(b - a).days for a, b in zip(dates, dates[1:])]
        if not gaps:
            continue
        avg_gap = mean(gaps)
        gap_std = stdev(gaps) if len(gaps) > 1 else 0
        amt_mean = mean(amounts)
        amt_std = stdev(amounts) if len(amounts) > 1 else 0
        amt_cv = (amt_std / amt_mean) if amt_mean else 1
        is_monthly = 25 <= avg_gap <= 35 and gap_std < 6
        is_weekly = 6 <= avg_gap <= 8
        is_biweekly = 12 <= avg_gap <= 16
        is_annual = 350 <= avg_gap <= 380
        if (is_monthly or is_weekly or is_biweekly or is_annual) and amt_cv < 0.20:
            freq = (
                "monthly" if is_monthly else
                "weekly" if is_weekly else
                "biweekly" if is_biweekly else
                "annual"
            )
            results.append({
                "merchant": merchant,
                "frequency": freq,
                "avg_amount": round(amt_mean, 2),
                "amount_variability_pct": round(amt_cv * 100, 1),
                "occurrences": len(txns),
                "last_charge_date": max(t["date"] for t in txns),
                "already_registered": merchant in existing_names,
            })
    results.sort(key=lambda r: (-r["occurrences"], -r["avg_amount"]))
    return {"candidates": results, "days_back": days_back}


def subscription_audit() -> dict:
    """Combine registered bills + detected recurring charges and highlight
    potentially-forgotten subscriptions (small recurring charges, especially media/SaaS)."""
    registered = list_bills()
    detected = detect_recurring()
    suspicious = [
        r for r in detected["candidates"]
        if not r["already_registered"]
        and r["frequency"] in ("monthly", "annual")
        and r["avg_amount"] < 100
    ]
    return {
        "registered_bills": registered["bills"],
        "registered_monthly_total": registered["monthly_total_estimate"],
        "unregistered_recurring": detected["candidates"],
        "likely_forgotten_subscriptions": suspicious,
    }
