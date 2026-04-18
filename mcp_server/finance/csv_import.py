"""CSV importer that auto-detects column layouts from common bank/CC exports."""
from __future__ import annotations

import csv
import re
from datetime import datetime
from pathlib import Path

from .store import load, save
from .transactions import _apply_rules, normalize_merchant
from .store import new_id

DATE_FIELDS = ["date", "posted date", "posting date", "transaction date", "trans date", "post date"]
DESC_FIELDS = ["description", "memo", "name", "details", "transaction", "payee", "merchant"]
AMOUNT_FIELDS = ["amount", "transaction amount"]
DEBIT_FIELDS = ["debit", "withdrawal", "withdrawals", "outflow"]
CREDIT_FIELDS = ["credit", "deposit", "deposits", "inflow"]
CATEGORY_FIELDS = ["category", "type"]


def _find(columns: list[str], candidates: list[str]) -> str | None:
    cols = {c.lower().strip(): c for c in columns}
    for cand in candidates:
        if cand in cols:
            return cols[cand]
    for key, orig in cols.items():
        for cand in candidates:
            if cand in key:
                return orig
    return None


def _parse_date(s: str) -> str:
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%d/%m/%Y", "%Y/%m/%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return s


def _parse_amount(s: str) -> float:
    s = (s or "").strip().replace(",", "").replace("$", "")
    if not s:
        return 0.0
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    try:
        return float(s)
    except ValueError:
        return 0.0


def import_csv(
    path: str,
    account_id: str,
    invert_amounts: bool = False,
    skip_duplicates: bool = True,
) -> dict:
    """Import a bank/credit-card CSV. Auto-detects columns.

    - `invert_amounts`: set True if the source file uses positive numbers for debits
      (some credit-card exports do this). Normal bank exports: negative = debit.
    - `skip_duplicates`: skip rows that match (account_id, date, amount, description) of
      an existing transaction.
    """
    p = Path(path).expanduser()
    if not p.exists():
        return {"error": f"file not found: {p}"}

    data = load()
    if not any(a["id"] == account_id for a in data["accounts"]):
        return {"error": f"account not found: {account_id}"}

    existing_keys = {
        (t["account_id"], t["date"], round(t["amount"], 2), t["description"].strip())
        for t in data["transactions"]
    } if skip_duplicates else set()

    rules = [(r["pattern"], r["category"]) for r in data.get("category_rules", [])]

    with p.open(newline="", encoding="utf-8-sig") as f:
        sample = f.read(4096)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample)
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(f, dialect=dialect)
        columns = reader.fieldnames or []

        date_col = _find(columns, DATE_FIELDS)
        desc_col = _find(columns, DESC_FIELDS)
        amt_col = _find(columns, AMOUNT_FIELDS)
        debit_col = _find(columns, DEBIT_FIELDS)
        credit_col = _find(columns, CREDIT_FIELDS)
        cat_col = _find(columns, CATEGORY_FIELDS)

        if not date_col or not desc_col:
            return {"error": f"could not detect date/description columns. Found: {columns}"}

        added = 0
        skipped = 0
        for row in reader:
            raw_date = (row.get(date_col) or "").strip()
            desc = (row.get(desc_col) or "").strip()
            if not raw_date or not desc:
                continue

            if amt_col:
                amount = _parse_amount(row.get(amt_col, ""))
            else:
                debit = _parse_amount(row.get(debit_col, "")) if debit_col else 0
                credit = _parse_amount(row.get(credit_col, "")) if credit_col else 0
                amount = credit - debit

            if invert_amounts:
                amount = -amount

            parsed_date = _parse_date(raw_date)
            key = (account_id, parsed_date, round(amount, 2), desc)
            if key in existing_keys:
                skipped += 1
                continue
            existing_keys.add(key)

            category = (row.get(cat_col) or "").strip().lower() if cat_col else ""
            if not category:
                category = _apply_rules(desc, rules) or "uncategorized"

            data["transactions"].append({
                "id": new_id("txn"),
                "account_id": account_id,
                "date": parsed_date,
                "amount": amount,
                "description": desc,
                "merchant": normalize_merchant(desc),
                "category": category,
                "pending": False,
                "notes": "imported",
            })
            added += 1

    save(data)
    return {
        "ok": True,
        "added": added,
        "skipped_duplicates": skipped,
        "detected_columns": {
            "date": date_col,
            "description": desc_col,
            "amount": amt_col,
            "debit": debit_col,
            "credit": credit_col,
            "category": cat_col,
        },
    }
