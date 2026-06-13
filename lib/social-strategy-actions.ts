import { db } from './firebase';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import { SocialStrategy, Client, SocialProfile } from './data';
import { convertTimestamps, cleanData } from './actions';

const COLLECTION_NAME = 'social_strategies';

export const getSocialStrategies = async (): Promise<SocialStrategy[]> => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('generationDate', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...convertTimestamps(d.data()) } as SocialStrategy));
    } catch (error) {
        console.error('Error getting social strategies:', error);
        return [];
    }
};

export const getSocialStrategiesByClient = async (clientId: string): Promise<SocialStrategy[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('clientId', '==', clientId),
            orderBy('generationDate', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...convertTimestamps(d.data()) } as SocialStrategy));
    } catch (error) {
        console.error('Error getting social strategies by client:', error);
        return [];
    }
};

export const getSocialStrategy = async (id: string): Promise<SocialStrategy | null> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...convertTimestamps(docSnap.data()) } as SocialStrategy;
        }
        return null;
    } catch (error) {
        console.error('Error getting social strategy:', error);
        return null;
    }
};

export const addSocialStrategy = async (data: Omit<SocialStrategy, 'id'>): Promise<string> => {
    try {
        const cleanedData = cleanData({
            ...data,
            generationDate: data.generationDate || new Date().toISOString(),
        });
        const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
        return docRef.id;
    } catch (error) {
        console.error('Error adding social strategy:', error);
        throw error;
    }
};

export const updateSocialStrategy = async (id: string, data: Partial<SocialStrategy>): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const cleanedData = cleanData(data);
        await updateDoc(docRef, cleanedData);
    } catch (error) {
        console.error('Error updating social strategy:', error);
        throw error;
    }
};

export const deleteSocialStrategy = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error deleting social strategy:', error);
        throw error;
    }
};

export const updateClientSocialProfile = async (clientId: string, profile: SocialProfile): Promise<void> => {
    try {
        const docRef = doc(db, 'clients', clientId);
        await updateDoc(docRef, { socialProfile: profile });
    } catch (error) {
        console.error('Error updating client social profile:', error);
        throw error;
    }
};
