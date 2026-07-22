const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const key = line.substring(0, eqIdx).trim();
      const val = line.substring(eqIdx + 1).trim();
      env[key] = val;
    }
  });
}

const privateKey = env.FIREBASE_PRIVATE_KEY
  ? env.FIREBASE_PRIVATE_KEY.replace(/^"|"$/g, '').replace(/\\n/g, '\n')
  : undefined;

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = getFirestore();

// Mappatura immagini disponibili in /images/team/
const avatarMap = {
  'giada': '/images/team/giada.jpg',
  'luca': '/images/team/luca.jpg',
  'valentina': '/images/team/valentina.jpg',
  'roberto': '/images/team/roberto.jpg',
  'giuseppe': '/images/team/beppe.jpg',
  'beppe': '/images/team/beppe.jpg',
  'lorenzo': '/images/team/lorenzo.jpg',
  'eleonora': '/images/team/eleonora.jpg',
  'enxhi': '/images/team/enxhi.jpg',
  'giulia': '/images/team/giulia.jpg',
  'rebecca': '/images/team/rebecca.jpg',
  'valeria': '/images/team/valeria.jpg',
  'denise': '/images/team/denise.jpg'
};

async function main() {
  const uSnap = await db.collection('users').get();
  console.log(`\nTrovati ${uSnap.size} utenti in Firestore:`);
  
  for (const docSnap of uSnap.docs) {
    const data = docSnap.data();
    const name = (data.name || '').toLowerCase();
    
    // Trova match per nome
    let matchedAvatar = '';
    for (const [key, avatarPath] of Object.entries(avatarMap)) {
      if (name.includes(key)) {
        matchedAvatar = avatarPath;
        break;
      }
    }
    
    console.log(`Utente: "${data.name}" (ID: ${docSnap.id}) | Current Avatar: "${data.avatar || ''}" | Matched: "${matchedAvatar}"`);

    if (matchedAvatar) {
      await db.collection('users').doc(docSnap.id).update({
        avatar: matchedAvatar,
        updatedAt: new Date()
      });
      console.log(`  ✅ Aggiornato avatar per ${data.name} -> ${matchedAvatar}`);
    } else {
      console.log(`  ℹ️ Nessun avatar su www.wrdigital.it per ${data.name} (rimane segnaposto con lettere)`);
    }
  }

  process.exit(0);
}

main().catch(e => {
  console.error('Errore:', e.message);
  process.exit(1);
});
