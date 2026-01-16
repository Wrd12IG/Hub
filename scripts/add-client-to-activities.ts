/**
 * Script per aggiungere clientId alle attività calendario esistenti
 * 
 * Logica:
 * 1. Legge tutte le attività calendario da Firebase
 * 2. Per ogni attività senza clientId, cerca di trovare il cliente dal titolo
 * 3. Aggiorna l'attività con il clientId trovato
 * 
 * Esecuzione: npx ts-node scripts/add-client-to-activities.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

// Check if service account exists
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ File serviceAccountKey.json non trovato!');
    console.error('   Scarica il file dal Firebase Console:');
    console.error('   Impostazioni progetto → Account di servizio → Genera nuova chiave privata');
    console.error('   Salva il file come: serviceAccountKey.json nella root del progetto');
    process.exit(1);
}

if (getApps().length === 0) {
    const serviceAccount = require(serviceAccountPath);
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();

interface CalendarActivity {
    id: string;
    title: string;
    clientId?: string;
    clientIds?: string[];
    userId?: string;
    start?: string;
    end?: string;
    startTime?: string;
    endTime?: string;
    [key: string]: any;
}

interface Client {
    id: string;
    name: string;
}

async function main() {
    console.log('🔄 Caricamento dati da Firebase...');

    // Carica tutti i clienti
    const clientsSnapshot = await db.collection('clients').get();
    const clients: Client[] = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || ''
    }));
    console.log(`   ✅ ${clients.length} clienti trovati`);

    // Carica tutte le attività
    const activitiesSnapshot = await db.collection('calendarActivities').get();
    const activities: CalendarActivity[] = activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as CalendarActivity));
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
    const notFoundList: string[] = [];

    for (const activity of activitiesWithoutClient) {
        const title = activity.title || '';

        // Cerca il cliente nel titolo (cerca corrispondenze parziali)
        let foundClient: Client | undefined;

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
