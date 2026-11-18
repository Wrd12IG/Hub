#!/usr/bin/env python3
"""
Ponte tra Sellbird e la hub. Gira sul computer dove gira Sellbird, accanto a lui.

Ogni giro:
  1. ritira dalla hub le decisioni prese da un amministratore (approva / rifiuta una bozza) e le applica
     con la riga di comando di Sellbird (`sellbird outbox --approve|--reject <id>`), poi dice alla hub com'è andata;
  2. manda alla hub una fotografia di email in coda e aziende.

Non scrive mai nel database di Sellbird (la sua connessione è in sola lettura): ogni modifica passa dalla sua CLI.
Solo libreria standard, niente da installare.

Variabili d'ambiente:
  SELLBIRD_DIR              cartella di Sellbird (quella con data/sellbird.db e .venv)         [obbligatoria]
  HUB_URL                   indirizzo della hub, es. https://hub.wrdigital.it                  [obbligatoria]
  OUTREACH_BRIDGE_SECRET    lo stesso segreto configurato sulla hub (almeno 32 caratteri)      [obbligatoria]
  BRIDGE_INTERVAL_SECONDS   pausa tra un giro e l'altro, default 120

Uso:  python3 bridge.py          # in continuo
      python3 bridge.py --once   # un solo giro (per provare)
"""
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request

ID_RE = re.compile(r"^[A-Za-z0-9_-]{4,64}$")
MAX_OUTBOX = 1000
MAX_COMPANIES = 2000

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


def apply_command(sellbird_dir, cmd):
    """Applica un comando con la CLI di Sellbird. Ritorna (ok, errore)."""
    outbox_id, action = cmd.get("outboxId"), cmd.get("action")
    if not isinstance(outbox_id, str) or not ID_RE.match(outbox_id) or action not in ("approve", "reject"):
        return False, "comando non valido"
    exe = os.path.join(sellbird_dir, ".venv", "bin", "sellbird")
    if not os.path.exists(exe):
        return False, "sellbird non trovato in .venv/bin"
    try:
        res = subprocess.run([exe, "outbox", f"--{action}", outbox_id], cwd=sellbird_dir,
                             capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        return False, "sellbird non ha risposto in tempo"
    if res.returncode != 0:
        return False, (res.stderr or res.stdout or "errore sconosciuto").strip()[-300:]
    return True, None


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
    finally:
        con.close()
    return {"outbox": outbox, "companies": companies}


def run_once(sellbird_dir, hub, secret):
    # 1) prima le decisioni, così la fotografia che segue le riflette già
    for cmd in hub_call(hub, secret, "GET", "/api/outreach/commands").get("commands", []):
        ok, err = apply_command(sellbird_dir, cmd)
        log(f"{cmd.get('action')} {cmd.get('outboxId')}: {'ok' if ok else 'FALLITO - ' + str(err)}")
        hub_call(hub, secret, "POST", "/api/outreach/commands", {"id": cmd["id"], "ok": ok, "error": err})
    # 2) poi la fotografia
    snap = snapshot(os.path.join(sellbird_dir, "data", "sellbird.db"))
    res = hub_call(hub, secret, "POST", "/api/outreach/sync", snap)
    log(f"sincronizzate {res.get('outbox')} email e {res.get('companies')} aziende")


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
