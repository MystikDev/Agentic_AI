"""Single-file JSON store for everything personal-finance related."""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from ..config import DATA_DIR

FINANCE_PATH: Path = DATA_DIR / "finance.json"

DEFAULT: dict[str, Any] = {
    "accounts": [],
    "transactions": [],
    "paychecks": [],
    "bills": [],
    "budgets": [],
    "category_rules": [],
    "plaid": {"access_tokens": {}, "cursors": {}},
}


def load() -> dict:
    if not FINANCE_PATH.exists():
        return json.loads(json.dumps(DEFAULT))
    try:
        data = json.loads(FINANCE_PATH.read_text())
    except Exception:
        return json.loads(json.dumps(DEFAULT))
    for k, v in DEFAULT.items():
        data.setdefault(k, json.loads(json.dumps(v)))
    return data


def save(data: dict) -> None:
    FINANCE_PATH.write_text(json.dumps(data, indent=2, default=str))


def new_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds")
