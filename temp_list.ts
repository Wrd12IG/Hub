import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountKey) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(serviceAccountKey)),
  });
}

const adminDb = getFirestore();

async function listClients() {
  try {
    const snapshot = await adminDb.collection('clients').get();
    if (snapshot.empty) {
      console.log("No clients found.");
      return;
    }

    console.log("Found clients:");
    snapshot.forEach(doc => {
      console.log(`- ID: ${doc.id} | Name: ${doc.data().name} | companyName: ${doc.data().companyName}`);
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
  }
}

listClients();
