/**
 * Script per verificare il range temporale dei dati
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
    console.log('🔄 Analisi date dei dati...\n');

    // Task
    const tasksSnapshot = await db.collection('tasks').get();
    const taskDates = [];
    tasksSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.dueDate) taskDates.push(new Date(data.dueDate));
        if (data.createdAt) {
            const created = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
            taskDates.push(created);
        }
    });

    taskDates.sort((a, b) => a - b);

    console.log('📋 TASK:');
    console.log(`   Totale: ${tasksSnapshot.size}`);
    if (taskDates.length > 0) {
        console.log(`   Data più vecchia: ${taskDates[0].toISOString().split('T')[0]}`);
        console.log(`   Data più recente: ${taskDates[taskDates.length - 1].toISOString().split('T')[0]}`);
    }

    // Attività Calendario
    const activitiesSnapshot = await db.collection('calendarActivities').get();
    const activityDates = [];
    activitiesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const start = data.startTime || data.start;
        if (start) activityDates.push(new Date(start));
    });

    activityDates.sort((a, b) => a - b);

    console.log('\n📆 ATTIVITÀ CALENDARIO:');
    console.log(`   Totale: ${activitiesSnapshot.size}`);
    if (activityDates.length > 0) {
        console.log(`   Data più vecchia: ${activityDates[0].toISOString().split('T')[0]}`);
        console.log(`   Data più recente: ${activityDates[activityDates.length - 1].toISOString().split('T')[0]}`);
    }

    // Distribuzione per mese
    console.log('\n📊 DISTRIBUZIONE PER MESE (Attività Calendario):');
    const byMonth = {};
    activityDates.forEach(d => {
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonth[month] = (byMonth[month] || 0) + 1;
    });

    Object.keys(byMonth).sort().forEach(month => {
        console.log(`   ${month}: ${byMonth[month]} attività`);
    });

    // Distribuzione Task per mese
    console.log('\n📊 DISTRIBUZIONE PER MESE (Task con timeSpent > 0):');
    const taskByMonth = {};
    tasksSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.timeSpent > 0 && data.dueDate) {
            const d = new Date(data.dueDate);
            const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            taskByMonth[month] = (taskByMonth[month] || 0) + 1;
        }
    });

    Object.keys(taskByMonth).sort().forEach(month => {
        console.log(`   ${month}: ${taskByMonth[month]} task`);
    });
}

main().catch(console.error);
