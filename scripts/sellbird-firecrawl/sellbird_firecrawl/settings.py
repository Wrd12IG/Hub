"""Le impostazioni dell'estensione, dalle variabili d'ambiente o dal file `.env` di Sellbird.

Sellbird legge `.env` da sé e conosce solo le sue chiavi: qui si leggono le nostre. Tutto è spento finché non si accende
FIRECRAWL_ENRICH."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from .budget import Limits

DEFAULTS = {
    "FIRECRAWL_ENRICH_MONTHLY_CREDITS": "1000",   # scelto da Roberto: circa 10 titolari al mese
    "FIRECRAWL_ENRICH_DAILY_CREDITS": "300",
    "FIRECRAWL_RESERVE_CREDITS": "1500",          # l'account è condiviso con altri usi
    "FIRECRAWL_ENRICH_MIN_FIT": "50",
    "FIRECRAWL_ENRICH_PER_CYCLE": "3",            # il passo di ogni ciclo ha due minuti
    "FIRECRAWL_ENRICH_RETRY_DAYS": "90",
}


def read_dotenv(path: Path) -> dict:
    out: dict = {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return out
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        out[k.strip()] = v
    return out


def _int(value: str, default: int, low: int = 0, high: int = 1_000_000) -> int:
    try:
        return max(low, min(high, int(value)))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Settings:
    enabled: bool
    api_key: str
    limits: Limits
    min_fit: int
    per_cycle: int
    retry_days: int


def load(env: dict | None = None, home: Path | None = None) -> Settings:
    """`env` (per i test) oppure le variabili d'ambiente, con il `.env` della cartella di Sellbird come ripiego."""
    if env is None:
        home = home or Path(os.environ.get("SELLBIRD_HOME", "."))
        merged = {**read_dotenv(home / ".env"), **{k: v for k, v in os.environ.items() if k.startswith("FIRECRAWL_")}}
    else:
        merged = dict(env)

    def get(name: str) -> str:
        return (merged.get(name) or DEFAULTS.get(name, "")).strip()

    return Settings(
        enabled=get("FIRECRAWL_ENRICH").lower() in ("1", "on", "true", "yes", "si", "sì"),
        api_key=get("FIRECRAWL_API_KEY"),
        limits=Limits(
            monthly=_int(get("FIRECRAWL_ENRICH_MONTHLY_CREDITS"), 1000),
            daily=_int(get("FIRECRAWL_ENRICH_DAILY_CREDITS"), 300),
            reserve=_int(get("FIRECRAWL_RESERVE_CREDITS"), 1500),
        ),
        min_fit=_int(get("FIRECRAWL_ENRICH_MIN_FIT"), 50, 0, 100),
        per_cycle=_int(get("FIRECRAWL_ENRICH_PER_CYCLE"), 3, 1, 10),
        retry_days=_int(get("FIRECRAWL_ENRICH_RETRY_DAYS"), 90, 1, 3650),
    )
