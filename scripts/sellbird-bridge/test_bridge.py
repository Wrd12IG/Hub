"""Prova del ponte su un database costruito come quello di Sellbird, con dati inventati.

    python3 -m unittest scripts/sellbird-bridge/test_bridge.py   (dalla radice della hub)
"""
import importlib.util
import json
import os
import sqlite3
import tempfile
import time
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location("bridge", os.path.join(os.path.dirname(__file__), "bridge.py"))
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

SCHEMA = """
CREATE TABLE companies (id TEXT PRIMARY KEY, name TEXT, domain TEXT, location TEXT, updated_at TEXT);
CREATE TABLE prospects (id TEXT PRIMARY KEY, company_id TEXT, first_name TEXT, last_name TEXT, email TEXT, company TEXT, status TEXT,
                        title TEXT DEFAULT '', email_status TEXT DEFAULT '', score INTEGER DEFAULT 0, updated_at TEXT DEFAULT '');
CREATE TABLE outbox (id TEXT PRIMARY KEY, prospect_id TEXT, campaign_id TEXT DEFAULT '', step INTEGER, kind TEXT, to_email TEXT, subject TEXT, body TEXT,
                     status TEXT, send_at TEXT, sent_at TEXT, error TEXT, updated_at TEXT);
CREATE TABLE conversations (id TEXT PRIMARY KEY, prospect_id TEXT, campaign_id TEXT DEFAULT '', thread_json TEXT, intent TEXT, stage TEXT, status TEXT, updated_at TEXT);
CREATE TABLE usage_events (id TEXT PRIMARY KEY, created_at TEXT DEFAULT CURRENT_TIMESTAMP, agent TEXT, input_tokens INTEGER,
                           output_tokens INTEGER, is_error INTEGER);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE campaigns (id TEXT PRIMARY KEY, name TEXT, channel TEXT, status TEXT, sequence_json TEXT, prospect_ids_json TEXT, created_at TEXT);
CREATE TABLE signal_codes (code TEXT PRIMARY KEY, label TEXT, description TEXT, category TEXT, cost_note TEXT, status TEXT);
CREATE TABLE observations (id TEXT PRIMARY KEY, company_id TEXT DEFAULT '', signal_code TEXT);
"""


def make_db(path, paused=""):
    con = sqlite3.connect(path)
    con.executescript(SCHEMA)
    con.execute("INSERT INTO companies VALUES ('c1', 'Autosalone Esempio', 'esempio.example.com', 'Milano', '2026-11-18')")
    con.execute("INSERT INTO prospects (id, company_id, first_name, last_name, email, company, status, title, email_status, score) VALUES ('p1', 'c1', 'Mario', 'Rossi', 'info@esempio.example.com', 'Autosalone Esempio', 'replied', 'Titolare', 'verified', 80)")
    con.execute("INSERT INTO prospects (id, company_id, first_name, last_name, email, company, status) VALUES ('p2', 'c1', '', '', 'vendite@esempio.example.com', '', 'new')")
    con.execute("INSERT INTO outbox VALUES ('o1', 'p1', 'k1', 1, 'sequence', 'info@esempio.example.com', 'Oggetto', 'Testo', 'sent', NULL, '2026-11-18T10:00:00', NULL, '2026-11-18T10:00:00')")
    con.execute("INSERT INTO outbox VALUES ('o2', 'p2', 'k1', 1, 'sequence', 'vendite@esempio.example.com', 'Altro', 'Testo', 'pending_review', NULL, NULL, NULL, '2026-11-18T11:00:00')")
    thread = [{"sender": "sellbird", "content": "Buongiorno", "timestamp": "2026-11-18T10:00:00"},
              {"sender": "prospect", "content": "Mi interessa", "timestamp": "2026-11-18T12:00:00"}]
    con.execute("INSERT INTO conversations VALUES ('v1', 'p1', 'k1', ?, 'interested', 'engaged', 'open', '2026-11-18T12:00:00')", (json.dumps(thread),))
    # una conversazione in cui il destinatario non ha risposto: non è una risposta
    con.execute("INSERT INTO conversations VALUES ('v2', 'p2', 'k1', ?, '', 'initial_outreach', 'open', '2026-11-18T11:00:00')", (json.dumps(thread[:1]),))
    con.execute("INSERT INTO usage_events (id, agent, input_tokens, output_tokens, is_error) VALUES ('u1', 'writer', 100, 50, 0)")
    con.execute("INSERT INTO usage_events (id, agent, input_tokens, output_tokens, is_error) VALUES ('u2', 'writer', 10, 5, 1)")
    con.execute("INSERT INTO campaigns VALUES ('k1', 'Concessionari Milano', 'email', 'active', ?, ?, '2026-11-17')", (json.dumps([{}, {}, {}]), json.dumps(['p1', 'p2'])))
    con.execute("INSERT INTO signal_codes VALUES ('SERP_RANK', 'Posizione su Google', 'Dove compare per la ricerca', 'visibilita', 'costa', 'proposed')")
    con.execute("INSERT INTO signal_codes VALUES ('HAS_BOOKING', 'Prenotazione online', 'Ha un modulo di prenotazione', 'sito', '', 'confirmed')")
    con.execute("INSERT INTO observations VALUES ('ob1', 'c1', 'HAS_BOOKING')")
    con.execute("INSERT INTO observations VALUES ('ob2', 'c1', 'HAS_BOOKING')")
    if paused:
        con.execute("INSERT INTO settings VALUES ('sending_paused', ?)", (paused,))
    con.commit()
    con.close()


class SnapshotTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.db = os.path.join(self.dir.name, "sellbird.db")

    def tearDown(self):
        self.dir.cleanup()

    def test_snapshot(self):
        make_db(self.db)
        s = bridge.snapshot(self.db)
        self.assertEqual({o["id"]: o["status"] for o in s["outbox"]}, {"o1": "sent", "o2": "pending_review"})
        self.assertEqual(len(s["replies"]), 1)
        reply = s["replies"][0]
        self.assertEqual((reply["id"], reply["intent"], reply["company"], reply["contact"]), ("v1", "interested", "Autosalone Esempio", "Mario Rossi"))
        self.assertEqual([m["from"] for m in reply["messages"]], ["us", "them"])
        st = s["stats"]
        self.assertEqual((st["companies"], st["emailsSent"], st["conversations"]), (1, 1, 1))
        self.assertEqual(st["prospects"], {"replied": 1, "new": 1})
        self.assertEqual(st["intents"], {"interested": 1})
        self.assertEqual((st["usage"]["calls7d"], st["usage"]["errors7d"], st["usage"]["inputTokens7d"]), (2, 1, 110))
        self.assertEqual(st["usage"]["byAgent"], {"writer": 2})
        self.assertIsNone(s["sendingPaused"])

    def test_contacts_campaigns_signals(self):
        make_db(self.db)
        s = bridge.snapshot(self.db)
        by_id = {c["id"]: c for c in s["contacts"]}
        self.assertEqual([c["id"] for c in s["contacts"]], ["p1", "p2"])  # per punteggio decrescente
        self.assertEqual((by_id["p1"]["name"], by_id["p1"]["title"], by_id["p1"]["emailStatus"], by_id["p1"]["score"]), ("Mario Rossi", "Titolare", "verified", 80))
        k = s["campaigns"][0]
        self.assertEqual((k["name"], k["steps"], k["prospects"], k["sent"], k["queued"], k["replies"]), ("Concessionari Milano", 3, 2, 1, 1, 1))
        sig = {x["code"]: x for x in s["signals"]}
        self.assertEqual(sig["HAS_BOOKING"]["companies"], 1)  # due osservazioni, ma stessa azienda
        self.assertEqual((sig["SERP_RANK"]["status"], sig["SERP_RANK"]["companies"]), ("proposed", 0))
        self.assertEqual(s["outboxCounts"], {"sent": 1, "pending_review": 1})

    def test_paused(self):
        make_db(self.db, paused="paused manually")
        self.assertEqual(bridge.snapshot(self.db)["sendingPaused"], "paused manually")

    def test_missing_optional_tables(self):
        make_db(self.db)
        con = sqlite3.connect(self.db)
        con.execute("DROP TABLE usage_events")
        con.execute("DROP TABLE settings")
        con.commit()
        con.close()
        s = bridge.snapshot(self.db)
        self.assertEqual(s["stats"]["usage"], {})
        self.assertIsNone(s["sendingPaused"])

    def test_snapshot_cannot_write(self):
        make_db(self.db)
        con = sqlite3.connect(self.db)
        con.execute("PRAGMA query_only = ON")
        with self.assertRaises(sqlite3.OperationalError):
            con.execute("DELETE FROM outbox")
        con.close()


try:
    import yaml
except ImportError:  # sul Mac di sviluppo PyYAML può mancare; nel contenitore di Sellbird c'è
    yaml = None

CONFIG = """persona:
  name: Roberto Solano
compliance:
  postal_address: |-
    Roberto Solano
    WRDigital S.R.L.
  opt_out_line: Non ti interessa? Scrivimi.
  precleared:
    sender_country: IT
channels:
  email:
    provider: gmail
"""


@unittest.skipUnless(yaml, "serve PyYAML")
class ExclusionTest(unittest.TestCase):
    """«Escludi» dalla hub: modifica sicura del file di configurazione e bozze rifiutate."""

    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        os.makedirs(os.path.join(self.dir.name, "data"))
        self.db = os.path.join(self.dir.name, "data", "sellbird.db")
        make_db(self.db)
        con = sqlite3.connect(self.db)
        con.execute("INSERT INTO companies VALUES ('c2', 'Altra', 'altro.example.org', 'Roma', '2026-11-18')")
        con.execute("INSERT INTO prospects (id, company_id, email, status) VALUES ('p3', 'c2', 'info@altro.example.org', 'new')")
        con.execute("INSERT INTO outbox VALUES ('o3', 'p3', 'k1', 1, 'sequence', 'info@altro.example.org', 'S', 'B', 'pending_review', NULL, NULL, NULL, '2026-11-18')")
        con.execute("INSERT INTO outbox VALUES ('o4', 'p1', 'k1', 2, 'sequence', 'info@esempio.example.com', 'S', 'B', 'approved', NULL, NULL, NULL, '2026-11-18')")
        con.execute("UPDATE outbox SET id = 'ob-' || id")   # gli id veri di Sellbird sono lunghi (12 caratteri): il ponte scarta quelli corti
        con.commit()
        con.close()
        self.cfg = os.path.join(self.dir.name, "sellbird.local.yaml")
        self.write(CONFIG)
        self.calls = []

    def tearDown(self):
        self.dir.cleanup()

    def write(self, text):
        with open(self.cfg, "w", encoding="utf-8") as f:
            f.write(text)

    def load(self):
        with open(self.cfg, encoding="utf-8") as f:
            return yaml.safe_load(f)

    def run_cmd(self, cmd, ok=True):
        def fake(args, **kw):
            self.calls.append(args)
            return mock.Mock(returncode=0 if ok else 1, stdout="", stderr="")

        with mock.patch.dict(os.environ, {"SELLBIRD_CMD": "python -m sellbird"}), mock.patch.object(bridge.subprocess, "run", fake):
            return bridge.apply_command(self.dir.name, cmd)

    def test_add_edits_only_the_list_and_keeps_a_backup(self):
        before = self.load()
        ok, err, extra = self.run_cmd({"action": "dnc_add", "domain": "esempio.example.com"})
        self.assertTrue(ok, err)
        after = self.load()
        self.assertEqual(after["compliance"]["do_not_contact"], ["esempio.example.com"])
        after["compliance"].pop("do_not_contact")
        self.assertEqual(after, before)                                    # tutto il resto, comprese le righe multiple, intatto
        self.assertEqual(self.load()["compliance"]["postal_address"], "Roberto Solano\nWRDigital S.R.L.")
        with open(self.cfg + ".bak-dnc", encoding="utf-8") as f:
            self.assertEqual(f.read(), CONFIG)                              # la copia è il file di prima
        self.assertFalse(os.path.exists(self.cfg + ".tmp"))                # nessun file temporaneo rimasto
        self.assertIn("aggiunto", extra["result"])

    def test_add_rejects_only_the_drafts_of_that_domain(self):
        ok, err, extra = self.run_cmd({"action": "dnc_add", "domain": "esempio.example.com"})
        rejected = sorted(c[-1] for c in self.calls)
        self.assertEqual(rejected, ["ob-o2", "ob-o4"])                      # da rivedere e approvata di quell'azienda, non ob-o3 di un'altra
        self.assertTrue(all(c[-3:-1] == ["outbox", "--reject"] for c in self.calls))
        self.assertIn("Bozze rifiutate: 2", extra["result"])

    def test_subdomains_are_covered(self):
        con = sqlite3.connect(self.db)
        con.execute("INSERT INTO companies VALUES ('c3', 'Shop', 'shop.altro.example.org', 'Roma', 'x')")
        con.execute("INSERT INTO prospects (id, company_id, email) VALUES ('p4', 'c3', 'a@shop.altro.example.org')")
        con.execute("INSERT INTO outbox VALUES ('ob-o5', 'p4', 'k1', 1, 'sequence', 'a@shop.altro.example.org', 'S', 'B', 'pending_review', NULL, NULL, NULL, 'x')")
        con.commit()
        con.close()
        self.run_cmd({"action": "dnc_add", "domain": "altro.example.org"})
        self.assertEqual(sorted(c[-1] for c in self.calls), ["ob-o3", "ob-o5"])   # il dominio e il suo sottodominio

    def test_add_twice_does_not_duplicate(self):
        self.run_cmd({"action": "dnc_add", "domain": "esempio.example.com"})
        ok, err, extra = self.run_cmd({"action": "dnc_add", "domain": "esempio.example.com"})
        self.assertTrue(ok)
        self.assertEqual(self.load()["compliance"]["do_not_contact"], ["esempio.example.com"])
        self.assertIn("già in lista", extra["result"])

    def test_remove(self):
        self.run_cmd({"action": "dnc_add", "domain": "esempio.example.com"})
        self.run_cmd({"action": "dnc_add", "domain": "altro.example.org"})
        self.calls.clear()
        ok, err, extra = self.run_cmd({"action": "dnc_remove", "domain": "esempio.example.com"})
        self.assertTrue(ok, err)
        self.assertEqual(self.load()["compliance"]["do_not_contact"], ["altro.example.org"])
        self.assertEqual(self.calls, [])                                    # togliere non rifiuta né invia nulla
        ok, err, _ = self.run_cmd({"action": "dnc_remove", "domain": "mai-stata.example.com"})
        self.assertFalse(ok)

    def test_bad_domains_never_touch_the_file(self):
        for domain in ("ESEMPIO.example.com", "http://esempio.it", "a b.it", "../x", "*.it", "x", "esempio.it/", "localhost", "", None, 5,
                       "esempio.example.com; ls", "a@b.it", "x" * 120 + ".it"):
            ok, _, _ = self.run_cmd({"action": "dnc_add", "domain": domain})
            self.assertFalse(ok, domain)
        self.assertEqual(self.calls, [])
        with open(self.cfg, encoding="utf-8") as f:
            self.assertEqual(f.read(), CONFIG)
        self.assertFalse(os.path.exists(self.cfg + ".bak-dnc"))             # niente è cambiato, nessuna copia

    def test_failed_verification_restores_the_file(self):
        with mock.patch.object(bridge, "config_dnc", return_value=[]):
            ok, why = bridge.edit_dnc(self.dir.name, "esempio.example.com", True)
        self.assertFalse(ok)
        self.assertIn("ripristinato", why)
        with open(self.cfg, encoding="utf-8") as f:
            self.assertEqual(f.read(), CONFIG)

    def test_unreadable_config_is_a_clean_error(self):
        self.write("compliance: [questo: non: è: yaml")
        ok, why = bridge.edit_dnc(self.dir.name, "esempio.example.com", True)
        self.assertFalse(ok)
        self.assertEqual(open(self.cfg, encoding="utf-8").read(), "compliance: [questo: non: è: yaml")
        self.assertFalse(bridge.edit_dnc("/non/esiste", "esempio.example.com", True)[0])

    def test_falls_back_to_the_base_config_file(self):
        base = os.path.join(self.dir.name, "sellbird.yaml")
        os.replace(self.cfg, base)
        ok, err, _ = self.run_cmd({"action": "dnc_add", "domain": "esempio.example.com"})
        self.assertTrue(ok, err)
        self.assertIn("esempio.example.com", yaml.safe_load(open(base, encoding="utf-8"))["compliance"]["do_not_contact"])

    def test_snapshot_flags_companies_and_lists_domains(self):
        con = sqlite3.connect(self.db)
        for cid, dom in (("c5", "rimor.it"), ("c6", "shop.rimor.it"), ("c7", "notrimor.it")):
            con.execute("INSERT INTO companies VALUES (?, ?, ?, '', 'x')", (cid, cid, dom))
        con.commit()
        con.close()
        self.write(CONFIG.replace("compliance:\n", "compliance:\n  do_not_contact:\n  - rimor.it\n  - mario@altro.it\n  - https://WWW.Maiuscolo.IT/pagina\n  - non un dominio\n"))
        snap = bridge.snapshot(self.db, self.dir.name)
        flags = {c["domain"]: c["excluded"] for c in snap["companies"]}
        self.assertEqual((flags["rimor.it"], flags["shop.rimor.it"], flags["notrimor.it"], flags["esempio.example.com"]), (True, True, False, False))
        self.assertEqual(snap["exclusions"], ["rimor.it", "maiuscolo.it"])  # normalizzate come fa Sellbird; niente indirizzi singoli né voci non valide

    def test_domain_excluded(self):
        self.assertTrue(bridge.domain_excluded("www.rimor.it", ["rimor.it"]))
        self.assertTrue(bridge.domain_excluded("shop.rimor.it", ["rimor.it"]))
        self.assertFalse(bridge.domain_excluded("notrimor.it", ["rimor.it"]))
        self.assertFalse(bridge.domain_excluded("rimor.it", ["mario@rimor.it"]))   # un indirizzo non esclude il dominio
        self.assertFalse(bridge.domain_excluded("", ["rimor.it"]))


class DeltaTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.db = os.path.join(self.dir.name, "sellbird.db")
        make_db(self.db)

    def tearDown(self):
        self.dir.cleanup()

    def test_first_run_sends_everything_then_only_changes(self):
        snap = bridge.snapshot(self.db)
        payload, state = bridge.to_delta(snap, {})
        self.assertEqual(len(payload["outbox"]), 2)  # primo giro: tutto
        payload, state = bridge.to_delta(snap, state)
        self.assertEqual([len(payload[k]) for k in bridge.DELTA_LISTS], [0, 0, 0, 0])  # nulla è cambiato
        self.assertEqual(payload["outboxCounts"], {"sent": 1, "pending_review": 1})  # i contatori viaggiano sempre
        self.assertEqual(len(payload["signals"]), 2)  # campagne e segnali, poche righe, viaggiano sempre

        con = sqlite3.connect(self.db)
        con.execute("UPDATE outbox SET status = 'approved' WHERE id = 'o2'")
        con.commit()
        con.close()
        payload, state = bridge.to_delta(bridge.snapshot(self.db), state)
        self.assertEqual([o["id"] for o in payload["outbox"]], ["o2"])  # solo la riga cambiata
        self.assertEqual(payload["contacts"], [])

    def test_full_resend_every_n_runs(self):
        snap = bridge.snapshot(self.db)
        state = {}
        sizes = []
        for _ in range(bridge.FULL_EVERY + 1):
            payload, state = bridge.to_delta(snap, state)
            sizes.append(len(payload["outbox"]))
        self.assertEqual(sizes[0], 2)
        self.assertEqual(set(sizes[1:bridge.FULL_EVERY]), {0})
        self.assertEqual(sizes[bridge.FULL_EVERY], 2)  # un giro completo ogni FULL_EVERY

    def test_state_file_roundtrip_and_corruption(self):
        path = os.path.join(self.dir.name, "state.json")
        self.assertEqual(bridge.load_state(path), {})  # file assente
        bridge.save_state(path, {"runs": 3, "hashes": {}})
        self.assertEqual(bridge.load_state(path)["runs"], 3)
        with open(path, "w") as f:
            f.write("{non json")
        self.assertEqual(bridge.load_state(path), {})  # file rovinato: si riparte, mandando tutto


class ActionTest(unittest.TestCase):
    """Discover e segnali dalla hub: liste fisse, tetto di spesa, solo segnali gratuiti, risultato riportato."""

    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        os.makedirs(os.path.join(self.dir.name, "data"))
        make_db(os.path.join(self.dir.name, "data", "sellbird.db"))
        con = sqlite3.connect(os.path.join(self.dir.name, "data", "sellbird.db"))
        con.execute("INSERT INTO signal_codes VALUES ('FREE_ONE', 'Gratis', '', 'sito', 'free: legge la home', 'proposed')")
        con.execute("INSERT INTO signal_codes VALUES ('TRICKY', 'Quasi gratis', '', 'sito', '1 credit (free tiers available)', 'proposed')")
        con.commit()
        con.close()
        self.env = mock.patch.dict(os.environ, {"SELLBIRD_CMD": "python -m sellbird"})
        self.cities = mock.patch.object(bridge, "config_cities", return_value=["Milano", "Monza"])
        # La presenza dell'opzione --industry si chiede a Sellbird: nei test si decide qui, senza lanciare nulla.
        self.option = mock.patch.object(bridge, "supports_industry", return_value=True)
        self.env.start()
        self.cities.start()
        self.option.start()
        self.calls = []

    def tearDown(self):
        self.env.stop()
        self.cities.stop()
        self.option.stop()
        self.dir.cleanup()

    def run_cmd(self, cmd, stdout="", returncode=0):
        def fake_run(args, **kw):
            self.calls.append((args, kw.get("timeout")))
            return mock.Mock(returncode=returncode, stdout=stdout, stderr="")

        with mock.patch.object(bridge.subprocess, "run", fake_run):
            return bridge.apply_command(self.dir.name, cmd)

    def test_estimate_reads_the_cost(self):
        ok, err, extra = self.run_cmd({"action": "discover_estimate", "provider": "serper", "cities": ["Milano", "Monza"]},
                                      stdout="  2 queries via Serper\n\n  Estimated cost: $0.0120   (cap: $2.00)\n")
        self.assertTrue(ok, err)
        self.assertEqual(extra["estimatedCost"], 0.012)
        args = self.calls[0][0]
        self.assertEqual(args[:5], ["python", "-m", "sellbird", "discover", "--provider"])
        self.assertIn("--estimate", args)
        self.assertEqual(args[args.index("--city") + 1], "Milano;Monza")
        self.assertEqual(args[args.index("--max-spend") + 1], "2.00")  # il tetto del ponte, non un valore della hub

    def test_estimate_without_a_readable_cost_fails(self):
        ok, err, _ = self.run_cmd({"action": "discover_estimate", "provider": "osm", "cities": []}, stdout="boh")
        self.assertFalse(ok)

    def test_run_respects_the_cap(self):
        ok, err, extra = self.run_cmd({"action": "discover_run", "provider": "serper", "cities": ["Milano"], "maxSpend": 0.5}, stdout="DISCOVER, 12 results")
        self.assertTrue(ok, err)
        args, timeout = self.calls[0]
        self.assertEqual(args[args.index("--max-spend") + 1], "0.50")
        self.assertNotIn("--estimate", args)
        self.assertEqual(extra["result"], "DISCOVER, 12 results")
        self.assertGreater(timeout, 300)  # una ricerca vera può durare minuti
        for spend in (2.5, 0, -1, None, "x"):
            self.calls.clear()
            ok, _, _ = self.run_cmd({"action": "discover_run", "provider": "serper", "cities": [], "maxSpend": spend})
            self.assertFalse(ok, spend)
            self.assertEqual(self.calls, [], spend)  # fuori limite: nemmeno lanciato

    def test_cap_can_be_lowered_or_switched_off_by_env(self):
        with mock.patch.dict(os.environ, {"OUTREACH_MAX_DISCOVER_SPEND": "0.30"}):
            ok, _, _ = self.run_cmd({"action": "discover_run", "provider": "serper", "cities": [], "maxSpend": 0.5})
            self.assertFalse(ok)
        with mock.patch.dict(os.environ, {"OUTREACH_MAX_DISCOVER_SPEND": "9"}):
            self.assertEqual(bridge.discover_cap(), 2.0)  # mai oltre il massimo
        with mock.patch.dict(os.environ, {"OUTREACH_MAX_DISCOVER_SPEND": "0"}):
            ok, err, _ = self.run_cmd({"action": "discover_estimate", "provider": "osm", "cities": []})
            self.assertFalse(ok)
            self.assertEqual(self.calls, [])

    def test_accepts_places_beyond_the_profile(self):
        # regioni e comuni d'Italia, nel formato «Comune, SIGLA»: li sceglie la hub dall'elenco ISTAT
        ok, err, _ = self.run_cmd({"action": "discover_estimate", "provider": "serper", "cities": ["Lombardia", "Roma, RM", "Sant'Angelo, LO", "Bolzano, BZ"]},
                                  stdout="Estimated cost: $0.10")
        self.assertTrue(ok, err)
        self.assertEqual(self.calls[0][0][self.calls[0][0].index("--city") + 1], "Lombardia;Roma, RM;Sant'Angelo, LO;Bolzano, BZ")

    def test_rejects_unknown_provider_and_malformed_places(self):
        for cmd in ({"action": "discover_estimate", "provider": "dataforseo_serp", "cities": []},
                    {"action": "discover_estimate", "provider": "serper", "cities": ["Milano; rm -rf /"]},  # ';' separa le città
                    {"action": "discover_estimate", "provider": "serper", "cities": ["$(ls)"]},
                    {"action": "discover_estimate", "provider": "serper", "cities": ["a`b`"]},
                    {"action": "discover_estimate", "provider": "serper", "cities": ["M"]},
                    {"action": "discover_estimate", "provider": "serper", "cities": ["x" * 81]},
                    {"action": "discover_estimate", "provider": "serper", "cities": "Milano"},
                    {"action": "discover_estimate", "provider": "serper", "cities": [5]},
                    {"action": "discover_estimate", "provider": "serper", "cities": ["Milano"] * 11}):
            ok, _, _ = self.run_cmd(cmd)
            self.assertFalse(ok, cmd)
        self.assertEqual(self.calls, [])

    def test_signals_only_free(self):
        ok, err, extra = self.run_cmd({"action": "signals_set", "codes": ["FREE_ONE"], "signalStatus": "confirmed"}, stdout="1 signal(s) confirmed.")
        self.assertTrue(ok, err)
        self.assertEqual(self.calls[0][0][-3:], ["signals", "--confirm", "FREE_ONE"])
        self.calls.clear()
        ok, _, _ = self.run_cmd({"action": "signals_set", "codes": ["FREE_ONE"], "signalStatus": "rejected"})
        self.assertEqual(self.calls[0][0][-3:], ["signals", "--reject", "FREE_ONE"])
        self.calls.clear()
        for codes in (["TRICKY"], ["FREE_ONE", "TRICKY"], ["NON_ESISTE"], ["free"], ["FREE_ONE; ls"], [], "FREE_ONE"):
            ok, _, _ = self.run_cmd({"action": "signals_set", "codes": codes, "signalStatus": "confirmed"})
            self.assertFalse(ok, codes)
        ok, _, _ = self.run_cmd({"action": "signals_set", "codes": ["FREE_ONE"], "signalStatus": "boh"})
        self.assertFalse(ok)
        self.assertEqual(self.calls, [])  # nessuno dei rifiutati è arrivato a Sellbird

    def test_industries_are_passed_as_an_option(self):
        ok, err, _ = self.run_cmd({"action": "discover_estimate", "provider": "serper", "cities": ["Milano"], "industries": ["Officina meccanica", "Carrozzeria"]},
                                  stdout="Estimated cost: $0.20")
        self.assertTrue(ok, err)
        args = self.calls[0][0]
        self.assertEqual(args[args.index("--industry") + 1], "Officina meccanica;Carrozzeria")
        self.calls.clear()
        # senza settori scelti non si passa nulla: valgono quelli del profilo, come prima
        self.run_cmd({"action": "discover_estimate", "provider": "serper", "cities": [], "industries": []}, stdout="Estimated cost: $0.20")
        self.assertNotIn("--industry", self.calls[0][0])

    def test_rejects_malformed_industries(self):
        for industries in (["Officina; rm -rf /"], ["$(ls)"], ["x"], ["a" * 81], "Officina", [5], ["Officina"] * 6):
            ok, _, _ = self.run_cmd({"action": "discover_run", "provider": "serper", "cities": [], "industries": industries, "maxSpend": 1})
            self.assertFalse(ok, industries)
        self.assertEqual(self.calls, [])

    def test_clear_error_when_sellbird_lacks_the_option(self):
        with mock.patch.object(bridge, "supports_industry", return_value=False):
            ok, err, _ = self.run_cmd({"action": "discover_estimate", "provider": "serper", "cities": [], "industries": ["Carrozzeria"]})
        self.assertFalse(ok)
        self.assertIn("--industry", err)
        self.assertEqual(self.calls, [])  # nemmeno lanciato
        with mock.patch.object(bridge, "supports_industry", return_value=False):
            ok, _, _ = self.run_cmd({"action": "discover_estimate", "provider": "serper", "cities": [], "industries": []}, stdout="Estimated cost: $0.10")
        self.assertTrue(ok)  # senza settori la ricerca funziona anche con Sellbird originale

    def test_failure_returns_the_text(self):
        ok, err, extra = self.run_cmd({"action": "discover_run", "provider": "serper", "cities": [], "maxSpend": 1}, stdout="ERROR: missing key", returncode=1)
        self.assertFalse(ok)
        self.assertIn("ERROR", extra["result"])

    def test_snapshot_declares_what_discover_can_do(self):
        info = bridge.snapshot(os.path.join(self.dir.name, "data", "sellbird.db"), self.dir.name)["discover"]
        self.assertEqual((info["providers"], info["cities"], info["cap"]), (["osm", "serper"], ["Milano", "Monza"], 2.0))
        self.assertTrue(info["industryOption"])
        self.assertIsInstance(info["industries"], list)


class IndustryOptionTest(unittest.TestCase):
    """Rilevamento dell'opzione --industry: si chiede a Sellbird (`discover --help`) e si ricorda per 10 minuti."""

    def setUp(self):
        bridge._INDUSTRY_OPTION.clear()
        self.env = mock.patch.dict(os.environ, {"SELLBIRD_CMD": "python -m sellbird"})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        bridge._INDUSTRY_OPTION.clear()

    def fake(self, stdout):
        calls = []

        def run(args, **kw):
            calls.append(args)
            return mock.Mock(returncode=0, stdout=stdout, stderr="")

        return calls, mock.patch.object(bridge.subprocess, "run", run)

    def test_detects_the_option(self):
        calls, patch = self.fake("usage: sellbird discover [--city CITY] [--industry INDUSTRY]")
        with patch:
            self.assertTrue(bridge.supports_industry("/x"))
            self.assertTrue(bridge.supports_industry("/x"))
        self.assertEqual(len(calls), 1)  # la seconda volta è ricordata
        self.assertEqual(calls[0][-2:], ["discover", "--help"])

    def test_detects_its_absence(self):
        calls, patch = self.fake("usage: sellbird discover [--city CITY] [--depth DEPTH]")
        with patch:
            self.assertFalse(bridge.supports_industry("/x"))
        self.assertFalse(bridge.supports_industry(None))

    def test_expired_memory_asks_again(self):
        calls, patch = self.fake("--industry")
        with patch:
            bridge.supports_industry("/x")
            bridge._INDUSTRY_OPTION["/x"] = (time.time() - 700, True)
            bridge.supports_industry("/x")
        self.assertEqual(len(calls), 2)


class CommandTest(unittest.TestCase):
    def run_cmd(self, cmd):
        calls = []

        def fake_run(args, **kw):
            calls.append(args)
            return mock.Mock(returncode=0, stdout="", stderr="")

        with mock.patch.dict(os.environ, {"SELLBIRD_CMD": "python -m sellbird"}), mock.patch.object(bridge.subprocess, "run", fake_run):
            return bridge.apply_command("/tmp", cmd), calls

    def test_approve_reject(self):
        (ok, _, _extra), calls = self.run_cmd({"action": "approve", "outboxId": "abcd1234"})
        self.assertTrue(ok)
        self.assertEqual(calls[0], ["python", "-m", "sellbird", "outbox", "--approve", "abcd1234"])
        (ok, _, _extra), calls = self.run_cmd({"action": "reject", "outboxId": "abcd1234"})
        self.assertEqual(calls[0][-2:], ["--reject", "abcd1234"])

    def test_pause_resume(self):
        (ok, _, _extra), calls = self.run_cmd({"action": "pause_sending", "outboxId": None})
        self.assertTrue(ok)
        self.assertEqual(calls[0], ["python", "-m", "sellbird", "sending", "pause"])
        (ok, _, _extra), calls = self.run_cmd({"action": "resume_sending"})
        self.assertEqual(calls[0][-2:], ["sending", "resume"])

    def test_rejects_anything_else(self):
        for cmd in ({"action": "approve", "outboxId": "../x"}, {"action": "approve"}, {"action": "rm -rf"},
                    {"action": "approve", "outboxId": "abcd1234; ls"}, {}):
            (ok, err, _extra), calls = self.run_cmd(cmd)
            self.assertFalse(ok, cmd)
            self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
