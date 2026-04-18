"""Plaid integration: link tokens, token exchange, balances, transaction sync.

Plaid's `/link/token/create` returns a token used by the Plaid Link frontend.
After the user completes Link in a browser, Plaid returns a `public_token` which
you pass to `plaid_exchange_public_token` to get a durable `access_token`.
Access tokens are stored locally in data/finance.json under `plaid.access_tokens`.

Env vars: PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV (sandbox|development|production).
"""
from __future__ import annotations

import os
from datetime import date, timedelta

import httpx

from ..config import HTTP_TIMEOUT
from .store import load, new_id, save
from .transactions import _apply_rules, normalize_merchant

PLAID_ENV = os.getenv("PLAID_ENV", "sandbox").lower()
PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID", "")
PLAID_SECRET = os.getenv("PLAID_SECRET", "")

BASE_URLS = {
    "sandbox": "https://sandbox.plaid.com",
    "development": "https://development.plaid.com",
    "production": "https://production.plaid.com",
}


def _base() -> str:
    return BASE_URLS.get(PLAID_ENV, BASE_URLS["sandbox"])


def _need_keys() -> dict | None:
    if not PLAID_CLIENT_ID or not PLAID_SECRET:
        return {"error": "PLAID_CLIENT_ID / PLAID_SECRET not set"}
    return None


def _post(path: str, body: dict) -> dict:
    body = {"client_id": PLAID_CLIENT_ID, "secret": PLAID_SECRET, **body}
    r = httpx.post(f"{_base()}{path}", json=body, timeout=HTTP_TIMEOUT)
    if r.status_code >= 400:
        try:
            return {"error": r.json()}
        except Exception:
            return {"error": r.text}
    return r.json()


def plaid_create_link_token(user_id: str = "local-user", products: str = "transactions") -> dict:
    """Create a Plaid Link token. Use the returned `link_token` in a browser with Plaid Link
    to get a `public_token`, then call `plaid_exchange_public_token`."""
    if err := _need_keys():
        return err
    return _post("/link/token/create", {
        "user": {"client_user_id": user_id},
        "client_name": "Personal Financial Advisor",
        "products": products.split(","),
        "country_codes": ["US"],
        "language": "en",
    })


def plaid_exchange_public_token(public_token: str, label: str = "") -> dict:
    """Exchange a public_token (from Plaid Link) for a durable access_token. Stored locally."""
    if err := _need_keys():
        return err
    res = _post("/item/public_token/exchange", {"public_token": public_token})
    if "error" in res:
        return res
    access_token = res["access_token"]
    item_id = res["item_id"]
    data = load()
    data["plaid"]["access_tokens"][item_id] = {
        "access_token": access_token,
        "label": label or item_id,
    }
    save(data)
    return {"ok": True, "item_id": item_id, "label": label}


def plaid_list_items() -> dict:
    """List linked Plaid items (banks)."""
    data = load()
    items = [
        {"item_id": iid, "label": v.get("label")}
        for iid, v in data["plaid"]["access_tokens"].items()
    ]
    return {"items": items}


def plaid_remove_item(item_id: str) -> dict:
    """Unlink a Plaid item (invalidates access_token + removes local copy)."""
    data = load()
    entry = data["plaid"]["access_tokens"].pop(item_id, None)
    data["plaid"]["cursors"].pop(item_id, None)
    save(data)
    if not entry:
        return {"error": "item not found"}
    _post("/item/remove", {"access_token": entry["access_token"]})
    return {"ok": True}


def plaid_get_balances() -> dict:
    """Fetch live balances for all linked Plaid accounts."""
    if err := _need_keys():
        return err
    data = load()
    out = []
    for item_id, entry in data["plaid"]["access_tokens"].items():
        res = _post("/accounts/balance/get", {"access_token": entry["access_token"]})
        if "error" in res:
            out.append({"item_id": item_id, "error": res["error"]})
            continue
        for a in res.get("accounts", []):
            out.append({
                "item_id": item_id,
                "institution_label": entry.get("label"),
                "account_id": a["account_id"],
                "name": a.get("name"),
                "official_name": a.get("official_name"),
                "type": a.get("type"),
                "subtype": a.get("subtype"),
                "available": (a.get("balances") or {}).get("available"),
                "current": (a.get("balances") or {}).get("current"),
                "limit": (a.get("balances") or {}).get("limit"),
                "iso_currency": (a.get("balances") or {}).get("iso_currency_code"),
                "mask": a.get("mask"),
            })
    return {"accounts": out}


def plaid_sync_transactions(days_back: int = 30) -> dict:
    """Pull recent Plaid transactions into the local store.
    Uses /transactions/get for simplicity (not /transactions/sync cursors)."""
    if err := _need_keys():
        return err
    data = load()
    rules = [(r["pattern"], r["category"]) for r in data.get("category_rules", [])]

    start = (date.today() - timedelta(days=days_back)).isoformat()
    end = date.today().isoformat()
    plaid_to_local: dict[str, str] = {}
    for a in data["accounts"]:
        if a.get("plaid_account_id"):
            plaid_to_local[a["plaid_account_id"]] = a["id"]

    added = 0
    skipped = 0
    linked_accounts = 0
    existing_plaid_ids = {t.get("plaid_transaction_id") for t in data["transactions"] if t.get("plaid_transaction_id")}

    for item_id, entry in data["plaid"]["access_tokens"].items():
        res = _post("/transactions/get", {
            "access_token": entry["access_token"],
            "start_date": start,
            "end_date": end,
            "options": {"count": 500, "offset": 0},
        })
        if "error" in res:
            continue

        # Auto-create local accounts for Plaid accounts we haven't seen.
        for pa in res.get("accounts", []):
            if pa["account_id"] not in plaid_to_local:
                local_id = new_id("acct")
                subtype_map = {"checking": "checking", "savings": "savings", "credit card": "credit_card"}
                typ = subtype_map.get(pa.get("subtype", "").lower(), "other")
                data["accounts"].append({
                    "id": local_id,
                    "name": pa.get("name") or pa.get("official_name") or pa["account_id"][:8],
                    "type": typ,
                    "institution": entry.get("label", ""),
                    "balance": (pa.get("balances") or {}).get("current") or 0,
                    "plaid_item_id": item_id,
                    "plaid_account_id": pa["account_id"],
                })
                plaid_to_local[pa["account_id"]] = local_id
                linked_accounts += 1
            else:
                for la in data["accounts"]:
                    if la["id"] == plaid_to_local[pa["account_id"]]:
                        la["balance"] = (pa.get("balances") or {}).get("current") or la.get("balance", 0)

        for t in res.get("transactions", []):
            pid = t["transaction_id"]
            if pid in existing_plaid_ids:
                skipped += 1
                continue
            # Plaid convention: positive = money leaving. We use the opposite.
            amount = -float(t.get("amount") or 0)
            desc = t.get("name") or t.get("merchant_name") or ""
            category = (t.get("personal_finance_category") or {}).get("primary", "") or (t.get("category") or [""])[0]
            category = category.lower() or _apply_rules(desc, rules) or "uncategorized"
            data["transactions"].append({
                "id": new_id("txn"),
                "plaid_transaction_id": pid,
                "account_id": plaid_to_local.get(t["account_id"], "unknown"),
                "date": t["date"],
                "amount": amount,
                "description": desc,
                "merchant": t.get("merchant_name") or normalize_merchant(desc),
                "category": category,
                "pending": bool(t.get("pending")),
                "notes": "plaid",
            })
            added += 1

    save(data)
    return {"ok": True, "added": added, "skipped_existing": skipped, "new_accounts": linked_accounts}
