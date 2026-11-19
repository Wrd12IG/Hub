"""Il collegamento a Sellbird: un passo a ogni ciclo e il comando `sellbird firecrawl`.

Qui, e solo qui, si importa Sellbird. Il resto dell'estensione non lo conosce, ed è per questo che si prova senza.
Un'estensione di Sellbird è un pacchetto separato: non si tocca il suo codice (vedi docs/extensions.md di Sellbird)."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from . import budget, finder, settings as cfg
from .client import CREDITS_PER_HIT, FirecrawlClient

logger = logging.getLogger("sellbird.firecrawl")


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _sellbird_side(config, state):
    """Le parti di Sellbird che servono al giro: elenco aziende, «mai contattare», modello del contatto, verifica."""
    from sellbird.config import live_do_not_contact, load_env
    from sellbird.gate import do_not_contact_match
    from sellbird.integrations.email_finder import verify_published_address
    from sellbird.models.prospect import Prospect
    from sellbird.register import build_register, sqlite_query

    query_db = sqlite_query(state.db_path)
    rows = await build_register(query_db, config)
    dnc = list(live_do_not_contact(config) or [])
    suppressed = {str(r["value"]).lower() for r in await query_db("SELECT value FROM suppressions")}
    env = load_env()

    def blocked(target: str) -> bool:
        t = (target or "").lower()
        domain = t.rsplit("@", 1)[-1]
        if t in suppressed or domain in suppressed:
            return True
        return bool(do_not_contact_match(t if "@" in t else f"x@{t}", dnc))

    async def verify(email: str) -> str:
        return await verify_published_address(email, env=env)

    return query_db, rows, blocked, verify, (lambda **kw: Prospect(**kw))


async def _run(config, state, s: cfg.Settings, *, limit=None, dry_run=False):
    query_db, rows, blocked, verify, make_prospect = await _sellbird_side(config, state)
    client = None if dry_run else FirecrawlClient(s.api_key)
    try:
        report = await finder.run_cycle(
            state=state, client=client, settings=s, rows=rows, query_db=query_db, make_prospect=make_prospect,
            blocked=blocked, verify=verify, now=_now(), limit=limit, dry_run=dry_run,
        )
    finally:
        if client is not None:
            await client.aclose()
    for o in report.outcomes:
        if o.result == "hit":
            await state.log_action("firecrawl_enrich", "firecrawl", {"domain": o.domain, "result": o.result, "credits": o.credits})
    return report


async def tick(ctx) -> None:
    """Un giro per ciclo, solo se acceso (FIRECRAWL_ENRICH=on) e con la chiave. Gli errori si registrano, non fermano Sellbird."""
    s = cfg.load()
    if not s.enabled or not s.api_key:
        return
    report = await _run(ctx.config, ctx.state, s)
    hits = [o for o in report.outcomes if o.result == "hit"]
    if report.outcomes or report.stopped:
        logger.info("Firecrawl: %d aziende provate, %d titolari trovati, %d crediti (listino)%s",
                    len(report.outcomes), len(hits), report.credits, f"; si ferma: {report.stopped}" if report.stopped else "")


# ── comando `sellbird firecrawl` ─────────────────────────────────────────────

def configure(parser):
    sub = parser.add_subparsers(dest="fc_action")
    sub.add_parser("status", help="Stato: acceso o spento, crediti usati, contatti trovati")
    est = sub.add_parser("estimate", help="Le aziende candidate e il costo massimo, senza chiamare Firecrawl")
    est.add_argument("--limit", type=int, default=10)
    run = sub.add_parser("run", help="Un giro adesso, entro il bilancio (chiama Firecrawl e può spendere crediti)")
    run.add_argument("--limit", type=int, default=3)
    run.add_argument("--yes", action="store_true", help="senza chiedere conferma")
    sub.add_parser("resume", help="Riparte dopo uno stop (chiave, termini del fornitore, crediti)")
    return lambda args: asyncio.run(_cli(args))


async def _cli(args) -> None:
    from sellbird.config import load_config
    from sellbird.register import sqlite_query
    from sellbird.state import StateManager

    action = getattr(args, "fc_action", None) or "status"
    config, state = load_config(), StateManager()
    await state.init_db()
    s = cfg.load()

    if action == "resume":
        await state.set_setting(finder.HALT_KEY, "")
        print("\n  Ripartito.\n")
        return

    if action == "status":
        now = _now()
        ledger = budget.load(await state.get_setting(budget.LEDGER_KEY), now)
        halted = await state.get_setting(finder.HALT_KEY)
        found = await sqlite_query(state.db_path)("SELECT COUNT(*) AS n FROM prospects WHERE source = ?", (finder.SOURCE,))
        print(f"\n  Arricchimento Firecrawl: {'ACCESO' if s.enabled else 'spento (FIRECRAWL_ENRICH=on per accenderlo)'}")
        print(f"  Chiave:     {'presente' if s.api_key else 'MANCA (FIRECRAWL_API_KEY nel file .env)'}")
        print(f"  Oggi:       {ledger['day_credits']} / {s.limits.daily} crediti (listino)")
        print(f"  Questo mese:{ledger['month_credits']:>5} / {s.limits.monthly} crediti; riserva sull'account: {s.limits.reserve}")
        print(f"  Chiamate:   {ledger['calls']} nel mese, {ledger['hits']} titolari trovati; {found[0]['n']} contatti in tutto")
        if halted:
            print(f"  FERMO:      {halted}  (si riparte con: sellbird firecrawl resume)")
        print()
        return

    query_db, rows, blocked, verify, make_prospect = await _sellbird_side(config, state)
    if action == "estimate":
        tried = finder.load_tried(await state.get_setting(finder.TRIED_KEY), _now(), s.retry_days)
        cands = await finder.select_candidates(query_db, rows, tried, min_fit=s.min_fit, limit=args.limit)
        print(f"\n  {len(cands)} aziende candidate (punteggio almeno {s.min_fit}, solo casella generica, mai contattate):")
        for c in cands:
            print(f"    {c.fit:>3}  {c.name}  ({c.domain})  [{c.status}]")
        print(f"\n  Costo massimo al listino: {len(cands) * CREDITS_PER_HIT} crediti ({CREDITS_PER_HIT} per ogni titolare trovato; chi non si trova non costa).")
        print("  Nessuna chiamata fatta.\n")
        return

    if action == "run":
        if not s.api_key:
            print("\n  Manca FIRECRAWL_API_KEY nel file .env.\n")
            return
        if not args.yes:
            if input(f"\n  Chiamo Firecrawl per al massimo {args.limit} aziende (fino a {args.limit * CREDITS_PER_HIT} crediti). Continuo? [s/N] ").strip().lower() not in ("s", "si", "sì", "y", "yes"):
                return
        report = await _run(config, state, s, limit=args.limit)
        for o in report.outcomes:
            print(f"    {o.result:<8} {o.domain}  {o.detail}")
        print(f"\n  {report.credits} crediti (listino)." + (f" Si è fermato: {report.stopped}" if report.stopped else "") + "\n")


def install(registry) -> None:
    registry.add_tick_step("firecrawl.enrich", tick)
    registry.add_cli_command("firecrawl", configure, help="Trova il titolare delle aziende con Firecrawl")
