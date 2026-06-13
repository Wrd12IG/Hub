
import { db } from '../lib/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { createNotification } from '../lib/notifications';

async function sendTest() {
    console.log('Fetching users...');
    try {
        console.log('DB Type:', db?.type); // Check DB
        // Try to find an admin first
        let q = query(collection(db, 'users'), where('role', '==', 'Amministratore'), limit(1));
        let snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log('No admin found, fetching any user...');
            q = query(collection(db, 'users'), limit(1));
            snapshot = await getDocs(q);
        }

        if (snapshot.empty) {
            console.error('No users found in database!');
            return;
        }

        const userDoc = snapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();

        console.log(`Sending notification to user: ${userData.name || 'Unknown'} (${userId})`);

        await createNotification(
            userId,
            'task_assigned', // Use a generic type
            {
                taskTitle: 'Test Notifica Hub',
                assignedBy: 'System Admin',
                priority: 'Alta',
                dueDate: new Date().toISOString()
            },
            {
                link: '/tasks',
                skipEmail: true, // Don't spam email for this test, focus on UI
                skipChat: true
            }
        );

        console.log('Notification sent successfully! Check your header icon.');
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

sendTest().then(() => process.exit(0));
