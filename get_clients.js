const path = require('path');
const dotenv = require('dotenv');

// Use the standard dotenv library which supports multi-line variables properly
dotenv.config({ path: path.join(__dirname, '.env.local') });

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  console.error("Missing Firebase credentials in .env.local");
  process.exit(1);
}

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();

async function run() {
  try {
    const snapshot = await db.collection('clients').get();
    const clients = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      clients.push({
        id: doc.id,
        name: data.name,
        companyName: data.companyName,
        website: data.website || '',
        url: data.url || '',
        logo: data.logo || '',
        sector: data.sector || '',
        description: data.description || ''
      });
    });
    console.log(JSON.stringify(clients, null, 2));
  } catch (err) {
    console.error("Firestore retrieval error:", err);
  }
  process.exit(0);
}

run();
