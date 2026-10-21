import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { computeLabourCost, hourlyOverheadOf, type AllocateMode, type LabourActivity, type LabourTask } from '@/lib/labour-cost';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Timestamp di Firestore o stringa ISO → stringa ISO (le date dei task e delle attività arrivano nei due formati). */
const iso = (v: any): string | undefined => {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  return undefined;
};

/**
 * GET /api/admin/labour-cost?months=3
 *
 * Costo del lavoro interno per cliente: ore registrate (task e attività di calendario) per il costo orario di chi le ha
 * fatte, mese per mese, con la stima mensile (media dei mesi completi). Solo amministratori: contiene i costi orari.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const me = await getAppUser(auth.uid);
  if (me?.role !== 'Amministratore') return forbiddenResponse();

  const allocateRaw = request.nextUrl.searchParams.get('allocate');
  const allocate: AllocateMode = allocateRaw === 'proportional' || allocateRaw === 'equal' ? allocateRaw : 'none';
  const months = Math.min(12, Math.max(1, parseInt(request.nextUrl.searchParams.get('months') || '3', 10) || 3));

  try {
    const [usersSnap, clientsSnap, tasksSnap, actSnap, companyCostsSnap] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('clients').get(),
      adminDb.collection('tasks').where('timeSpent', '>', 0).get(),
      adminDb.collection('calendarActivities').get(),
      adminDb.collection('settings').doc('companyCosts').get(),
    ]);

    const usersById = Object.fromEntries(usersSnap.docs.map((d) => [d.id, { hourlyRate: d.get('hourlyRate') }]));
    const clientNames = Object.fromEntries(clientsSnap.docs.map((d) => [d.id, String(d.get('name') ?? d.id)]));
    const tasks: LabourTask[] = tasksSnap.docs.map((d) => ({
      clientId: d.get('clientId'), timeSpent: d.get('timeSpent'), assignedUserId: d.get('assignedUserId'),
      dueDate: iso(d.get('dueDate')), updatedAt: iso(d.get('updatedAt')),
    }));
    const activities: LabourActivity[] = actSnap.docs.map((d) => ({
      clientIds: d.get('clientIds'), clientId: d.get('clientId'), userId: d.get('userId'),
      startTime: iso(d.get('startTime')) ?? iso(d.get('start')), endTime: iso(d.get('endTime')) ?? iso(d.get('end')),
    }));

    // Costi aziendali (dirigenza, struttura, varie) ripartiti sui collaboratori e PM attivi: sovrapprezzo orario per il costo pieno
    const hourlyOverhead = hourlyOverheadOf(
      companyCostsSnap.exists ? (companyCostsSnap.data() as any) : null,
      usersSnap.docs.map((d) => ({ role: d.get('role'), status: d.get('status') })),
    );
    const report = computeLabourCost({ tasks, activities, usersById, clientNames, months, hourlyOverhead, allocate });
    return NextResponse.json({ ...report, sources: { tasks: tasks.length, activities: activities.length, users: usersSnap.size } });
  } catch (err: any) {
    console.error('[admin/labour-cost]', err.message);
    return NextResponse.json({ error: 'Impossibile leggere i dati dei costi.' }, { status: 500 });
  }
}
