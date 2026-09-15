import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed, denyUnlessStaff } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { fetchCompetitorPage, diffSnapshots, type CompetitorSnapshot } from '@/lib/competitors-client';

export const maxDuration = 60;

/**
 * I competitor territoriali di un cliente.
 *
 * L'elenco lo inserisce lo staff: chi siano i concorrenti di una
 * concessionaria in Brianza è conoscenza umana, non un dato che si deduce.
 * Il Hub si limita a **osservare** quei siti nel tempo e a dire cosa cambia.
 */

export interface Competitor {
  id: string;
  nome: string;
  sito: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
}

const MAX = 5;

const ref = (clientId: string) =>
  adminDb.collection('clients').doc(clientId).collection('intelligence').doc('competitors');

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(auth.uid, params.id);
  if (denied) return denied;

  const snap = await ref(params.id).get();
  const data = snap.exists ? (snap.data() as any) : {};
  return NextResponse.json({
    competitors: (data.competitors ?? []) as Competitor[],
    snapshots: (data.snapshots ?? {}) as Record<string, CompetitorSnapshot>,
    changes: (data.changes ?? []) as { at: number; competitor: string; text: string; url: string }[],
    errors: (data.errors ?? {}) as Record<string, string>,
    lastRun: data.lastRun ?? null,
  });
}

/** Salva l'elenco. Solo staff: è configurazione, non un dato del cliente. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessStaff(auth.uid);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const incoming = Array.isArray(body?.competitors) ? body.competitors : [];

  const clean: Competitor[] = incoming.slice(0, MAX).map((c: any, i: number) => ({
    id: String(c.id || `c${i + 1}`),
    nome: String(c.nome ?? '').trim().slice(0, 80),
    sito: normalizeUrl(String(c.sito ?? '')),
    instagram: String(c.instagram ?? '').trim() || undefined,
    facebook: String(c.facebook ?? '').trim() || undefined,
    linkedin: String(c.linkedin ?? '').trim() || undefined,
  })).filter((c: Competitor) => c.nome || c.sito);

  await ref(params.id).set({ competitors: clean, updatedAt: Date.now() }, { merge: true });
  return NextResponse.json({ competitors: clean });
}

/** Lettura immediata, per non aspettare il giro notturno dopo un inserimento. */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessStaff(auth.uid);
  if (denied) return denied;

  const result = await collectForClient(params.id);
  return NextResponse.json(result);
}

function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/**
 * Legge i siti dei competitor di un cliente e registra cosa è cambiato.
 * Esportata perché la usa anche il cron notturno.
 */
export async function collectForClient(clientId: string) {
  const doc = await ref(clientId).get();
  const data = doc.exists ? (doc.data() as any) : {};
  const competitors: Competitor[] = data.competitors ?? [];
  if (competitors.length === 0) return { collected: 0, changes: [] };

  const previous: Record<string, CompetitorSnapshot> = data.snapshots ?? {};
  const snapshots: Record<string, CompetitorSnapshot> = { ...previous };
  const errors: Record<string, string> = {};
  const newChanges: { at: number; competitor: string; text: string; url: string }[] = [];

  // In sequenza: cinque siti in parallelo da una funzione serverless è il modo
  // più veloce per farsi scambiare per un bot.
  for (const c of competitors) {
    if (!c.sito) continue;
    const res = await fetchCompetitorPage(c.sito);
    if (!res.ok || !res.snapshot) {
      errors[c.id] = res.error ?? 'Lettura non riuscita.';
      continue;
    }
    for (const text of diffSnapshots(previous[c.id] ?? null, res.snapshot)) {
      newChanges.push({ at: Date.now(), competitor: c.nome || c.sito, text, url: c.sito });
    }
    snapshots[c.id] = res.snapshot;
  }

  // Si tengono gli ultimi 50 cambiamenti: è un registro, non un archivio.
  const changes = [...newChanges, ...(data.changes ?? [])].slice(0, 50);

  await ref(clientId).set({ snapshots, errors, changes, lastRun: Date.now() }, { merge: true });
  return { collected: Object.keys(snapshots).length, changes: newChanges };
}
