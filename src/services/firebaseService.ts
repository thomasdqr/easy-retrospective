import { doc, setDoc, updateDoc, onSnapshot, Unsubscribe, deleteField } from 'firebase/firestore';
import { db } from '../config/firebase';
import { User } from '../types';

// Cache for active subscriptions to avoid duplicate subscriptions
const activeSubscriptions: Record<string, Unsubscribe> = {};

// Cache for session data to minimize UI updates
type SessionBasicInfoCache = {
  id: string;
  createdAt: number;
  users: Record<string, User>;
};

const sessionCache: Record<string, SessionBasicInfoCache> = {};

/**
 * Subscribe to a session basic info with a single subscription
 * Returns an unsubscribe function
 */
export const subscribeToSessionBasicInfo = (
  sessionId: string,
  onSessionBasicInfoUpdate: (sessionBasicInfo: { id: string, createdAt: number, users: Record<string, User> }) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  // Re-use existing subscription if available
  if (activeSubscriptions[sessionId]) {
    console.log('Using existing session basic info subscription');
    return activeSubscriptions[sessionId];
  }

  console.log(`Creating new subscription for session basic info ${sessionId}`);
  const sessionDoc = doc(db, 'sessions', sessionId);
  
  const unsubscribe = onSnapshot(
    sessionDoc, 
    (snapshot) => {
      const data = snapshot.data();
      if (!data) {
        onError(new Error('Session not found'));
        return;
      }
      
      const basicInfo = {
        id: data.id,
        createdAt: data.createdAt,
        users: data.users || {}
      };
      
      // Only update if data has changed
      if (JSON.stringify(sessionCache[sessionId]) !== JSON.stringify(basicInfo)) {
        sessionCache[sessionId] = basicInfo;
        onSessionBasicInfoUpdate(basicInfo);
      }
    },
    (error) => {
      console.error('Error subscribing to session basic info:', error);
      onError(error);
    }
  );
  
  // Store the unsubscribe function
  activeSubscriptions[sessionId] = unsubscribe;
  
  return () => {
    unsubscribe();
    delete activeSubscriptions[sessionId];
    delete sessionCache[sessionId];
  };
};

/**
 * Create a new session with basic info only
 */
export const createSession = async (sessionId: string): Promise<boolean> => {
  try {
    const sessionData = {
      id: sessionId,
      createdAt: Date.now(),
      users: {}
    };
    
    await setDoc(doc(db, 'sessions', sessionId), sessionData);
    
    // Also initialize revealed status in realtime DB
    // Import is placed here to avoid circular dependency
    const { set, ref, get } = await import('firebase/database');
    const { realtimeDb } = await import('../config/firebase');
    const revealedRef = ref(realtimeDb, `sessions/${sessionId}/isRevealed`);
    await set(revealedRef, true);

    // Verify the session was actually created in Firestore
    const { getDoc } = await import('firebase/firestore');
    const sessionDoc = doc(db, 'sessions', sessionId);
    const docSnap = await getDoc(sessionDoc);
    
    return docSnap.exists();
  } catch (error) {
    console.error('Error creating session:', error);
    return false;
  }
};

/**
 * Update session basic info
 */
export const updateSessionBasicInfo = async (
  sessionId: string, 
  updates: Partial<{ id: string, createdAt: number, users: Record<string, User> }>
): Promise<void> => {
  const sessionDoc = doc(db, 'sessions', sessionId);
  await updateDoc(sessionDoc, updates);
};

/**
 * Add a user to a session
 */
export const addUserToSession = async (
  sessionId: string,
  userId: string,
  userData: User
): Promise<void> => {
  const updates = {
    [`users.${userId}`]: userData
  };
  
  await updateSessionBasicInfo(sessionId, updates);
};

/**
 * Remove a user from a session
 */
export const removeUserFromSession = async (
  sessionId: string,
  userId: string
): Promise<void> => {
  const sessionDoc = doc(db, 'sessions', sessionId);
  await updateDoc(sessionDoc, {
    [`users.${userId}`]: deleteField()
  });
}; 