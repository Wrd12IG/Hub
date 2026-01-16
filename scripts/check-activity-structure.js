/**
 * Script per verificare la struttura delle attività in Firebase
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function main() {
    console.log('🔄 Caricamento attività da Firebase...\n');

    const activitiesSnapshot = await db.collection('calendarActivities').get();

    // Mostra la struttura delle prime 5 attività
    let count = 0;
    activitiesSnapshot.docs.forEach(doc => {
        if (count < 5) {
            console.log('='.repeat(60));
            console.log(`📋 Attività: ${doc.id}`);
            console.log('Campi:', Object.keys(doc.data()).join(', '));
            console.log('Dati:', JSON.stringify(doc.data(), null, 2));
            count++;
        }
    });

    // Trova tutti i campi unici
    const allFields = new Set();
    activitiesSnapshot.docs.forEach(doc => {
        Object.keys(doc.data()).forEach(key => allFields.add(key));
    });

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Tutti i campi trovati nelle attività:');
    console.log([...allFields].sort().join('\n'));
}

main().catch(console.error);
