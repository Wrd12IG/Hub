"""Prova del ponte su un database costruito come quello di Sellbird, con dati inventati.

    python3 -m unittest scripts/sellbird-bridge/test_bridge.py   (dalla radice della hub)
"""
import importlib.util
import json
import os
import sqlite3
import tempfile
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


class CommandTest(unittest.TestCase):
    def run_cmd(self, cmd):
        calls = []

        def fake_run(args, **kw):
            calls.append(args)
            return mock.Mock(returncode=0, stdout="", stderr="")

        with mock.patch.dict(os.environ, {"SELLBIRD_CMD": "python -m sellbird"}), mock.patch.object(bridge.subprocess, "run", fake_run):
            return bridge.apply_command("/tmp", cmd), calls

    def test_approve_reject(self):
        (ok, _), calls = self.run_cmd({"action": "approve", "outboxId": "abcd1234"})
        self.assertTrue(ok)
        self.assertEqual(calls[0], ["python", "-m", "sellbird", "outbox", "--approve", "abcd1234"])
        (ok, _), calls = self.run_cmd({"action": "reject", "outboxId": "abcd1234"})
        self.assertEqual(calls[0][-2:], ["--reject", "abcd1234"])

    def test_pause_resume(self):
        (ok, _), calls = self.run_cmd({"action": "pause_sending", "outboxId": None})
        self.assertTrue(ok)
        self.assertEqual(calls[0], ["python", "-m", "sellbird", "sending", "pause"])
        (ok, _), calls = self.run_cmd({"action": "resume_sending"})
        self.assertEqual(calls[0][-2:], ["sending", "resume"])

    def test_rejects_anything_else(self):
        for cmd in ({"action": "approve", "outboxId": "../x"}, {"action": "approve"}, {"action": "rm -rf"},
                    {"action": "approve", "outboxId": "abcd1234; ls"}, {}):
            (ok, err), calls = self.run_cmd(cmd)
            self.assertFalse(ok, cmd)
            self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
