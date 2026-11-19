"""Il bilancio dei crediti: quanti se ne possono spendere oggi e questo mese. Funzioni pure, senza rete né database.

Il bilancio conta il LISTINO (100 crediti per ogni titolare trovato, 0 per le ricerche senza esito), non quanto Firecrawl
scala davvero: nella prova non ha scalato nulla grazie ai crediti gratuiti del fornitore, ma non è garantito. Contare il
massimo è la scelta prudente.

Il registro sta in una sola chiave della tabella `settings` di Sellbird, come JSON, e si azzera da solo al cambio di giorno
e di mese."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime

LEDGER_KEY = "fcenrich:ledger"


@dataclass(frozen=True)
class Limits:
    monthly: int
    daily: int
    reserve: int


def empty(now: datetime) -> dict:
    return {"month": now.strftime("%Y-%m"), "month_credits": 0, "day": now.strftime("%Y-%m-%d"), "day_credits": 0, "calls": 0, "hits": 0}


def load(raw: str, now: datetime) -> dict:
    """Il registro letto da `settings`, azzerato dove è cambiato il giorno o il mese; un valore rovinato riparte da zero."""
    try:
        data = json.loads(raw or "{}")
    except (TypeError, ValueError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    ledger = empty(now)
    for k in ("calls", "hits"):
        ledger[k] = int(data.get(k, 0)) if isinstance(data.get(k), (int, float)) else 0
    if data.get("month") == ledger["month"] and isinstance(data.get("month_credits"), (int, float)):
        ledger["month_credits"] = int(data["month_credits"])
    if data.get("day") == ledger["day"] and isinstance(data.get("day_credits"), (int, float)):
        ledger["day_credits"] = int(data["day_credits"])
    return ledger


def can_spend(ledger: dict, limits: Limits, cost: int, remaining: int | None = None) -> tuple[bool, str]:
    """(si può, motivo se no). `remaining` = crediti residui dell'account, se noti: sotto la riserva ci si ferma sempre."""
    if ledger["day_credits"] + cost > limits.daily:
        return False, f"tetto giornaliero ({limits.daily} crediti) raggiunto"
    if ledger["month_credits"] + cost > limits.monthly:
        return False, f"tetto mensile ({limits.monthly} crediti) raggiunto"
    if remaining is not None and remaining - cost < limits.reserve:
        return False, f"sull'account restano {remaining} crediti: la riserva di {limits.reserve} non si tocca"
    return True, ""


def record(ledger: dict, credits: int, hit: bool) -> dict:
    out = dict(ledger)
    out["calls"] += 1
    out["hits"] += 1 if hit else 0
    out["month_credits"] += credits
    out["day_credits"] += credits
    return out


def dump(ledger: dict) -> str:
    return json.dumps(ledger)
