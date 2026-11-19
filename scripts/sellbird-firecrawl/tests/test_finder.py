import json
import os
import sqlite3
import sys
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from sellbird_firecrawl import budget, finder, settings  # noqa: E402
from sellbird_firecrawl.client import DecisionMaker, FirecrawlError, OutOfCredits, TermsRequired  # noqa: E402

NOW = datetime(2026, 11, 19, 12, 0, tzinfo=timezone.utc)
SCHEMA = """
CREATE TABLE companies (id TEXT PRIMARY KEY, domain TEXT, name TEXT, industry TEXT, description TEXT DEFAULT '');
CREATE TABLE prospects (id TEXT PRIMARY KEY, company_id TEXT, first_name TEXT DEFAULT '', last_name TEXT DEFAULT '', email TEXT DEFAULT '',
                        email_status TEXT DEFAULT '', status TEXT DEFAULT 'new', title TEXT DEFAULT '', personalization_notes TEXT DEFAULT '', source TEXT DEFAULT '');
CREATE TABLE outbox (id TEXT PRIMARY KEY, prospect_id TEXT, status TEXT);
"""


class FakeState:
    def __init__(self, db):
        self.db, self.settings, self.added, self.cancelled, self.statuses = db, {}, [], [], {}

    async def get_setting(self, key, default=""):
        return self.settings.get(key, default)

    async def set_setting(self, key, value):
        self.settings[key] = value

    async def add_prospect(self, p):
        self.added.append(p)
        self.db.execute("INSERT INTO prospects (id, company_id, first_name, last_name, email, email_status, status, title, source) VALUES (?,?,?,?,?,?,?,?,?)",
                        (f"new{len(self.added)}", p.company_id, p.first_name, p.last_name, p.email, p.email_status, p.status, p.title, p.source))
        return f"new{len(self.added)}"

    async def get_prospect_by_email(self, email):
        r = self.db.execute("SELECT id FROM prospects WHERE email = ?", (email,)).fetchone()
        return SimpleNamespace(id=r[0]) if r else None

    async def cancel_pending_outbox_for_prospect(self, pid, reason=""):
        self.cancelled.append((pid, reason))
        return 1

    async def update_prospect_status(self, pid, status):
        self.statuses[pid] = status


class FakeClient:
    def __init__(self, result=None, credits=3000, error=None):
        self.result, self.credits, self.error, self.calls, self.credit_calls = result, credits, error, [], 0

    async def remaining_credits(self):
        self.credit_calls += 1
        return self.credits

    async def decision_maker(self, domain, categories=None, request_id=None):
        self.calls.append((domain, request_id))
        if self.error:
            raise self.error
        return self.result


DM = DecisionMaker("Paolo", "Carmeli", "CEO", "paolo@gruppo.it", "ceo")


class Base(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.state = FakeState(self.db)
        self.s = settings.load({"FIRECRAWL_ENRICH_KEYWORDS": "*"})   # i test di base non guardano il settore: ci sono quelli a parte

    async def query_db(self, sql, params=()):
        return [dict(r) for r in self.db.execute(sql, params).fetchall()]

    def company(self, cid="c1", domain="gruppo.it", name="Gruppo Esempio", fit=80, status="Draft waiting", generic=True, notes="spunto", description=""):
        self.db.execute("INSERT INTO companies VALUES (?,?,?,?,?)", (cid, domain, name, "Concessionario auto", description))
        if generic:
            self.db.execute("INSERT INTO prospects (id, company_id, email, email_status, title, personalization_notes) VALUES (?,?,?,?,?,?)",
                            (f"g-{cid}", cid, f"info@{domain}", "verified", "General inbox", notes))
        return {"id": cid, "fit": fit, "status": status}

    async def cycle(self, rows, client=None, **kw):
        args = dict(state=self.state, client=client, settings=self.s, rows=rows, query_db=self.query_db,
                    make_prospect=lambda **f: SimpleNamespace(**f), blocked=lambda t: False, verify=None, now=NOW)
        args.update(kw)
        return await finder.run_cycle(**args)


class SelectTest(Base):
    async def test_filters(self):
        rows = [
            self.company("ok"),
            self.company("low", domain="basso.it", fit=30),
            self.company("emailed", domain="inviata.it", status="Emailed"),
            self.company("sent", domain="sent.it"), self.company("appr", domain="appr.it"),
            self.company("named", domain="nome.it"), self.company("portal", domain="subito.it"),
            self.company("sub", domain="negozio.subito.it"), self.company("nodomain", domain=""),
            self.company("recent", domain="recente.it"),
            self.company("nocontact", domain="nessuno.it", status="Not contacted", generic=False),
        ]
        self.db.execute("INSERT INTO prospects (id, company_id, email) VALUES ('s1','sent','a@sent.it')")
        self.db.execute("INSERT INTO outbox VALUES ('o1','s1','sent')")
        self.db.execute("INSERT INTO prospects (id, company_id, email) VALUES ('s2','appr','a@appr.it')")
        self.db.execute("INSERT INTO outbox VALUES ('o2','s2','approved')")
        self.db.execute("INSERT INTO prospects (id, company_id, first_name, last_name, email, email_status) VALUES ('n1','named','Anna','Rossi','anna@nome.it','verified')")
        tried = {"recent": (NOW - timedelta(days=10)).isoformat()}
        got = await finder.select_candidates(self.query_db, rows, tried, min_fit=50, limit=20)
        self.assertEqual(sorted(c.company_id for c in got), ["nocontact", "ok"])

    async def test_best_fit_first_and_limit(self):
        rows = [self.company("a", domain="a.it", fit=60), self.company("b", domain="b.it", fit=90), self.company("c", domain="c.it", fit=75)]
        got = await finder.select_candidates(self.query_db, rows, {}, min_fit=50, limit=2)
        self.assertEqual([c.company_id for c in got], ["b", "c"])

    async def test_a_named_but_unusable_contact_does_not_block(self):
        rows = [self.company("x", domain="x.it")]
        self.db.execute("INSERT INTO prospects (id, company_id, first_name, last_name, email, email_status) VALUES ('n','x','Anna','Rossi','anna@x.it','guess')")
        self.assertEqual(len(await finder.select_candidates(self.query_db, rows, {}, min_fit=50, limit=5)), 1)

    def test_tried_window(self):
        raw = json.dumps({"vecchia": (NOW - timedelta(days=100)).isoformat(), "nuova": (NOW - timedelta(days=5)).isoformat(), "rotta": 5})
        self.assertEqual(list(finder.load_tried(raw, NOW, 90)), ["nuova"])
        self.assertEqual(finder.load_tried("non json", NOW, 90), {})


class CycleTest(Base):
    async def test_hit_creates_the_contact_and_sets_the_inbox_aside(self):
        row = self.company()
        self.db.execute("INSERT INTO outbox VALUES ('o1','g-c1','pending_review')")
        client = FakeClient(DM)
        report = await self.cycle([row], client)
        self.assertEqual([(o.result, o.credits, o.email) for o in report.outcomes], [("hit", 100, "paolo@gruppo.it")])
        p = self.state.added[0]
        self.assertEqual((p.first_name, p.last_name, p.email, p.email_status, p.email_verified, p.title, p.seniority, p.source, p.status),
                         ("Paolo", "Carmeli", "paolo@gruppo.it", "verified", True, "CEO", "c_suite", "firecrawl_anymail", "new"))
        self.assertEqual((p.company, p.company_id, p.personalization_notes), ("Gruppo Esempio", "c1", "spunto"))  # lo spunto della casella generica resta
        self.assertEqual(self.state.cancelled[0][0], "g-c1")        # la bozza per info@ si annulla
        self.assertEqual(self.state.statuses["g-c1"], "lost")        # e info@ non riceve più nulla
        led = budget.load(self.state.settings[budget.LEDGER_KEY], NOW)
        self.assertEqual((led["day_credits"], led["month_credits"], led["hits"], led["calls"]), (100, 100, 1, 1))
        self.assertIn("c1", json.loads(self.state.settings[finder.TRIED_KEY]))
        self.assertEqual(client.calls, [("gruppo.it", "sb-c1-20261119")])   # richiesta idempotente: stesso giorno, stessa azienda

    async def test_miss_costs_nothing_but_is_remembered(self):
        report = await self.cycle([self.company()], FakeClient(None))
        self.assertEqual([(o.result, o.credits) for o in report.outcomes], [("miss", 0)])
        self.assertEqual(self.state.added, [])
        self.assertEqual(budget.load(self.state.settings[budget.LEDGER_KEY], NOW)["month_credits"], 0)
        again = await self.cycle([self.company("c2", domain="altra.it")] + [{"id": "c1", "fit": 80, "status": "Draft waiting"}], FakeClient(None))
        self.assertEqual([c.company_id for c in again.candidates], ["c2"])   # c1 è già stata provata

    async def test_budget_stops_before_calling(self):
        self.state.settings[budget.LEDGER_KEY] = budget.dump({**budget.empty(NOW), "day_credits": 250})
        client = FakeClient(DM)
        report = await self.cycle([self.company()], client)
        self.assertEqual(client.calls, [])
        self.assertIn("giornaliero", report.stopped)

    async def test_reserve_is_never_touched(self):
        client = FakeClient(DM, credits=1550)
        report = await self.cycle([self.company()], client)
        self.assertEqual(client.calls, [])
        self.assertIn("riserva", report.stopped)

    async def test_stops_inside_a_run_when_the_budget_runs_out(self):
        self.state.settings[budget.LEDGER_KEY] = budget.dump({**budget.empty(NOW), "day_credits": 150})
        rows = [self.company("a", domain="a.it", fit=90), self.company("b", domain="b.it", fit=80)]
        client = FakeClient(DecisionMaker("Anna", "Bianchi", "CEO", "anna@a.it", "ceo"))
        report = await self.cycle(rows, client)
        self.assertEqual(len(client.calls), 1)          # la seconda supererebbe il tetto giornaliero (150+100+100 > 300)
        self.assertIn("giornaliero", report.stopped)

    async def test_fatal_errors_halt_until_resumed(self):
        for err in (TermsRequired("https://x"), OutOfCredits(), FirecrawlError("chiave rifiutata", fatal=True)):
            self.state.settings.clear()
            row = self.company()
            client = FakeClient(error=err)
            report = await self.cycle([row], client)
            self.assertTrue(self.state.settings[finder.HALT_KEY], err)
            self.assertEqual(report.outcomes[0].result, "error")
            after = FakeClient(DM)
            report = await self.cycle([row], after)
            self.assertEqual(after.calls, [])            # fermo: nessuna chiamata
            self.assertIn("fermo", report.stopped)
            self.state.settings[finder.HALT_KEY] = ""    # = sellbird firecrawl resume
            await self.cycle([row], after)
            self.assertEqual(len(after.calls), 1)
            self.db.execute("DELETE FROM companies"); self.db.execute("DELETE FROM prospects")

    async def test_transient_errors_do_not_halt(self):
        for err in (FirecrawlError("429", fatal=False), ConnectionError("rete")):
            self.state.settings.clear()
            report = await self.cycle([self.company()], FakeClient(error=err))
            self.assertNotIn(finder.HALT_KEY, self.state.settings)
            self.assertTrue(report.stopped)
            self.assertNotIn("c1", json.loads(self.state.settings.get(finder.TRIED_KEY, "{}")))   # si riprova
            self.db.execute("DELETE FROM companies"); self.db.execute("DELETE FROM prospects")

    async def test_dry_run_calls_and_writes_nothing(self):
        client = FakeClient(DM)
        report = await self.cycle([self.company()], client, dry_run=True)
        self.assertEqual((client.calls, client.credit_calls, self.state.settings, self.state.added), ([], 0, {}, []))
        self.assertEqual(len(report.candidates), 1)

    async def test_blocked_domain_is_not_called(self):
        client = FakeClient(DM)
        report = await self.cycle([self.company()], client, blocked=lambda t: t == "gruppo.it")
        # un dominio «mai contattare» si scarta già alla scelta: non diventa candidata, non occupa un posto, non si chiama
        self.assertEqual((client.calls, report.candidates, report.outcomes), ([], [], []))

    async def test_blocked_email_is_paid_but_never_stored(self):
        report = await self.cycle([self.company()], FakeClient(DM), blocked=lambda t: t == "paolo@gruppo.it")
        self.assertEqual((report.outcomes[0].result, self.state.added), ("skipped", []))
        self.assertEqual(self.state.cancelled, [])       # e la casella generica non si tocca

    async def test_duplicate_email_is_skipped(self):
        self.db.execute("INSERT INTO prospects (id, company_id, email) VALUES ('d','altro','paolo@gruppo.it')")
        report = await self.cycle([self.company()], FakeClient(DM))
        self.assertEqual((report.outcomes[0].result, self.state.added), ("skipped", []))

    async def test_own_verification_can_only_reject(self):
        async def invalid(_): return "invalid"
        async def risky(_): return "risky"
        async def boom(_): raise RuntimeError("verificatore giù")
        report = await self.cycle([self.company()], FakeClient(DM), verify=invalid)
        self.assertEqual((report.outcomes[0].result, self.state.added), ("skipped", []))
        for v in (risky, boom):   # un controllo dubbio o guasto non promuove né boccia: vale il fornitore
            self.state.settings.clear()
            self.db.execute("DELETE FROM companies"); self.db.execute("DELETE FROM prospects")
            report = await self.cycle([self.company()], FakeClient(DM), verify=v)
            self.assertEqual(report.outcomes[0].result, "hit")
            self.assertEqual(self.state.added[-1].email_status, "verified")

    async def test_company_without_any_contact_gets_a_prospect(self):
        row = self.company("n", domain="solo.it", status="Not contacted", generic=False)
        report = await self.cycle([row], FakeClient(DecisionMaker("Luca", "Verdi", "Marketing Manager", "luca@solo.it", "marketing")))
        self.assertEqual(report.outcomes[0].result, "hit")
        self.assertEqual((self.state.added[0].seniority, self.state.cancelled), ("director", []))


class SectorTest(Base):
    """Il punteggio di Sellbird dà i punti del «settore giusto» al termine con cui ha cercato: non basta a distinguere una barca."""

    KW = settings.load({}).keywords

    def test_defaults_are_automotive(self):
        self.assertIn("auto", self.KW)
        self.assertIn("concession", self.KW)

    def test_on_target(self):
        yes = [("Autostore Bergamo", "autostorebergamo.it", ""), ("AutoItalia", "autoitaliaonline.com", ""),
               ("Auto 500", "auto500.it", ""), ("Bramocar Srl", "bramocar.it", "Concessionaria multimarca di auto usate e nuove"),
               ("Gruppo Carmeli", "gruppocarmeli.com", "Concessionaria ufficiale Toyota"), ("G. Villa Monza", "gvilla.com", "Officina e vendita veicoli")]
        no = [("Band of Boats", "bandofboats.com", "Noleggio barche"), ("Rimor IT", "rimor.it", "Camper e caravan"),
              ("Inside Project", "insideproject.it", "Sviluppo software e consulenza")]
        for n, d, desc in yes:
            self.assertTrue(finder.on_target(n, d, desc, self.KW), n)
        for n, d, desc in no:
            self.assertFalse(finder.on_target(n, d, desc, self.KW), n)

    def test_off_means_off(self):
        self.assertTrue(finder.on_target("Band of Boats", "bandofboats.com", "", ()))
        self.assertEqual(settings.load({"FIRECRAWL_ENRICH_KEYWORDS": "*"}).keywords, ())

    async def test_selection_leaves_off_target_out_and_says_why(self):
        rows = [self.company("a", "autostorebergamo.it", "Autostore Bergamo"), self.company("b", "bandofboats.com", "Band of Boats"),
                self.company("c", "rimor.it", "Rimor IT"), self.company("d", "insideproject.it", "Inside Project")]
        skips = {}
        got = await finder.select_candidates(self.query_db, rows, {}, min_fit=50, limit=10, keywords=self.KW, skips=skips)
        self.assertEqual([c.domain for c in got], ["autostorebergamo.it"])
        self.assertEqual(sorted(skips), ["bandofboats.com", "insideproject.it", "rimor.it"])
        self.assertIn("settore", skips["rimor.it"])

    async def test_description_counts(self):
        rows = [self.company("x", "esempio.it", "Esempio Srl", description="Concessionaria di auto usate")]
        got = await finder.select_candidates(self.query_db, rows, {}, min_fit=50, limit=10, keywords=self.KW)
        self.assertEqual(len(got), 1)

    async def test_manual_exclusions_cover_subdomains_and_www(self):
        s = settings.load({"FIRECRAWL_ENRICH_EXCLUDE_DOMAINS": "WWW.Rimor.it, bandofboats.com "})
        self.assertEqual(s.exclude, frozenset({"rimor.it", "bandofboats.com"}))
        rows = [self.company("a", "rimor.it", "Auto Rimor"), self.company("b", "shop.rimor.it", "Auto Rimor Shop"), self.company("c", "bandofboats.com", "Auto Boats"),
                self.company("d", "buonauto.it", "Buonauto")]
        skips = {}
        got = await finder.select_candidates(self.query_db, rows, {}, min_fit=50, limit=10, exclude=s.exclude, skips=skips)
        self.assertEqual([c.domain for c in got], ["buonauto.it"])
        self.assertEqual(len(skips), 3)

    async def test_blocked_companies_do_not_take_a_slot(self):
        rows = [self.company("a", "bloccata.it", "Auto Bloccata", fit=95), self.company("b", "uno.it", "Auto Uno", fit=80), self.company("c", "due.it", "Auto Due", fit=70)]
        got = await finder.select_candidates(self.query_db, rows, {}, min_fit=50, limit=2, blocked=lambda d: d == "bloccata.it")
        self.assertEqual([c.domain for c in got], ["uno.it", "due.it"])   # il limite si riempie con aziende vere

    async def test_a_run_with_the_default_filter_never_calls_for_off_target(self):
        s = settings.load({})
        rows = [self.company("b", "bandofboats.com", "Band of Boats"), self.company("a", "autostore.it", "Autostore")]
        client = FakeClient(None)
        await self.cycle(rows, client, settings=s)
        self.assertEqual([c[0] for c in client.calls], ["autostore.it"])


if __name__ == "__main__":
    unittest.main()
