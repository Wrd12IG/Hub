#!/usr/bin/env python3
"""
Ponte tra Sellbird e la hub. Gira sul computer dove gira Sellbird, accanto a lui.

Ogni giro:
  1. ritira dalla hub le decisioni prese da un amministratore (approva / rifiuta una bozza, ferma o riprendi gli invii)
     e le applica con la riga di comando di Sellbird (`sellbird outbox --approve|--reject <id>`,
     `sellbird sending pause|resume`), poi dice alla hub com'è andata;
  2. manda alla hub una fotografia di email in coda, aziende, risposte, contatori e stato della pausa.

Non scrive mai nel database di Sellbird (la sua connessione è in sola lettura): ogni modifica passa dalla sua CLI.
Solo libreria standard, niente da installare.

Variabili d'ambiente:
  SELLBIRD_DIR              cartella di Sellbird (quella con data/sellbird.db e .venv)         [obbligatoria]
  HUB_URL                   indirizzo della hub, es. https://hub.wrdigital.it                  [obbligatoria]
  OUTREACH_BRIDGE_SECRET    lo stesso segreto configurato sulla hub (almeno 32 caratteri)      [obbligatoria]
  BRIDGE_INTERVAL_SECONDS   pausa tra un giro e l'altro, default 120
  SELLBIRD_CMD              come lanciare Sellbird; default <SELLBIRD_DIR>/.venv/bin/sellbird, in Docker "python -m sellbird"

Uso:  python3 bridge.py          # in continuo
      python3 bridge.py --once   # un solo giro (per provare)
"""
import json
import os
import re
import shlex
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request

ID_RE = re.compile(r"^[A-Za-z0-9_-]{4,64}$")
MAX_OUTBOX = 1000
MAX_COMPANIES = 2000
MAX_REPLIES = 500
MAX_THREAD_MESSAGES = 8
SENDING_COMMANDS = {"pause_sending": "pause", "resume_sending": "resume"}

OUTBOX_SQL = """
SELECT o.id, o.status, o.to_email, o.subject, o.body, o.step, o.kind, o.send_at, o.sent_at, o.error, o.updated_at,
       COALESCE(c.name, ''), TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))
FROM outbox o
LEFT JOIN prospects p ON p.id = o.prospect_id
LEFT JOIN companies c ON c.id = p.company_id
ORDER BY (o.status IN ('pending_review', 'approved')) DESC, o.updated_at DESC
LIMIT ?
"""

COMPANIES_SQL = """
SELECT c.id, c.name, c.domain, c.location,
       (SELECT COUNT(*) FROM prospects p WHERE p.company_id = c.id),
       (SELECT COUNT(*) FROM outbox o JOIN prospects p ON p.id = o.prospect_id
         WHERE p.company_id = c.id AND o.status = 'sent'),
       (SELECT COUNT(*) FROM conversations v JOIN prospects p ON p.id = v.prospect_id
         WHERE p.company_id = c.id AND v.stage != 'initial_outreach')
FROM companies c
ORDER BY c.updated_at DESC
LIMIT ?
"""

REPLIES_SQL = """
SELECT v.id, COALESCE(NULLIF(c.name, ''), p.company, ''), TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')),
       COALESCE(p.email, ''), v.intent, v.stage, v.status, v.updated_at, v.thread_json
FROM conversations v
LEFT JOIN prospects p ON p.id = v.prospect_id
LEFT JOIN companies c ON c.id = p.company_id
ORDER BY v.updated_at DESC
LIMIT ?
"""


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def need(name):
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(f"Manca la variabile d'ambiente {name}.")
    return value


def hub_call(base, secret, method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(base + path, data=data, method=method)
    req.add_header("Authorization", f"Bearer {secret}")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path}: HTTP {e.code} {e.read()[:200].decode(errors='replace')}") from None


def sellbird_base(sellbird_dir):
    """Come lanciare Sellbird. Di default l'eseguibile nel .venv; in Docker (dove il .venv non c'è) SELLBIRD_CMD="python -m sellbird"."""
    base = shlex.split(os.environ.get("SELLBIRD_CMD", "")) or [os.path.join(sellbird_dir, ".venv", "bin", "sellbird")]
    if len(base) == 1 and not os.path.exists(base[0]):
        return None, f"sellbird non trovato: {base[0]}"
    return base, None


def apply_command(sellbird_dir, cmd):
    """Applica un comando con la CLI di Sellbird. Ritorna (ok, errore). Solo azioni di una lista fissa, mai testo libero."""
    action = cmd.get("action")
    outbox_id = cmd.get("outboxId")
    if action in ("approve", "reject") and isinstance(outbox_id, str) and ID_RE.match(outbox_id):
        args = ["outbox", f"--{action}", outbox_id]
    elif action in SENDING_COMMANDS:
        args = ["sending", SENDING_COMMANDS[action]]
    else:
        return False, "comando non valido"
    base, err = sellbird_base(sellbird_dir)
    if err:
        return False, err
    try:
        res = subprocess.run([*base, *args], cwd=sellbird_dir, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        return False, "sellbird non ha risposto in tempo"
    if res.returncode != 0:
        return False, (res.stderr or res.stdout or "errore sconosciuto").strip()[-300:]
    return True, None


def thread_messages(thread_json):
    """I messaggi di una conversazione come [{from: 'them'|'us', text, at}]. 'prospect' è il destinatario, il resto siamo noi."""
    try:
        thread = json.loads(thread_json or "[]")
    except ValueError:
        return []
    out = []
    for m in thread if isinstance(thread, list) else []:
        if isinstance(m, dict):
            out.append({"from": "them" if m.get("sender") == "prospect" else "us",
                        "text": str(m.get("content") or ""), "at": m.get("timestamp")})
    return out


def one(con, sql, args=()):
    row = con.execute(sql, args).fetchone()
    return row[0] if row and row[0] is not None else 0


def group(con, sql):
    return {str(k or "none"): n for k, n in con.execute(sql)}


def optional(fn, default):
    """Le parti accessorie (uso, pausa) non devono far fallire la fotografia se la tabella manca in una versione diversa di Sellbird."""
    try:
        return fn()
    except sqlite3.OperationalError:
        return default


def snapshot(db_path):
    # `mode=ro` fallisce quando Sellbird è spento (database in modalità WAL, senza i file di appoggio): si apre
    # normalmente e si vieta ogni scrittura a questa connessione con query_only.
    con = sqlite3.connect(db_path, timeout=10)
    con.execute("PRAGMA query_only = ON")
    try:
        outbox = [{
            "id": str(r[0]), "status": r[1], "to": r[2] or "", "subject": r[3] or "", "body": r[4] or "",
            "step": r[5] or 0, "kind": r[6] or "", "sendAt": r[7], "sentAt": r[8], "error": r[9],
            "updatedAt": r[10], "company": r[11], "contact": r[12],
        } for r in con.execute(OUTBOX_SQL, (MAX_OUTBOX,))]
        companies = [{
            "id": str(r[0]), "name": r[1] or "", "domain": r[2] or "", "location": r[3] or "",
            "prospects": r[4], "emailsSent": r[5], "replied": r[6] > 0,
        } for r in con.execute(COMPANIES_SQL, (MAX_COMPANIES,))]

        replies = []
        for r in con.execute(REPLIES_SQL, (MAX_REPLIES,)):
            messages = thread_messages(r[8])
            if not any(m["from"] == "them" for m in messages):
                continue  # una conversazione senza risposta del destinatario non è una risposta
            replies.append({
                "id": str(r[0]), "company": r[1], "contact": r[2], "email": r[3], "intent": r[4] or "",
                "stage": r[5] or "", "status": r[6] or "", "updatedAt": r[7], "messages": messages[-MAX_THREAD_MESSAGES:],
            })

        def usage():
            since = "created_at >= datetime('now', '-7 day')"
            return {
                "calls7d": one(con, f"SELECT COUNT(*) FROM usage_events WHERE {since}"),
                "errors7d": one(con, f"SELECT SUM(is_error) FROM usage_events WHERE {since}"),
                "inputTokens7d": one(con, f"SELECT SUM(input_tokens) FROM usage_events WHERE {since}"),
                "outputTokens7d": one(con, f"SELECT SUM(output_tokens) FROM usage_events WHERE {since}"),
                "byAgent": group(con, f"SELECT agent, COUNT(*) FROM usage_events WHERE {since} GROUP BY agent"),
            }

        intents = {}
        for r in replies:
            intents[r["intent"] or "none"] = intents.get(r["intent"] or "none", 0) + 1
        stats = {
            "companies": one(con, "SELECT COUNT(*) FROM companies"),
            "prospects": group(con, "SELECT status, COUNT(*) FROM prospects GROUP BY status"),
            "emailsSent": one(con, "SELECT COUNT(*) FROM outbox WHERE status = 'sent'"),
            "emailsSentToday": one(con, "SELECT COUNT(*) FROM outbox WHERE status = 'sent' AND date(sent_at) = date('now')"),
            "conversations": len(replies),
            "intents": intents,
            "usage": optional(usage, {}),
        }
        paused = optional(lambda: one_text(con, "SELECT value FROM settings WHERE key = 'sending_paused'"), "")
    finally:
        con.close()
    return {"outbox": outbox, "companies": companies, "replies": replies, "stats": stats, "sendingPaused": paused or None}


def one_text(con, sql):
    row = con.execute(sql).fetchone()
    return (row[0] or "") if row else ""


def run_once(sellbird_dir, hub, secret):
    # 1) prima le decisioni, così la fotografia che segue le riflette già
    for cmd in hub_call(hub, secret, "GET", "/api/outreach/commands").get("commands", []):
        ok, err = apply_command(sellbird_dir, cmd)
        log(f"{cmd.get('action')} {cmd.get('outboxId') or ''}: {'ok' if ok else 'FALLITO - ' + str(err)}".replace("  ", " "))
        hub_call(hub, secret, "POST", "/api/outreach/commands", {"id": cmd["id"], "ok": ok, "error": err})
    # 2) poi la fotografia
    snap = snapshot(os.path.join(sellbird_dir, "data", "sellbird.db"))
    res = hub_call(hub, secret, "POST", "/api/outreach/sync", snap)
    log(f"sincronizzate {res.get('outbox')} email, {res.get('companies')} aziende e {res.get('replies')} risposte")


def main():
    sellbird_dir = need("SELLBIRD_DIR")
    hub = need("HUB_URL").rstrip("/")
    secret = need("OUTREACH_BRIDGE_SECRET")
    interval = int(os.environ.get("BRIDGE_INTERVAL_SECONDS", "120"))
    once = "--once" in sys.argv
    while True:
        try:
            run_once(sellbird_dir, hub, secret)
        except Exception as e:  # un giro andato male non deve fermare il ponte
            log(f"errore: {e}")
            if once:
                sys.exit(1)
        if once:
            return
        time.sleep(interval)


if __name__ == "__main__":
    main()
