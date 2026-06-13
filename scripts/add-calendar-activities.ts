#!/usr/bin/env ts-node

/**
 * Script per aggiungere le attività di calendario predefinite
 * Esegui con: npx ts-node scripts/add-calendar-activities.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inizializza Firebase Admin
const serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

// Definizione delle attività da aggiungere
const calendarActivities = [
    { name: 'Stories', color: '#FF6B6B', defaultDuration: 30, hourlyRate: 25 },
    { name: 'Analisi e Strategia', color: '#4ECDC4', defaultDuration: 120, hourlyRate: 50 },
    { name: 'Community Management (Risposte messaggi, recensioni)', color: '#95E1D3', defaultDuration: 60, hourlyRate: 30 },
    { name: 'Campagne ADV', color: '#F38181', defaultDuration: 90, hourlyRate: 45 },
    { name: 'Programmazione', color: '#AA96DA', defaultDuration: 45, hourlyRate: 35 },
    { name: 'Coordinamento con il cliente', color: '#FCBAD3', defaultDuration: 60, hourlyRate: 40 },
    { name: 'Moodboard', color: '#FFFFD2', defaultDuration: 90, hourlyRate: 35 },
    { name: 'Check Siti e Gmb', color: '#A8D8EA', defaultDuration: 30, hourlyRate: 30 },
    { name: 'Check grafiche', color: '#FFD93D', defaultDuration: 45, hourlyRate: 35 },
    { name: 'Stesura piano editoriale', color: '#6BCB77', defaultDuration: 120, hourlyRate: 40 },
    { name: 'Scrittura copy', color: '#4D96FF', defaultDuration: 60, hourlyRate: 35 },
    { name: 'Shooting', color: '#FF6B9D', defaultDuration: 180, hourlyRate: 50 },
    { name: 'Scrittura articoli', color: '#C1BDDB', defaultDuration: 120, hourlyRate: 40 },
    { name: 'Montaggio video', color: '#FFA07A', defaultDuration: 180, hourlyRate: 45 },
    { name: 'Editing foto', color: '#98D8C8', defaultDuration: 90, hourlyRate: 35 },
    { name: 'Coordinamento interno', color: '#F7DC6F', defaultDuration: 45, hourlyRate: 35 }
];

async function addCalendarActivityPresets() {
    console.log('🚀 Inizio aggiunta attività di calendario...\n');

    try {
        // Verifica se esistono già attività con gli stessi nomi
        const existingPresets = await db.collection('calendarActivityPresets').get();
        const existingNames = new Set(existingPresets.docs.map(doc => doc.data().name));

        let addedCount = 0;
        let skippedCount = 0;

        for (const activity of calendarActivities) {
            if (existingNames.has(activity.name)) {
                console.log(`⏭️  Saltata: "${activity.name}" (già esistente)`);
                skippedCount++;
                continue;
            }

            await db.collection('calendarActivityPresets').add({
                name: activity.name,
                description: '',
                color: activity.color,
                defaultDuration: activity.defaultDuration,
                hourlyRate: activity.hourlyRate
            });

            console.log(`✅ Aggiunta: "${activity.name}" (${activity.defaultDuration} min, €${activity.hourlyRate}/h)`);
            addedCount++;
        }

        console.log(`\n📊 Riepilogo:`);
        console.log(`   ✅ Aggiunte: ${addedCount}`);
        console.log(`   ⏭️  Saltate: ${skippedCount}`);
        console.log(`   📝 Totale: ${calendarActivities.length}`);
        console.log('\n✨ Operazione completata con successo!');

    } catch (error) {
        console.error('❌ Errore durante l\'aggiunta delle attività:', error);
        process.exit(1);
    }
}

// Esegui lo script
addCalendarActivityPresets()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Errore fatale:', error);
        process.exit(1);
    });
