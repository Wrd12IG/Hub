/**
 * Script per aggiungere clientId alle attività calendario esistenti
 * 
 * Logica:
 * 1. Legge tutte le attività calendario da Firebase
 * 2. Per ogni attività senza clientId, cerca di trovare il cliente dal titolo
 * 3. Aggiorna l'attività con il clientId trovato
 * 
 * Esecuzione: node scripts/add-client-to-activities.js
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

// Check if service account exists
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ File serviceAccountKey.json non trovato!');
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function main() {
    console.log('🔄 Caricamento dati da Firebase...');

    // Carica tutti i clienti
    const clientsSnapshot = await db.collection('clients').get();
    const clients = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || ''
    }));
    console.log(`   ✅ ${clients.length} clienti trovati`);

    // Carica tutte le attività
    const activitiesSnapshot = await db.collection('calendarActivities').get();
    const activities = activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    console.log(`   ✅ ${activities.length} attività trovate`);

    // Filtra attività senza clientId
    const activitiesWithoutClient = activities.filter(a => !a.clientId && (!a.clientIds || a.clientIds.length === 0));
    console.log(`\n📋 ${activitiesWithoutClient.length} attività senza cliente associato\n`);

    if (activitiesWithoutClient.length === 0) {
        console.log('✅ Tutte le attività hanno già un cliente associato!');
        return;
    }

    // Mostra le attività e cerca di trovare il cliente
    let updated = 0;
    let notFound = 0;
    const notFoundList = [];

    for (const activity of activitiesWithoutClient) {
        const title = activity.title || '';

        // Cerca il cliente nel titolo (cerca corrispondenze parziali)
        let foundClient = null;

        for (const client of clients) {
            // Cerca se il nome del cliente compare nel titolo (case-insensitive)
            if (title.toLowerCase().includes(client.name.toLowerCase())) {
                foundClient = client;
                break;
            }
        }

        // Se non trovato, prova a prendere la prima parte del titolo (prima del " - ")
        if (!foundClient) {
            const firstPart = title.split(/\s*-\s*/)[0].trim();
            for (const client of clients) {
                if (client.name.toLowerCase() === firstPart.toLowerCase()) {
                    foundClient = client;
                    break;
                }
            }
        }

        if (foundClient) {
            console.log(`✓ "${title.substring(0, 50)}..." → ${foundClient.name}`);

            // Aggiorna l'attività con il clientId
            await db.collection('calendarActivities').doc(activity.id).update({
                clientId: foundClient.id
            });
            updated++;
        } else {
            console.log(`✗ "${title.substring(0, 50)}..." → Cliente non trovato`);
            notFoundList.push(title);
            notFound++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Riepilogo:`);
    console.log(`   ✅ ${updated} attività aggiornate con clientId`);
    console.log(`   ⚠️  ${notFound} attività senza corrispondenza`);

    if (notFoundList.length > 0) {
        console.log(`\n⚠️  Attività senza cliente (da aggiornare manualmente):`);
        notFoundList.forEach(t => console.log(`   - ${t}`));
    }

    console.log('\n✅ Completato!');
}

main().catch(console.error);
