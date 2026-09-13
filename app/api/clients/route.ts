import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    // Questa route restituiva l'anagrafica di **tutti** i clienti a chiunque
    // fosse autenticato. Lo staff continua a vederli tutti; un utente con
    // ruolo "Cliente" riceve soltanto il proprio, così l'elenco non diventa la
    // scorciatoia per aggirare i controlli sulle singole route /clients/[id].
    const appUser = await getAppUser(user.uid);
    const clientsRef = adminDb.collection('clients');

    if (!isStaffUser(appUser)) {
      if (!appUser?.clientId) return NextResponse.json([]);
      const own = await clientsRef.doc(appUser.clientId).get();
      return NextResponse.json(own.exists ? [{ id: own.id, ...own.data() }] : []);
    }

    const snapshot = await clientsRef.get();
    
    if (snapshot.empty) {
      return NextResponse.json([]);
    }

    const clients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  // Creare un cliente è un'operazione di staff, mai di un cliente.
  if (!isStaffUser(await getAppUser(user.uid))) return forbiddenResponse();

  try {
    const body = await request.json();
    
    // Add timestamp metadata
    const clientData = {
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const clientsRef = adminDb.collection('clients');
    
    // If body contains an id, use it as document ID
    let docRef;
    if (body.id) {
      docRef = clientsRef.doc(body.id);
      await docRef.set(clientData);
    } else {
      docRef = await clientsRef.add(clientData);
    }

    return NextResponse.json({ id: docRef.id, ...clientData }, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
