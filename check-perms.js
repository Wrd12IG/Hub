
import { db } from './lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function checkData() {
    console.log("Checking Users...");
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.forEach(doc => {
        const data = doc.data();
        console.log(`User: ${data.name}, Role: [${data.role}]`);
    });

    console.log("\nChecking Role Permissions...");
    const permsSnap = await getDocs(collection(db, 'rolePermissions'));
    permsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`Role Doc ID: [${doc.id}], Permissions: ${JSON.stringify(data.permissions)}`);
    });
}

checkData().catch(console.error);
