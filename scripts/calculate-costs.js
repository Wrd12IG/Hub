/**
 * Script per calcolare i costi totali per cliente
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

// Formatta valuta in italiano
function formatCurrency(value) {
    const fixed = value.toFixed(2);
    const [intPart, decPart] = fixed.split('.');
    const intWithThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `€${intWithThousands},${decPart}`;
}

async function main() {
    console.log('🔄 Caricamento dati da Firebase...\n');

    // Carica utenti
    const usersSnapshot = await db.collection('users').get();
    const usersById = {};
    usersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        usersById[doc.id] = {
            id: doc.id,
            name: data.name || 'N/D',
            hourlyRate: parseFloat(String(data.hourlyRate || 0).replace(',', '.')) || 0
        };
    });
    console.log(`   ✅ ${Object.keys(usersById).length} utenti caricati`);

    // Carica clienti
    const clientsSnapshot = await db.collection('clients').get();
    const clientsById = {};
    clientsSnapshot.docs.forEach(doc => {
        clientsById[doc.id] = { id: doc.id, name: doc.data().name || 'N/D' };
    });
    console.log(`   ✅ ${Object.keys(clientsById).length} clienti caricati`);

    // Carica task
    const tasksSnapshot = await db.collection('tasks').get();
    const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`   ✅ ${tasks.length} task caricati`);

    // Carica attività
    const activitiesSnapshot = await db.collection('calendarActivities').get();
    const activities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`   ✅ ${activities.length} attività caricate`);

    // Calcola costi
    const costsByClient = {};
    const hoursByClient = {};
    let taskCostTotal = 0;
    let activityCostTotal = 0;
    let taskCount = 0;
    let activityCount = 0;

    // --- TASK ---
    tasks.forEach(task => {
        if (task.clientId && task.timeSpent > 0 && task.assignedUserId) {
            const hours = task.timeSpent / 3600;
            const user = usersById[task.assignedUserId];
            const hourlyRate = user?.hourlyRate || 0;
            const cost = hours * hourlyRate;

            costsByClient[task.clientId] = (costsByClient[task.clientId] || 0) + cost;
            hoursByClient[task.clientId] = (hoursByClient[task.clientId] || 0) + hours;
            taskCostTotal += cost;
            taskCount++;
        }
    });

    // --- ATTIVITÀ ---
    activities.forEach(activity => {
        const start = activity.startTime || activity.start;
        const end = activity.endTime || activity.end;
        if (!start || !end || !activity.userId) return;

        const startDate = new Date(start);
        const endDate = new Date(end);
        const durationHours = (endDate - startDate) / (1000 * 60 * 60);

        if (durationHours <= 0) return;

        let clientIds = [];
        if (activity.clientIds && activity.clientIds.length > 0) {
            clientIds = activity.clientIds;
        } else if (activity.clientId) {
            clientIds = [activity.clientId];
        }

        if (clientIds.length === 0) return;

        const user = usersById[activity.userId];
        const hourlyRate = user?.hourlyRate || 0;
        const cost = durationHours * hourlyRate;

        const numClients = clientIds.length;
        const perClientHours = durationHours / numClients;
        const perClientCost = cost / numClients;

        clientIds.forEach(clientId => {
            costsByClient[clientId] = (costsByClient[clientId] || 0) + perClientCost;
            hoursByClient[clientId] = (hoursByClient[clientId] || 0) + perClientHours;
        });

        activityCostTotal += cost;
        activityCount++;
    });

    // Ordina per costo decrescente
    const sortedClients = Object.entries(costsByClient)
        .map(([clientId, cost]) => ({
            clientId,
            name: clientsById[clientId]?.name || 'N/D',
            cost,
            hours: hoursByClient[clientId] || 0
        }))
        .sort((a, b) => b.cost - a.cost);

    // Output
    console.log('\n' + '='.repeat(70));
    console.log('\n📊 COSTI PER CLIENTE (Task + Attività Calendario)\n');
    console.log('='.repeat(70));

    console.log(`\n${'Cliente'.padEnd(30)} ${'Ore'.padStart(10)} ${'Costo'.padStart(15)}`);
    console.log('-'.repeat(70));

    let grandTotal = 0;
    let grandHours = 0;

    sortedClients.forEach(client => {
        console.log(`${client.name.substring(0, 29).padEnd(30)} ${client.hours.toFixed(1).padStart(10)} ${formatCurrency(client.cost).padStart(15)}`);
        grandTotal += client.cost;
        grandHours += client.hours;
    });

    console.log('-'.repeat(70));
    console.log(`${'TOTALE'.padEnd(30)} ${grandHours.toFixed(1).padStart(10)} ${formatCurrency(grandTotal).padStart(15)}`);

    console.log('\n' + '='.repeat(70));
    console.log('\n📈 RIEPILOGO:');
    console.log(`   Task conteggiati: ${taskCount}`);
    console.log(`   Attività conteggiate: ${activityCount}`);
    console.log(`   Costo da Task: ${formatCurrency(taskCostTotal)}`);
    console.log(`   Costo da Attività: ${formatCurrency(activityCostTotal)}`);
    console.log(`   TOTALE GENERALE: ${formatCurrency(grandTotal)}`);
    console.log('='.repeat(70));
}

main().catch(console.error);
