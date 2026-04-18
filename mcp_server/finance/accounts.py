"""Bank, credit card, and other non-brokerage accounts."""
from __future__ import annotations

from .store import load, new_id, now_iso, save

ACCOUNT_TYPES = {"checking", "savings", "credit_card", "cash", "loan", "hsa", "other"}


def add_account(
    name: str,
    type: str,
    balance: float = 0.0,
    institution: str = "",
    apy: float | None = None,
    apr: float | None = None,
    credit_limit: float | None = None,
    notes: str = "",
) -> dict:
    """Add a new account. type: checking, savings, credit_card, cash, loan, hsa, other."""
    if type not in ACCOUNT_TYPES:
        return {"error": f"type must be one of {sorted(ACCOUNT_TYPES)}"}
    data = load()
    acct = {
        "id": new_id("acct"),
        "name": name,
        "type": type,
        "institution": institution,
        "balance": float(balance),
        "apy": apy,
        "apr": apr,
        "credit_limit": credit_limit,
        "notes": notes,
        "last_updated": now_iso(),
    }
    data["accounts"].append(acct)
    save(data)
    return {"ok": True, "account": acct}


def update_balance(account_id: str, balance: float) -> dict:
    """Manually update an account balance."""
    data = load()
    for a in data["accounts"]:
        if a["id"] == account_id:
            a["balance"] = float(balance)
            a["last_updated"] = now_iso()
            save(data)
            return {"ok": True, "account": a}
    return {"error": "account not found"}


def update_account(account_id: str, **fields) -> dict:
    """Update arbitrary fields on an account (apy, apr, credit_limit, name, institution, notes)."""
    allowed = {"name", "institution", "apy", "apr", "credit_limit", "notes", "type"}
    data = load()
    for a in data["accounts"]:
        if a["id"] == account_id:
            for k, v in fields.items():
                if k in allowed:
                    a[k] = v
            a["last_updated"] = now_iso()
            save(data)
            return {"ok": True, "account": a}
    return {"error": "account not found"}


def remove_account(account_id: str, delete_transactions: bool = False) -> dict:
    """Remove an account. Optionally also remove its transactions."""
    data = load()
    before = len(data["accounts"])
    data["accounts"] = [a for a in data["accounts"] if a["id"] != account_id]
    if delete_transactions:
        data["transactions"] = [t for t in data["transactions"] if t.get("account_id") != account_id]
    save(data)
    return {"ok": True, "removed": before - len(data["accounts"])}


def list_accounts() -> dict:
    """Return all accounts with balances."""
    data = load()
    return {"accounts": data["accounts"]}


def net_worth() -> dict:
    """Aggregate positive (assets) and negative (liabilities) balances across all accounts.
    Credit cards and loans count as liabilities (absolute value of positive balance)."""
    data = load()
    assets = 0.0
    liabilities = 0.0
    breakdown = {"assets": [], "liabilities": []}
    for a in data["accounts"]:
        bal = float(a.get("balance") or 0)
        if a["type"] in ("credit_card", "loan"):
            liabilities += abs(bal)
            breakdown["liabilities"].append({"name": a["name"], "balance": bal, "type": a["type"]})
        else:
            assets += bal
            breakdown["assets"].append({"name": a["name"], "balance": bal, "type": a["type"]})
    return {
        "assets": assets,
        "liabilities": liabilities,
        "net_worth": assets - liabilities,
        "breakdown": breakdown,
    }
