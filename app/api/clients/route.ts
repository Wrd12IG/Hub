import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const clientsRef = adminDb.collection('clients');
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
