"""Client Firecrawl minimale: il titolare di un'azienda (Anymail Finder, via Alexandria) e i crediti residui.

Solo quello che serve a Sellbird. Il client non decide mai se spendere: lo fa il chiamante, con il bilancio dei crediti
(budget.py). Non accetta mai i termini di un fornitore e non riprova da solo una chiamata a pagamento.

HTTP (https://docs.firecrawl.dev/features/alexandria):
    POST /v2/scrape   {"alexandria": {"provider", "capability", "options"}}   → {"success", "data": {"alexandria": [...]}}
    GET  /v2/team/credit-usage                                                → {"success", "data": {"remainingCredits", ...}}
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Any, Optional

API = "https://api.firecrawl.dev"
PROVIDER = "anymailfinder"
CAPABILITY = "people/decision-maker"
# Si prova nell'ordine: prima il vertice dell'azienda, poi il marketing.
CATEGORIES = ("ceo", "marketing")
# Listino di una ricerca andata a buon fine (le ricerche senza esito non costano): il bilancio conta questo, per prudenza.
CREDITS_PER_HIT = 100

# Caselle di ruolo: non sono una persona, e se il fornitore ne restituisce una non serve.
GENERIC_LOCALS = {
    "info", "contatti", "contatto", "contact", "contacts", "ufficio", "segreteria", "amministrazione", "commerciale",
    "vendite", "sales", "marketing", "admin", "office", "mail", "posta", "noreply", "no-reply", "supporto", "support",
    "assistenza", "officina", "usato", "nuovo", "servizioclienti", "dpo", "privacy", "pec", "webmaster",
}
_EMAIL = re.compile(r"^[A-Za-z0-9._%+-]{1,64}@([A-Za-z0-9-]+\.)+[A-Za-z]{2,24}$")
_NAME = re.compile(r"^[^\W\d_][^\W\d_ .'’-]*(?:[ .'’-][^\W\d_]+)*\.?$", re.UNICODE)


class FirecrawlError(Exception):
    """Una chiamata non è andata a buon fine. `fatal` = inutile riprovare finché qualcuno non interviene."""

    def __init__(self, message: str, *, fatal: bool = False):
        super().__init__(message)
        self.fatal = fatal


class TermsRequired(FirecrawlError):
    """Il fornitore chiede che un amministratore accetti i suoi termini: lo può fare solo una persona, dal sito Firecrawl."""

    def __init__(self, url: str = ""):
        super().__init__("Firecrawl chiede di accettare i termini del fornitore (Anymail Finder)" + (f": {url}" if url else ""), fatal=True)
        self.url = url


class OutOfCredits(FirecrawlError):
    def __init__(self, message: str = "Crediti Firecrawl esauriti"):
        super().__init__(message, fatal=True)


@dataclass(frozen=True)
class DecisionMaker:
    first_name: str
    last_name: str
    title: str
    email: str
    category: str


def redact(text: str, key: str) -> str:
    """Toglie la chiave da un testo prima di scriverlo in un registro."""
    return text.replace(key, "***") if key else text


def _clean(value: Any, limit: int) -> str:
    return " ".join(str(value or "").split())[:limit]


def parse_decision_maker(entry: dict, company_domain: str) -> Optional[DecisionMaker]:
    """Il titolare dalla risposta del fornitore, o None se non c'è o non è credibile.

    Si scarta: un indirizzo non valido o non marcato `valid`, di un altro dominio (il fornitore non deve poterci far
    scrivere altrove), una casella di ruolo, e un nome che non somiglia a un nome di persona."""
    data = (entry or {}).get("data") or {}
    if data.get("email_status") != "valid":
        return None
    email = _clean(data.get("valid_email") or data.get("email"), 254).lower()
    first, last = _clean(data.get("person_first_name"), 60), _clean(data.get("person_last_name"), 80)
    if not first or not last:
        # alcuni record portano solo il nome completo
        parts = _clean(data.get("person_full_name"), 140).split(" ", 1)
        if len(parts) == 2:
            first, last = parts[0], parts[1]
    if not _EMAIL.match(email) or not _NAME.match(first) or not _NAME.match(last):
        return None
    domain = (company_domain or "").lower().removeprefix("www.")
    host = email.rsplit("@", 1)[1]
    if not domain or not (host == domain or host.endswith("." + domain)):
        return None
    if email.split("@", 1)[0] in GENERIC_LOCALS:
        return None
    return DecisionMaker(first, last, _clean(data.get("person_job_title"), 120), email, _clean(data.get("decision_maker_category"), 20))


class FirecrawlClient:
    def __init__(self, api_key: str, *, http: Any = None, base: str = API, timeout: float = 20.0):
        if not api_key:
            raise FirecrawlError("Manca FIRECRAWL_API_KEY", fatal=True)
        self._key = api_key
        self._base = base.rstrip("/")
        if http is None:
            import httpx  # presente in Sellbird; importato qui perché i test non ne hanno bisogno

            http = httpx.AsyncClient(timeout=timeout)
        self._http = http

    async def aclose(self) -> None:
        close = getattr(self._http, "aclose", None)
        if close:
            await close()

    def _headers(self, request_id: Optional[str] = None) -> dict:
        h = {"Authorization": f"Bearer {self._key}", "Content-Type": "application/json"}
        if request_id:
            h["x-request-id"] = request_id  # idempotenza: la stessa richiesta non si paga due volte
        return h

    def _raise_for(self, status: int, body: Any) -> None:
        err = ""
        if isinstance(body, dict):
            e = body.get("error")
            err = (e.get("message") if isinstance(e, dict) else e) or body.get("message") or ""
            code = (e.get("code") if isinstance(e, dict) else body.get("code")) or ""
            if "TERMS" in str(code).upper() or "THIRD_PARTY_DATA_TERMS_REQUIRED" in str(err):
                action = (e.get("requiresAction") if isinstance(e, dict) else None) or body.get("requiresAction") or {}
                raise TermsRequired(str(action.get("url") or ""))
        err = redact(_clean(err, 200), self._key)
        if status in (401, 403):
            raise FirecrawlError(f"Firecrawl rifiuta la chiave ({status}): controlla FIRECRAWL_API_KEY", fatal=True)
        if status == 402:
            raise OutOfCredits(err or "Crediti Firecrawl esauriti")
        if status == 429:
            raise FirecrawlError("Firecrawl: troppe richieste, si riprova al prossimo ciclo")
        raise FirecrawlError(f"Firecrawl risponde {status}" + (f": {err}" if err else ""))

    async def remaining_credits(self) -> int:
        r = await self._http.get(f"{self._base}/v2/team/credit-usage", headers=self._headers())
        body = r.json() if r.content else {}
        if r.status_code != 200:
            self._raise_for(r.status_code, body)
        remaining = ((body or {}).get("data") or {}).get("remainingCredits")
        if not isinstance(remaining, (int, float)):
            raise FirecrawlError("Firecrawl: risposta senza crediti residui")
        return int(remaining)

    async def decision_maker(self, domain: str, categories=CATEGORIES, request_id: Optional[str] = None) -> Optional[DecisionMaker]:
        payload = {"alexandria": {"provider": PROVIDER, "capability": CAPABILITY,
                                  "options": {"decision_maker_category": list(categories), "domain": domain}}}
        r = await self._http.post(f"{self._base}/v2/scrape", json=payload, headers=self._headers(request_id or str(uuid.uuid4())))
        body = r.json() if r.content else {}
        if r.status_code != 200 or (isinstance(body, dict) and body.get("success") is False):
            self._raise_for(r.status_code, body)
        results = (((body or {}).get("data") or {}).get("alexandria")) or []
        if not results:
            return None
        entry = results[0]
        if entry.get("error"):
            self._raise_for(200, {"error": entry["error"]})
        return parse_decision_maker(entry, domain)
