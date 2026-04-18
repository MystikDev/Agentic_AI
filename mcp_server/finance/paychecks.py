"""Paycheck tracking: gross/net/tax/deductions, cadence, YTD roll-ups."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime

from .store import load, new_id, save


def add_paycheck(
    paycheck_date: str,
    employer: str,
    gross: float,
    net: float,
    federal_tax: float = 0.0,
    state_tax: float = 0.0,
    fica: float = 0.0,
    retirement_401k: float = 0.0,
    health_insurance: float = 0.0,
    other_deductions: float = 0.0,
    notes: str = "",
    account_id: str | None = None,
) -> dict:
    """Record a paycheck. All monetary fields are in dollars. paycheck_date is YYYY-MM-DD."""
    data = load()
    entry = {
        "id": new_id("pay"),
        "date": paycheck_date,
        "employer": employer,
        "gross": float(gross),
        "net": float(net),
        "federal_tax": float(federal_tax),
        "state_tax": float(state_tax),
        "fica": float(fica),
        "retirement_401k": float(retirement_401k),
        "health_insurance": float(health_insurance),
        "other_deductions": float(other_deductions),
        "notes": notes,
        "account_id": account_id,
    }
    data["paychecks"].append(entry)
    save(data)
    return {"ok": True, "paycheck": entry}


def list_paychecks(year: int | None = None, employer: str | None = None) -> dict:
    """List paychecks, most recent first."""
    data = load()
    rows = list(data["paychecks"])
    if year:
        rows = [p for p in rows if p["date"].startswith(str(year))]
    if employer:
        rows = [p for p in rows if p["employer"].lower() == employer.lower()]
    rows.sort(key=lambda p: p["date"], reverse=True)
    return {"count": len(rows), "paychecks": rows}


def paycheck_summary(year: int | None = None) -> dict:
    """Gross/net/tax totals, effective tax rate, and detected cadence."""
    data = load()
    rows = data["paychecks"]
    if year:
        rows = [p for p in rows if p["date"].startswith(str(year))]
    if not rows:
        return {"error": "no paychecks recorded"}

    totals = defaultdict(float)
    for p in rows:
        for k in ("gross", "net", "federal_tax", "state_tax", "fica", "retirement_401k", "health_insurance", "other_deductions"):
            totals[k] += p.get(k, 0) or 0

    effective_tax_rate = (
        (totals["federal_tax"] + totals["state_tax"] + totals["fica"]) / totals["gross"] * 100
        if totals["gross"] else 0
    )
    net_to_gross = totals["net"] / totals["gross"] * 100 if totals["gross"] else 0

    # Detect cadence from date gaps.
    rows_sorted = sorted(rows, key=lambda p: p["date"])
    gaps = []
    for a, b in zip(rows_sorted, rows_sorted[1:]):
        gaps.append((datetime.fromisoformat(b["date"]) - datetime.fromisoformat(a["date"])).days)
    avg_gap = sum(gaps) / len(gaps) if gaps else None
    cadence = None
    if avg_gap:
        cadence = (
            "weekly" if 6 <= avg_gap <= 8 else
            "biweekly" if 12 <= avg_gap <= 16 else
            "semimonthly" if 13 <= avg_gap <= 17 else
            "monthly" if 27 <= avg_gap <= 32 else
            f"~{round(avg_gap)} day interval"
        )

    annualized_gross = None
    if avg_gap and totals["gross"]:
        annualized_gross = totals["gross"] / max(1, len(rows)) * (365 / avg_gap)

    return {
        "year": year,
        "paycheck_count": len(rows),
        "totals": dict(totals),
        "effective_tax_rate_pct": effective_tax_rate,
        "net_to_gross_pct": net_to_gross,
        "cadence": cadence,
        "avg_days_between_paychecks": avg_gap,
        "annualized_gross_estimate": annualized_gross,
        "last_paycheck_date": rows_sorted[-1]["date"] if rows_sorted else None,
    }


def remove_paycheck(paycheck_id: str) -> dict:
    """Delete a paycheck record."""
    data = load()
    before = len(data["paychecks"])
    data["paychecks"] = [p for p in data["paychecks"] if p["id"] != paycheck_id]
    save(data)
    return {"ok": True, "removed": before - len(data["paychecks"])}
