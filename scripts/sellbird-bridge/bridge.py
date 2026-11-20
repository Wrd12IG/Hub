#!/usr/bin/env python3
"""
Ponte tra Sellbird e la hub. Gira sul computer dove gira Sellbird, accanto a lui.

Ogni giro:
  1. ritira dalla hub le decisioni prese da un amministratore (approva / rifiuta una bozza, ferma o riprendi gli invii)
     e le applica con la riga di comando di Sellbird (`sellbird outbox --approve|--reject <id>`,
     `sellbird sending pause|resume`, e le esclusioni «mai contattare»), poi dice alla hub com'è andata;
  2. manda alla hub lo stato: email in coda, aziende, contatti, risposte, campagne, segnali, contatori e pausa.
     Le liste lunghe vanno a differenza (solo le righe cambiate; tutto, una volta all'ora): scrivere ogni volta ogni
     documento su Firestore costerebbe migliaia di scritture al giorno per niente.

Non scrive mai nel database di Sellbird (la sua connessione è in sola lettura): ogni modifica passa dalla sua CLI.
Solo libreria standard, niente da installare.

Variabili d'ambiente:
  SELLBIRD_DIR              cartella di Sellbird (quella con data/sellbird.db e .venv)         [obbligatoria]
  HUB_URL                   indirizzo della hub, es. https://hub.wrdigital.it                  [obbligatoria]
  OUTREACH_BRIDGE_SECRET    lo stesso segreto configurato sulla hub (almeno 32 caratteri)      [obbligatoria]
  BRIDGE_INTERVAL_SECONDS   ogni quanto manda lo stato alla hub, default 120
  BRIDGE_COMMAND_INTERVAL_SECONDS  ogni quanto controlla le richieste (approva, escludi...), default 15, minimo 5
  OUTREACH_MAX_DISCOVER_SPEND  tetto in dollari per ogni ricerca (Discover) lanciata dalla hub: default e massimo 2; 0 la spegne
  SELLBIRD_CMD              come lanciare Sellbird; default <SELLBIRD_DIR>/.venv/bin/sellbird, in Docker "python -m sellbird"

Uso:  python3 bridge.py          # in continuo
      python3 bridge.py --once   # un solo giro (per provare)
"""
import hashlib
import json
import os
import re
import shlex
import shutil
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
MAX_CONTACTS = 1500
MAX_CAMPAIGNS = 100
MAX_SIGNALS = 100
# Ogni FULL_EVERY giri si rimanda tutto, così una hub svuotata o un giro perso si riallineano da soli (30 giri = circa un'ora).
FULL_EVERY = 30
DELTA_LISTS = ("outbox", "companies", "replies", "contacts")
MAX_THREAD_MESSAGES = 8
SENDING_COMMANDS = {"pause_sending": "pause", "resume_sending": "resume"}
# Azioni con parametri dalla hub: tutto da liste fisse, mai testo libero. La hub le controlla e il ponte le ricontrolla da sé.
DISCOVER_PROVIDERS = ("osm", "serper")
DISCOVER_HARD_CAP = 2.0
MAX_CITIES = 10
MAX_SECTORS = 5
# Un dominio da mettere in «mai contattare»: etichette di lettere, cifre e trattini, punto, estensione. Come nella hub.
DOMAIN_RE = re.compile(r"(?=.{4,100}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}")
MAX_EXCLUSIONS = 500
MAX_REJECT = 60
MAX_BATCH = 100
# Un luogo è «Comune, SIGLA» o una regione: lettere, cifre, spazi e pochi segni. Niente ';' (separa le città), niente simboli di shell.
PLACE_RE = re.compile(r"[\w .,'’()/-]{2,80}")
MAX_SIGNAL_CODES = 40
CODE_RE = re.compile(r"^[A-Z0-9_]{2,60}$")
ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
COST_RE = re.compile(r"Estimated cost:\s*\$([0-9]+(?:\.[0-9]+)?)")

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

CONTACTS_SQL = """
SELECT p.id, COALESCE(NULLIF(c.name, ''), p.company, ''), TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')),
       COALESCE(p.title, ''), COALESCE(p.email, ''), COALESCE(p.email_status, ''), COALESCE(p.status, ''), COALESCE(p.score, 0)
FROM prospects p
LEFT JOIN companies c ON c.id = p.company_id
ORDER BY p.score DESC, p.updated_at DESC
LIMIT ?
"""

CAMPAIGNS_SQL = """
SELECT k.id, k.name, k.channel, k.status, k.sequence_json, k.prospect_ids_json, k.created_at,
       (SELECT COUNT(*) FROM outbox o WHERE o.campaign_id = k.id AND o.status = 'sent'),
       (SELECT COUNT(*) FROM outbox o WHERE o.campaign_id = k.id AND o.status IN ('pending_review', 'approved', 'sending')),
       (SELECT COUNT(*) FROM conversations v WHERE v.campaign_id = k.id AND v.stage != 'initial_outreach')
FROM campaigns k
ORDER BY k.created_at DESC
LIMIT ?
"""

SIGNALS_SQL = """
SELECT s.code, s.label, s.description, s.category, s.status, s.cost_note,
       (SELECT COUNT(DISTINCT o.company_id) FROM observations o WHERE o.signal_code = s.code AND o.company_id != '')
FROM signal_codes s
ORDER BY s.category, s.code
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


def discover_cap():
    """Tetto di spesa per ogni ricerca lanciata dalla hub, in dollari: OUTREACH_MAX_DISCOVER_SPEND (default 2), mai oltre 2.
    0 o un valore non valido spegne Discover dalla hub."""
    try:
        cap = float(os.environ.get("OUTREACH_MAX_DISCOVER_SPEND", str(DISCOVER_HARD_CAP)))
    except ValueError:
        return 0.0
    return max(0.0, min(cap, DISCOVER_HARD_CAP))


def config_cities(sellbird_dir):
    """Le città del profilo del cliente ideale (icp.geography): le sole che la hub può scegliere per Discover."""
    if not sellbird_dir:
        return []
    try:
        import yaml  # c'è nell'immagine di Sellbird; fuori da Docker può mancare: allora nessuna città scelta, vale il profilo
    except ImportError:
        return []
    for name in ("sellbird.local.yaml", "sellbird.yaml"):
        path = os.path.join(sellbird_dir, name)
        if os.path.exists(path):
            try:
                with open(path, encoding="utf-8") as f:
                    cities = ((yaml.safe_load(f) or {}).get("icp") or {}).get("geography") or []
            except (OSError, yaml.YAMLError):
                return []
            return [c for c in cities if isinstance(c, str) and c and ";" not in c][:40]
    return []


def config_industries(sellbird_dir):
    """I settori del profilo del cliente ideale (icp.industries): valgono quando la hub non ne sceglie."""
    if not sellbird_dir:
        return []
    try:
        import yaml
    except ImportError:
        return []
    for name in ("sellbird.local.yaml", "sellbird.yaml"):
        path = os.path.join(sellbird_dir, name)
        if os.path.exists(path):
            try:
                with open(path, encoding="utf-8") as f:
                    items = ((yaml.safe_load(f) or {}).get("icp") or {}).get("industries") or []
            except (OSError, yaml.YAMLError):
                return []
            return [i for i in items if isinstance(i, str) and i and ";" not in i][:40]
    return []


def config_path(sellbird_dir):
    """Il file di configurazione che Sellbird legge davvero: quello «local» se c'è, altrimenti quello di base."""
    for name in ("sellbird.local.yaml", "sellbird.yaml"):
        path = os.path.join(sellbird_dir or "", name)
        if sellbird_dir and os.path.exists(path):
            return path
    return None


def norm_entry(entry):
    """Una voce della lista come la legge Sellbird: minuscola, e per un dominio senza schema, percorso e «www.» (nel file può
    esserci «https://www.Esempio.it/»: per Sellbird è «esempio.it»). Un indirizzo resta un indirizzo."""
    e = entry.strip().lower()
    if "@" in e:
        return e
    return e.removeprefix("http://").removeprefix("https://").split("/")[0].removeprefix("www.")


def config_dnc(sellbird_dir):
    """La lista «mai contattare» (compliance.do_not_contact), com'è nel file. Voci: domini o singoli indirizzi."""
    path = config_path(sellbird_dir)
    if not path:
        return []
    try:
        import yaml
        with open(path, encoding="utf-8") as f:
            items = ((yaml.safe_load(f) or {}).get("compliance") or {}).get("do_not_contact") or []
    except Exception:
        return []
    return [norm_entry(i) for i in items if isinstance(i, str) and i.strip()][:MAX_EXCLUSIONS]


def domain_excluded(domain, entries):
    """Il dominio è coperto da una voce della lista? Una voce senza «@» copre il dominio e i suoi sottodomini."""
    d = (domain or "").lower().removeprefix("www.")
    return any(e == d or d.endswith("." + e) for e in entries if "@" not in e)


def edit_dnc_many(sellbird_dir, adds, removes):
    """Aggiunge e toglie **più** domini da compliance.do_not_contact con una sola modifica del file di Sellbird.

    Una copia di sicurezza (`<file>.bak-dnc`), una scrittura atomica (Sellbird rilegge il file mentre gira e non deve mai vederlo a
    metà) e una verifica: se dopo la scrittura anche un solo dominio non è come deve, si rimette la copia. Se non c'è nulla da cambiare
    non si scrive niente. Ritorna (ok, messaggio, {"added": [...], "removed": [...], "skipped": n})."""
    summary = {"added": [], "removed": [], "skipped": 0}
    path = config_path(sellbird_dir)
    if not path:
        return False, "file di configurazione non trovato", summary
    try:
        import yaml
    except ImportError:
        return False, "PyYAML non disponibile: l'esclusione dalla hub funziona nel contenitore di Sellbird", summary
    try:
        with open(path, encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
        compliance = cfg.setdefault("compliance", {})
        items = [i for i in (compliance.get("do_not_contact") or []) if isinstance(i, str)]
        current = {i.strip().lower() for i in items}
        for domain in adds:
            if domain in current:
                summary["skipped"] += 1
            elif len(items) >= MAX_EXCLUSIONS:
                return False, "lista troppo lunga", summary
            else:
                items.append(domain)
                current.add(domain)
                summary["added"].append(domain)
        for domain in removes:
            kept = [i for i in items if i.strip().lower() != domain]
            if len(kept) == len(items):
                summary["skipped"] += 1
            else:
                items = kept
                current.discard(domain)
                summary["removed"].append(domain)
        if not summary["added"] and not summary["removed"]:
            return True, "niente da cambiare", summary
        compliance["do_not_contact"] = items
        backup = path + ".bak-dnc"
        shutil.copy2(path, backup)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            yaml.safe_dump(cfg, f, allow_unicode=True, sort_keys=False, width=100)
        os.replace(tmp, path)
        after = set(config_dnc(sellbird_dir))
        if not all(d in after for d in summary["added"]) or any(d in after for d in summary["removed"]):
            shutil.copy2(backup, path)
            return False, "verifica fallita: ripristinato il file com'era", {"added": [], "removed": [], "skipped": 0}
        return True, "fatto", summary
    except (OSError, ValueError, yaml.YAMLError) as e:
        return False, f"{type(e).__name__}: {str(e)[:120]}", summary


def edit_dnc(sellbird_dir, domain, add):
    """Un solo dominio: come edit_dnc_many. Ritorna (ok, messaggio)."""
    ok, why, summary = edit_dnc_many(sellbird_dir, [domain] if add else [], [] if add else [domain])
    if not ok:
        return False, why
    if add:
        return True, "aggiunto" if summary["added"] else "già in lista"
    return (True, "tolto") if summary["removed"] else (False, "non è in lista")


def pending_drafts_for_domain(db_path, domain):
    """Gli id delle email ancora in coda (da rivedere o approvate) per le aziende di quel dominio e dei suoi sottodomini."""
    con = sqlite3.connect(db_path, timeout=10)
    con.execute("PRAGMA query_only = ON")
    try:
        rows = con.execute(
            "SELECT o.id FROM outbox o JOIN prospects p ON p.id = o.prospect_id JOIN companies c ON c.id = p.company_id "
            "WHERE o.status IN ('pending_review', 'approved') AND (LOWER(c.domain) = ? OR LOWER(c.domain) LIKE ?) LIMIT ?",
            (domain, "%." + domain, MAX_REJECT),
        ).fetchall()
    finally:
        con.close()
    return [str(r[0]) for r in rows if ID_RE.match(str(r[0]))]


MAX_REJECT_TOTAL = 300   # per gruppo: oltre, il resto si rifiuta rilanciando
REJECT_WORKERS = 4


def reject_drafts(sellbird_dir, domains):
    """Rifiuta le bozze in coda di quei domini, **in parallelo** (ognuna è un processo di Sellbird: una dopo l'altra erano minuti).
    Ritorna (rifiutate, non rifiutate, rimaste fuori per il tetto)."""
    db_path = os.path.join(sellbird_dir, "data", "sellbird.db")
    ids, over = [], 0
    for domain in domains:
        for outbox_id in pending_drafts_for_domain(db_path, domain):
            if outbox_id in ids:
                continue
            if len(ids) < MAX_REJECT_TOTAL:
                ids.append(outbox_id)
            else:
                over += 1
    if not ids:
        return 0, 0, over
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=REJECT_WORKERS) as pool:
        results = list(pool.map(lambda i: run_sellbird(sellbird_dir, ["outbox", "--reject", i])[0], ids))
    return sum(1 for r in results if r), sum(1 for r in results if not r), over


_INDUSTRY_OPTION = {}


def supports_industry(sellbird_dir):
    """Sellbird sul server ha l'opzione `discover --industry`? Non è nella versione originale: è la modifica
    sellbird-industry-option.patch. Si chiede a Sellbird stesso (`discover --help`) e si ricorda per 10 minuti."""
    if not sellbird_dir:
        return False
    hit = _INDUSTRY_OPTION.get(sellbird_dir)
    if hit and time.time() - hit[0] < 600:
        return hit[1]
    base, err = sellbird_base(sellbird_dir)
    ok = False
    if not err:
        try:
            res = subprocess.run([*base, "discover", "--help"], cwd=sellbird_dir, capture_output=True, text=True, timeout=60)
            ok = "--industry" in (res.stdout or "")
        except (subprocess.TimeoutExpired, OSError):
            ok = False
    _INDUSTRY_OPTION[sellbird_dir] = (time.time(), ok)
    return ok


def free_signal_codes(db_path, codes):
    """Dei codici dati, quelli che esistono e sono GRATUITI. Stessa regola di `sellbird signals --confirm free`:
    la nota di costo comincia con free o included (contenere la parola non basta)."""
    con = sqlite3.connect(db_path, timeout=10)
    con.execute("PRAGMA query_only = ON")
    try:
        found = {code: (note or "") for code, note in con.execute("SELECT code, cost_note FROM signal_codes")}
    finally:
        con.close()
    return {c for c in codes if c in found and re.match(r"(?i)^(free|included)", found[c].strip())}


def run_sellbird(sellbird_dir, args, timeout=120):
    """Lancia Sellbird con `args`. Ritorna (ok, errore, testo): il testo è quanto ha stampato, senza colori e accorciato."""
    base, err = sellbird_base(sellbird_dir)
    if err:
        return False, err, ""
    try:
        res = subprocess.run([*base, *args], cwd=sellbird_dir, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return False, "sellbird non ha risposto in tempo", ""
    out = ANSI_RE.sub("", res.stdout or "").strip()[-1500:]
    if res.returncode != 0:
        return False, (res.stderr or res.stdout or "errore sconosciuto").strip()[-300:], out
    return True, None, out


def discover_args(sellbird_dir, cmd):
    """(provider, luoghi, settori) controllati, oppure (None, messaggio d'errore).

    La hub sceglie i luoghi dall'elenco ISTAT (o dal profilo) e i settori dall'elenco fisso (o dal profilo); qui si
    controlla il formato e il numero, non gli elenchi: la difesa sulla spesa è il tetto, che vale qualunque cosa si chieda."""
    provider, cities, industries = cmd.get("provider"), cmd.get("cities") or [], cmd.get("industries") or []
    if provider not in DISCOVER_PROVIDERS:
        return None, "provider non ammesso"
    if not isinstance(cities, list) or len(cities) > MAX_CITIES or not all(isinstance(c, str) for c in cities):
        return None, "luoghi non validi"
    if not all(PLACE_RE.fullmatch(c) for c in cities):
        return None, "luogo con caratteri non ammessi"
    if not isinstance(industries, list) or len(industries) > MAX_SECTORS or not all(isinstance(i, str) for i in industries):
        return None, "settori non validi"
    if not all(PLACE_RE.fullmatch(i) for i in industries):
        return None, "settore con caratteri non ammessi"
    return (provider, cities, industries), None


def apply_command(sellbird_dir, cmd):
    """Applica un comando con la CLI di Sellbird, solo da una lista fissa di azioni. Ritorna (ok, errore, extra):
    `extra` è il testo stampato da Sellbird e, per una stima, il costo letto da lì: la hub li mostra a chi ha chiesto."""
    action = cmd.get("action")
    outbox_id = cmd.get("outboxId")

    if action in ("approve", "reject") and isinstance(outbox_id, str) and ID_RE.match(outbox_id):
        ok, err, _ = run_sellbird(sellbird_dir, ["outbox", f"--{action}", outbox_id])
        return ok, err, {}
    if action in SENDING_COMMANDS:
        ok, err, _ = run_sellbird(sellbird_dir, ["sending", SENDING_COMMANDS[action]])
        return ok, err, {}

    if action in ("discover_estimate", "discover_run"):
        cap = discover_cap()
        if cap <= 0:
            return False, "Discover dalla hub è spento (OUTREACH_MAX_DISCOVER_SPEND)", {}
        parsed, err = discover_args(sellbird_dir, cmd)
        if err:
            return False, err, {}
        provider, cities, industries = parsed
        city = ["--city", ";".join(cities)] if cities else []
        if industries:
            if not supports_industry(sellbird_dir):
                return False, "Sellbird sul server non ha l'opzione --industry: applica la modifica descritta nel README del ponte", {}
            city += ["--industry", ";".join(industries)]
        if action == "discover_estimate":
            ok, err, out = run_sellbird(sellbird_dir, ["discover", "--provider", provider, "--estimate", "--max-spend", f"{cap:.2f}", *city], timeout=300)
            m = COST_RE.search(out)
            if ok and not m:
                return False, "non riesco a leggere la stima", {"result": out}
            return ok, err, {"result": out, "estimatedCost": float(m.group(1)) if m else None}
        try:
            spend = float(cmd.get("maxSpend"))
        except (TypeError, ValueError):
            return False, "tetto di spesa mancante", {}
        if not 0 < spend <= cap:
            return False, f"tetto di spesa fuori dal limite ({cap:.2f} $)", {}
        ok, err, out = run_sellbird(sellbird_dir, ["discover", "--provider", provider, "--max-spend", f"{spend:.2f}", *city], timeout=1500)
        return ok, err, {"result": out}

    if action == "signals_set":
        codes, status = cmd.get("codes"), cmd.get("signalStatus")
        if status not in ("confirmed", "rejected") or not isinstance(codes, list) or not 0 < len(codes) <= MAX_SIGNAL_CODES:
            return False, "comando non valido", {}
        if not all(isinstance(c, str) and CODE_RE.match(c) for c in codes):
            return False, "codice di segnale non valido", {}
        free = free_signal_codes(os.path.join(sellbird_dir, "data", "sellbird.db"), codes)
        if free != set(codes):
            return False, "solo i segnali gratuiti si cambiano dalla hub: " + ", ".join(sorted(set(codes) - free)), {}
        ok, err, out = run_sellbird(sellbird_dir, ["signals", "--confirm" if status == "confirmed" else "--reject", ",".join(codes)])
        return ok, err, {"result": out}

    if action in ("dnc_add", "dnc_remove", "dnc_batch"):
        if action == "dnc_batch":
            changes = cmd.get("changes")
            if not isinstance(changes, list) or not 0 < len(changes) <= MAX_BATCH:
                return False, "gruppo di modifiche non valido", {}
            adds, removes, seen = [], [], set()
            for c in changes:
                domain = c.get("domain") if isinstance(c, dict) else None
                kind = c.get("action") if isinstance(c, dict) else None
                # Tutto o niente: un solo elemento sbagliato ferma il gruppo prima di toccare il file.
                if kind not in ("add", "remove") or not isinstance(domain, str) or not DOMAIN_RE.fullmatch(domain) or domain in seen:
                    return False, "gruppo di modifiche non valido", {}
                seen.add(domain)
                (adds if kind == "add" else removes).append(domain)
        else:
            domain = cmd.get("domain")
            if not isinstance(domain, str) or not DOMAIN_RE.fullmatch(domain):
                return False, "dominio non valido", {}
            adds, removes = ([domain], []) if action == "dnc_add" else ([], [domain])
        ok, why, summary = edit_dnc_many(sellbird_dir, adds, removes)
        if not ok:
            return False, why, {}
        parts = []
        if summary["added"]:
            parts.append(f"escluse {len(summary['added'])}")
        if summary["removed"]:
            parts.append(f"riammesse {len(summary['removed'])}")
        if summary["skipped"]:
            parts.append(f"già a posto {summary['skipped']}")
        result = (", ".join(parts) or "niente da cambiare").capitalize() + "."
        if adds:
            # Il controllo di Sellbird blocca comunque l'invio, ma una bozza in coda resterebbe visibile e approvabile: si rifiuta.
            rejected, failed, over = reject_drafts(sellbird_dir, adds)
            result += f" Bozze rifiutate: {rejected}" + (f" ({failed} non rifiutate)" if failed else "") + (f"; altre {over} restano: rilancia" if over else "") + "."
        return True, None, {"result": result}

    return False, "comando non valido", {}


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


def snapshot(db_path, sellbird_dir=None):
    # `mode=ro` fallisce quando Sellbird è spento (database in modalità WAL, senza i file di appoggio): si apre
    # normalmente e si vieta ogni scrittura a questa connessione con query_only.
    con = sqlite3.connect(db_path, timeout=10)
    con.execute("PRAGMA query_only = ON")
    try:
        dnc = config_dnc(sellbird_dir)
        outbox = [{
            "id": str(r[0]), "status": r[1], "to": r[2] or "", "subject": r[3] or "", "body": r[4] or "",
            "step": r[5] or 0, "kind": r[6] or "", "sendAt": r[7], "sentAt": r[8], "error": r[9],
            "updatedAt": r[10], "company": r[11], "contact": r[12],
        } for r in con.execute(OUTBOX_SQL, (MAX_OUTBOX,))]
        companies = [{
            "id": str(r[0]), "name": r[1] or "", "domain": r[2] or "", "location": r[3] or "",
            "prospects": r[4], "emailsSent": r[5], "replied": r[6] > 0,
            "excluded": domain_excluded(r[2], dnc),
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

        contacts = [{
            "id": str(r[0]), "company": r[1], "name": r[2], "title": r[3], "email": r[4],
            "emailStatus": r[5], "status": r[6], "score": r[7] or 0,
        } for r in con.execute(CONTACTS_SQL, (MAX_CONTACTS,))]

        def list_len(text):
            try:
                value = json.loads(text or "[]")
            except ValueError:
                return 0
            return len(value) if isinstance(value, list) else 0

        def campaigns_q():
            return [{
                "id": str(r[0]), "name": r[1] or "", "channel": r[2] or "", "status": r[3] or "", "steps": list_len(r[4]),
                "prospects": list_len(r[5]), "createdAt": r[6], "sent": r[7], "queued": r[8], "replies": r[9],
            } for r in con.execute(CAMPAIGNS_SQL, (MAX_CAMPAIGNS,))]

        def signals_q():
            return [{
                "code": r[0], "label": r[1] or "", "description": r[2] or "", "category": r[3] or "",
                "status": r[4] or "", "costNote": r[5] or "", "companies": r[6] or 0,
            } for r in con.execute(SIGNALS_SQL, (MAX_SIGNALS,))]

        campaigns = optional(campaigns_q, [])
        signals = optional(signals_q, [])
        outbox_counts = group(con, "SELECT status, COUNT(*) FROM outbox GROUP BY status")

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
    return {
        "outbox": outbox, "companies": companies, "contacts": contacts, "replies": replies, "campaigns": campaigns,
        "signals": signals, "outboxCounts": outbox_counts, "stats": stats, "sendingPaused": paused or None,
        "exclusions": [e for e in dnc if "@" not in e and DOMAIN_RE.fullmatch(e)],
        # Cosa la hub può chiedere a Discover: provider, città del profilo (scorciatoie) e tetto. Cap 0 = spento.
        "discover": {
            "providers": list(DISCOVER_PROVIDERS), "cities": config_cities(sellbird_dir), "cap": discover_cap(),
            "industries": config_industries(sellbird_dir), "industryOption": supports_industry(sellbird_dir),
        },
    }


def one_text(con, sql):
    row = con.execute(sql).fetchone()
    return (row[0] or "") if row else ""


def item_hash(item):
    return hashlib.sha1(json.dumps(item, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def load_state(path):
    try:
        with open(path, encoding="utf-8") as f:
            state = json.load(f)
        return state if isinstance(state, dict) else {}
    except (OSError, ValueError):
        return {}


def save_state(path, state):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f)
    os.replace(tmp, path)


def to_delta(snap, state):
    """Toglie dalla fotografia le righe già mandate e invariate. Ritorna (da mandare, nuovo stato), senza scrivere nulla:
    lo stato si salva solo dopo che la hub ha risposto, così un giro fallito si rimanda."""
    runs = int(state.get("runs", 0))
    full = runs % FULL_EVERY == 0
    sent = state.get("hashes", {})
    payload = dict(snap)
    hashes = {}
    for name in DELTA_LISTS:
        current = {item["id"]: item_hash(item) for item in snap[name]}
        hashes[name] = current
        previous = sent.get(name, {})
        payload[name] = snap[name] if full else [i for i in snap[name] if previous.get(i["id"]) != current[i["id"]]]
    return payload, {"runs": runs + 1, "hashes": hashes}


def apply_pending(sellbird_dir, hub, secret):
    """Ritira dalla hub le decisioni in attesa e le applica; dice alla hub com'è andata. Ritorna quante ne ha applicate.
    È una sola richiesta HTTP leggera: si può fare spesso, così un clic nella hub non aspetta minuti."""
    done = 0
    for cmd in hub_call(hub, secret, "GET", "/api/outreach/commands").get("commands", []):
        ok, err, extra = apply_command(sellbird_dir, cmd)
        label = cmd.get("outboxId") or (f"{len(cmd['changes'])} modifiche" if isinstance(cmd.get("changes"), list) else "")
        log(f"{cmd.get('action')} {label}: {'ok' if ok else 'FALLITO - ' + str(err)}".replace("  ", " "))
        hub_call(hub, secret, "POST", "/api/outreach/commands", {"id": cmd["id"], "ok": ok, "error": err, **extra})
        done += 1
    return done


def sync_state(sellbird_dir, hub, secret):
    """Manda alla hub lo stato (a differenza: vedi to_delta)."""
    snap = snapshot(os.path.join(sellbird_dir, "data", "sellbird.db"), sellbird_dir)
    state_path = os.path.join(sellbird_dir, "data", "bridge-state.json")
    payload, new_state = to_delta(snap, load_state(state_path))
    res = hub_call(hub, secret, "POST", "/api/outreach/sync", payload)
    save_state(state_path, new_state)
    log(f"inviate {res.get('outbox')} email, {res.get('companies')} aziende, {res.get('contacts')} contatti, "
        f"{res.get('replies')} risposte (cambiate dall'ultima volta; tutto ogni {FULL_EVERY} giri)")


def run_once(sellbird_dir, hub, secret):
    # prima le decisioni, così la fotografia che segue le riflette già
    apply_pending(sellbird_dir, hub, secret)
    sync_state(sellbird_dir, hub, secret)


def should_sync(now, last_sync, applied, sync_interval):
    """Si manda lo stato se è la prima volta, se è passato l'intervallo, o subito dopo aver applicato qualcosa (così la pagina
    mostra l'esito senza aspettare)."""
    return last_sync is None or applied > 0 or now - last_sync >= sync_interval


def main():
    sellbird_dir = need("SELLBIRD_DIR")
    hub = need("HUB_URL").rstrip("/")
    secret = need("OUTREACH_BRIDGE_SECRET")
    sync_interval = int(os.environ.get("BRIDGE_INTERVAL_SECONDS", "120"))
    # Le richieste si controllano molto più spesso dello stato: costano una richiesta leggera e un clic non aspetta minuti.
    poll = max(5, min(sync_interval, int(os.environ.get("BRIDGE_COMMAND_INTERVAL_SECONDS", "15"))))
    once = "--once" in sys.argv
    last_sync = None
    while True:
        try:
            applied = apply_pending(sellbird_dir, hub, secret)
            if should_sync(time.monotonic(), last_sync, applied, sync_interval):
                sync_state(sellbird_dir, hub, secret)
                last_sync = time.monotonic()
        except Exception as e:  # un giro andato male non deve fermare il ponte
            log(f"errore: {e}")
            if once:
                sys.exit(1)
        if once:
            return
        time.sleep(poll)


if __name__ == "__main__":
    main()
