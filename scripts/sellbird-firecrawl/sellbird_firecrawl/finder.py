"""Scelta delle aziende e creazione dei contatti. Nessuna dipendenza diretta da Sellbird: tutto quello che serve arriva
dal chiamante (sellbird_plugin.py), così si prova con dati finti e senza rete.

Quando un'azienda è candidata: ha un buon punteggio, nessuna persona con nome e un indirizzo utilizzabile, nessuna email già
inviata né approvata (non si annulla mai quello che una persona ha approvato), non è stata provata di recente e non è un
portale. Il titolare trovato diventa un contatto nuovo; la casella generica dello stesso posto viene messa da parte, così
non si scrive due volte alla stessa azienda."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Awaitable, Callable, Optional

from . import budget
from .client import CREDITS_PER_HIT, FirecrawlError

SOURCE = "firecrawl_anymail"
HALT_KEY = "fcenrich:halt"
TRIED_KEY = "fcenrich:tried"
# Stati dell'elenco aziende di Sellbird da cui ha senso partire: c'è solo una casella generica, o nessun contatto usabile.
ELIGIBLE_STATUS = {"Ready", "Draft waiting", "Not contacted"}
LIVE = {"new", "queued"}
# Portali e reti sociali: non sono concessionari e un titolare lì non ha senso.
PORTALS = {
    "subito.it", "paginebianche.it", "paginegialle.it", "quattroruote.it", "autoscout24.it", "automobile.it", "facebook.com",
    "instagram.com", "linkedin.com", "google.com", "wikipedia.org", "youtube.com", "tripadvisor.it", "kijiji.it", "ebay.it",
    "amazon.it", "virgilio.it", "yelp.com", "trovaprezzi.it", "infojobs.it", "indeed.com",
}

QueryDb = Callable[..., Awaitable[list]]


@dataclass
class Candidate:
    company_id: str
    domain: str
    name: str
    industry: str
    fit: int
    status: str


@dataclass
class Outcome:
    company_id: str
    domain: str
    result: str          # hit | miss | skipped | error
    detail: str = ""
    email: str = ""
    credits: int = 0


@dataclass
class Report:
    outcomes: list = field(default_factory=list)
    stopped: str = ""
    ledger: dict = field(default_factory=dict)
    candidates: list = field(default_factory=list)

    @property
    def credits(self) -> int:
        return sum(o.credits for o in self.outcomes)


def _chunks(items: list, size: int = 400):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def clean_domain(value: str) -> str:
    v = (value or "").strip().lower().split("//")[-1].split("/")[0].removeprefix("www.")
    return v if "." in v and " " not in v else ""


SHORT = 3   # le parole di questa lunghezza o più corte non si cercano come pezzo di testo: troverebbero «carpenteria»


def on_target(name: str, domain: str, description: str, keywords) -> bool:
    """L'azienda sembra del settore giusto: almeno una parola chiave nel nome, nel dominio o nella descrizione.
    Senza parole chiave (`*`) il controllo è spento. È una rete larga, non un giudizio: serve a non spendere crediti su una
    barca o su un'azienda informatica trovata per sbaglio; la parola «auto» prende anche «automazione», e va bene, perché
    l'ultima parola resta alla persona che legge la bozza.

    Le parole lunghe si cercano come pezzo di testo («auto» in «autostore»). Le corte («car», «km0») solo come **parola intera**
    («Top Car Italia», «Car System») o **in coda a una parola lunga** («Bramocar», «Avenuecar»): così non prendono «carpenteria»,
    «cartoleria» o «oscar»."""
    if not keywords:
        return True
    haystack = f"{name} {domain} {description}".lower()
    tokens = re.findall(r"[^\W_]+", haystack)   # il dominio si spezza sui punti e sui trattini
    for k in keywords:
        if len(k) > SHORT:
            if k in haystack:
                return True
        elif any(t == k or (len(t) >= len(k) + 3 and t.endswith(k)) for t in tokens):
            return True
    return False


def load_tried(raw: str, now: datetime, retry_days: int) -> dict:
    """Le aziende già provate e quando, senza quelle oltre la finestra di nuovo tentativo."""
    try:
        data = json.loads(raw or "{}")
    except (TypeError, ValueError):
        data = {}
    if not isinstance(data, dict):
        return {}
    limit = (now - timedelta(days=retry_days)).isoformat()
    return {k: v for k, v in data.items() if isinstance(k, str) and isinstance(v, str) and v >= limit}


async def select_candidates(
    query_db: QueryDb, rows: list, tried: dict, *, min_fit: int, limit: int, keywords=(), exclude=frozenset(),
    blocked: Optional[Callable[[str], bool]] = None, skips: Optional[dict] = None,
) -> list:
    """Le aziende da provare, le migliori prima. `rows` è l'elenco aziende di Sellbird (con punteggio e stato).
    `skips`, se dato, riceve {dominio: motivo} per chi viene scartato per settore, esclusione o «mai contattare»: serve a
    `estimate` per far vedere cosa è stato lasciato fuori e perché."""
    pool = [r for r in rows if r.get("status") in ELIGIBLE_STATUS and (r.get("fit") or 0) >= min_fit and r.get("id") not in tried]
    pool.sort(key=lambda r: -(r.get("fit") or 0))
    pool = pool[: max(limit * 8, 40)]  # c'è ancora da scartare: un margine, non l'elenco intero
    ids = [r["id"] for r in pool]
    if not ids:
        return []

    prospects: dict = {}
    outbox: dict = {}
    companies: dict = {}
    for chunk in _chunks(ids):
        marks = ",".join("?" * len(chunk))
        for p in await query_db(f"SELECT company_id, first_name, last_name, email_status, status FROM prospects WHERE company_id IN ({marks})", tuple(chunk)):
            prospects.setdefault(p["company_id"], []).append(p)
        for o in await query_db(
            f"SELECT p.company_id AS company_id, o.status AS status FROM outbox o JOIN prospects p ON p.id = o.prospect_id WHERE p.company_id IN ({marks})",
            tuple(chunk),
        ):
            outbox.setdefault(o["company_id"], set()).add(o["status"])
        for c in await query_db(f"SELECT id, domain, name, industry, description FROM companies WHERE id IN ({marks})", tuple(chunk)):
            companies[c["id"]] = c

    out: list = []
    for r in pool:
        cid = r["id"]
        c = companies.get(cid) or {}
        domain = clean_domain(c.get("domain") or "")
        if not domain or domain in PORTALS or any(domain.endswith("." + p) for p in PORTALS):
            continue
        def skip(reason: str) -> None:
            if skips is not None:
                skips[domain] = reason

        if domain in exclude or any(domain.endswith("." + d) for d in exclude):
            skip("esclusa a mano (FIRECRAWL_ENRICH_EXCLUDE_DOMAINS)")
            continue
        if blocked is not None and blocked(domain):
            skip("in «mai contattare»")
            continue
        if not on_target(c.get("name") or "", domain, c.get("description") or "", keywords):
            skip("non sembra del settore (nessuna parola chiave)")
            continue
        if outbox.get(cid, set()) & {"sent", "sending", "approved"}:
            continue  # una persona ha già approvato, o è già partita un'email
        named = [p for p in prospects.get(cid, [])
                 if (p.get("first_name") or "").strip() and (p.get("last_name") or "").strip()
                 and (p.get("email_status") or "") in ("verified", "risky") and p.get("status") in LIVE]
        if named:
            continue  # c'è già una persona con nome e un indirizzo utilizzabile
        out.append(Candidate(cid, domain, c.get("name") or domain, c.get("industry") or "", int(r.get("fit") or 0), r.get("status") or ""))
        if len(out) >= limit:
            break
    return out


async def _generic_prospects(query_db: QueryDb, company_id: str) -> list:
    return await query_db(
        "SELECT id, status, personalization_notes FROM prospects WHERE company_id = ? AND (TRIM(COALESCE(first_name, '')) = '' OR title = 'General inbox')",
        (company_id,),
    )


async def _store_hit(cand: Candidate, dm, *, state, query_db, make_prospect, blocked, verify) -> tuple[str, str]:
    """Crea il contatto e mette da parte la casella generica. Ritorna (esito, dettaglio)."""
    if blocked(dm.email):
        return "skipped", "indirizzo in lista «mai contattare» o tra le disiscrizioni"
    if await state.get_prospect_by_email(dm.email):
        return "skipped", "già nell'elenco"
    if verify is not None:
        # Si fida del fornitore, ma un controllo nostro può solo bocciare: mai promuovere.
        try:
            if (await verify(dm.email)) == "invalid":
                return "skipped", "il nostro controllo boccia l'indirizzo"
        except Exception:
            pass
    generic = await _generic_prospects(query_db, cand.company_id)
    notes = next((g.get("personalization_notes") for g in generic if g.get("personalization_notes")), "") or ""
    prospect = make_prospect(
        first_name=dm.first_name, last_name=dm.last_name, email=dm.email, email_status="verified", email_verified=True,
        company=cand.name, company_id=cand.company_id, title=dm.title or "CEO",
        seniority="c_suite" if dm.category == "ceo" else "director", industry=cand.industry,
        source=SOURCE, source_url="firecrawl:anymailfinder", status="new", personalization_notes=notes,
    )
    await state.add_prospect(prospect)
    for g in generic:
        if g.get("status") in LIVE:
            await state.cancel_pending_outbox_for_prospect(g["id"], reason="sostituito dal titolare trovato")
            await state.update_prospect_status(g["id"], "lost")
    return "hit", f"{dm.first_name} {dm.last_name}, {dm.title or dm.category}"


async def run_cycle(
    *, state: Any, client: Optional[Any], settings: Any, rows: list, query_db: QueryDb, make_prospect: Callable,
    blocked: Callable[[str], bool], verify: Optional[Callable] = None, now: datetime, limit: Optional[int] = None,
    dry_run: bool = False,
) -> Report:
    """Un giro: sceglie le candidate e, senza dry_run, chiede il titolare entro il bilancio. Non solleva mai: ogni problema
    finisce nel rapporto. Un errore che richiede una persona (chiave, termini, crediti) ferma tutto finché non si lancia
    `sellbird firecrawl resume`."""
    report = Report()
    halted = await state.get_setting(HALT_KEY)
    ledger = budget.load(await state.get_setting(budget.LEDGER_KEY), now)
    report.ledger = ledger
    if halted and not dry_run:
        report.stopped = f"fermo: {halted}"
        return report

    tried = load_tried(await state.get_setting(TRIED_KEY), now, settings.retry_days)
    report.candidates = await select_candidates(
        query_db, rows, tried, min_fit=settings.min_fit, limit=limit or settings.per_cycle,
        keywords=getattr(settings, "keywords", ()), exclude=getattr(settings, "exclude", frozenset()), blocked=blocked,
    )
    if dry_run or not report.candidates:
        return report

    remaining: Optional[int] = None
    try:
        remaining = await client.remaining_credits()  # chiamata gratuita
    except FirecrawlError as e:
        if e.fatal:
            await state.set_setting(HALT_KEY, str(e))
        report.stopped = str(e)
        return report
    except Exception as e:  # rete: si riprova al prossimo ciclo
        report.stopped = f"Firecrawl non raggiungibile: {type(e).__name__}"
        return report

    for cand in report.candidates:
        ok, why = budget.can_spend(ledger, settings.limits, CREDITS_PER_HIT, remaining)
        if not ok:
            report.stopped = why
            break
        if blocked(cand.domain):
            tried[cand.company_id] = now.isoformat()
            report.outcomes.append(Outcome(cand.company_id, cand.domain, "skipped", "dominio in lista «mai contattare»"))
            continue
        try:
            dm = await client.decision_maker(cand.domain, request_id=f"sb-{cand.company_id}-{now.strftime('%Y%m%d')}")
        except FirecrawlError as e:
            if e.fatal:
                await state.set_setting(HALT_KEY, str(e))
            report.outcomes.append(Outcome(cand.company_id, cand.domain, "error", str(e)))
            report.stopped = str(e)
            break
        except Exception as e:
            report.outcomes.append(Outcome(cand.company_id, cand.domain, "error", type(e).__name__))
            report.stopped = f"Firecrawl non raggiungibile: {type(e).__name__}"
            break

        credits = CREDITS_PER_HIT if dm else 0
        ledger = budget.record(ledger, credits, bool(dm))
        remaining = (remaining - credits) if remaining is not None else None
        tried[cand.company_id] = now.isoformat()
        if dm:
            result, detail = await _store_hit(cand, dm, state=state, query_db=query_db, make_prospect=make_prospect, blocked=blocked, verify=verify)
            report.outcomes.append(Outcome(cand.company_id, cand.domain, result, detail, dm.email if result == "hit" else "", credits))
        else:
            report.outcomes.append(Outcome(cand.company_id, cand.domain, "miss", "nessun titolare trovato", "", 0))
        # Si salva dopo ogni azienda: un guasto a metà non perde il conto dei crediti.
        await state.set_setting(budget.LEDGER_KEY, budget.dump(ledger))
        await state.set_setting(TRIED_KEY, json.dumps(tried))

    report.ledger = ledger
    await state.set_setting(budget.LEDGER_KEY, budget.dump(ledger))
    await state.set_setting(TRIED_KEY, json.dumps(tried))
    return report
