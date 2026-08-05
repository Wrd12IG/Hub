const path = require('path');
const fs = require('fs');

const keyPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error("serviceAccountKey.json not found!");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
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
    console.log("CLIENTS_DATA_START");
    console.log(JSON.stringify(clients, null, 2));
    console.log("CLIENTS_DATA_END");
  } catch (err) {
    console.error("Firestore retrieval error:", err);
  }
  process.exit(0);
}

run();
