"""Transaction ledger + merchant normalization + rule-based categorization."""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime, timedelta

from .store import load, new_id, save

# Sign convention: negative = money leaving the account (spending/debit),
# positive = money entering (income/deposit/refund).

DEFAULT_RULES: list[tuple[str, str]] = [
    (r"\b(whole foods|trader joe|safeway|kroger|albertsons|publix|costco|sprouts|wegmans|aldi|heb)\b", "groceries"),
    (r"\b(mcdonald|chipotle|starbucks|dunkin|doordash|uber eats|grubhub|postmates|chick-fil|panera|taco bell|subway|wendy|burger king)\b", "dining"),
    (r"\b(uber|lyft|shell|chevron|exxon|bp |mobil|arco|76 |valero)\b", "transport"),
    (r"\b(netflix|spotify|hulu|disney\+|hbo|youtube premium|apple tv|prime video|peacock|paramount)\b", "subscriptions_media"),
    (r"\b(att|at&t|verizon|t-mobile|comcast|xfinity|spectrum|cox )\b", "utilities_telecom"),
    (r"\b(pg&e|duke energy|con edison|national grid|water|sewer|trash)\b", "utilities"),
    (r"\b(amazon|amzn)\b", "shopping"),
    (r"\b(target|walmart|best buy|home depot|lowes|ikea)\b", "shopping"),
    (r"\b(rent|landlord|property mgmt|leasing)\b", "housing_rent"),
    (r"\b(mortgage)\b", "housing_mortgage"),
    (r"\b(geico|state farm|allstate|progressive|liberty mutual|farmers ins)\b", "insurance"),
    (r"\b(cvs|walgreens|rite aid|pharmacy|medical|dental|clinic|hospital)\b", "health"),
    (r"\b(gym|planet fitness|equinox|soulcycle|peloton)\b", "fitness"),
    (r"\b(payroll|direct deposit|employer|salary|wages)\b", "income_salary"),
    (r"\b(venmo|zelle|cash app|paypal)\b", "transfer_p2p"),
    (r"\b(interest paid|interest earned|dividend)\b", "income_interest"),
    (r"\b(atm|withdrawal)\b", "cash_withdrawal"),
    (r"\b(transfer|xfer)\b", "transfer_internal"),
    (r"\b(fee|overdraft|late charge|service charge)\b", "fees"),
]


def normalize_merchant(description: str) -> str:
    """Clean a noisy bank description down to a rough merchant name."""
    s = description.lower()
    s = re.sub(r"\b\d{2}/\d{2}\b", " ", s)
    s = re.sub(r"#\d+", " ", s)
    s = re.sub(r"\b\d{4,}\b", " ", s)
    s = re.sub(r"\b(pos|debit|credit|purchase|payment|trans|txn|ref|id)\b", " ", s)
    s = re.sub(r"[^a-z0-9&\+\- ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:48]


def _apply_rules(description: str, custom_rules: list[tuple[str, str]]) -> str | None:
    text = description.lower()
    for pat, cat in custom_rules + DEFAULT_RULES:
        if re.search(pat, text):
            return cat
    return None


def add_transaction(
    account_id: str,
    date: str,
    amount: float,
    description: str,
    category: str | None = None,
    pending: bool = False,
    notes: str = "",
) -> dict:
    """Add a transaction. `amount` is negative for debits, positive for credits.
    `date` is YYYY-MM-DD."""
    data = load()
    rules = [(r["pattern"], r["category"]) for r in data.get("category_rules", [])]
    cat = category or _apply_rules(description, rules) or "uncategorized"
    txn = {
        "id": new_id("txn"),
        "account_id": account_id,
        "date": date,
        "amount": float(amount),
        "description": description,
        "merchant": normalize_merchant(description),
        "category": cat,
        "pending": pending,
        "notes": notes,
    }
    data["transactions"].append(txn)
    save(data)
    return {"ok": True, "transaction": txn}


def list_transactions(
    account_id: str | None = None,
    category: str | None = None,
    days_back: int = 30,
    limit: int = 200,
    search: str | None = None,
) -> dict:
    """Return transactions filtered by account, category, date window, and/or substring."""
    data = load()
    cutoff = (date.today() - timedelta(days=days_back)).isoformat()
    txns = data["transactions"]
    if account_id:
        txns = [t for t in txns if t["account_id"] == account_id]
    if category:
        txns = [t for t in txns if t["category"] == category]
    if search:
        q = search.lower()
        txns = [t for t in txns if q in t["description"].lower() or q in t.get("merchant", "").lower()]
    txns = [t for t in txns if t["date"] >= cutoff]
    txns.sort(key=lambda t: t["date"], reverse=True)
    return {"count": len(txns), "transactions": txns[:limit]}


def categorize_transaction(transaction_id: str, category: str) -> dict:
    """Manually set the category on a transaction."""
    data = load()
    for t in data["transactions"]:
        if t["id"] == transaction_id:
            t["category"] = category
            save(data)
            return {"ok": True, "transaction": t}
    return {"error": "transaction not found"}


def add_category_rule(pattern: str, category: str) -> dict:
    """Add a regex rule that maps matching descriptions to a category.
    Rule is also applied retroactively to any uncategorized transactions."""
    data = load()
    data["category_rules"].append({"pattern": pattern, "category": category})
    try:
        rx = re.compile(pattern, re.I)
    except re.error as e:
        return {"error": f"invalid regex: {e}"}
    hits = 0
    for t in data["transactions"]:
        if t["category"] == "uncategorized" and rx.search(t["description"]):
            t["category"] = category
            hits += 1
    save(data)
    return {"ok": True, "retro_applied": hits}


def auto_categorize_all() -> dict:
    """Re-run category rules over every uncategorized transaction."""
    data = load()
    rules = [(r["pattern"], r["category"]) for r in data.get("category_rules", [])]
    hits = 0
    for t in data["transactions"]:
        if t["category"] == "uncategorized":
            cat = _apply_rules(t["description"], rules)
            if cat:
                t["category"] = cat
                hits += 1
    save(data)
    return {"ok": True, "newly_categorized": hits}


def uncategorized_summary(days_back: int = 90) -> dict:
    """Group uncategorized transactions by normalized merchant to make bulk-categorization easy."""
    data = load()
    cutoff = (date.today() - timedelta(days=days_back)).isoformat()
    groups: dict[str, dict] = defaultdict(lambda: {"count": 0, "total": 0.0, "examples": []})
    for t in data["transactions"]:
        if t["category"] != "uncategorized" or t["date"] < cutoff:
            continue
        g = groups[t.get("merchant") or t["description"][:40]]
        g["count"] += 1
        g["total"] += t["amount"]
        if len(g["examples"]) < 2:
            g["examples"].append(t["description"])
    rows = sorted(
        ({"merchant": m, **v} for m, v in groups.items()),
        key=lambda r: -abs(r["total"]),
    )
    return {"groups": rows[:50]}
