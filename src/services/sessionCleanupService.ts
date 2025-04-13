import { collection, query, where, getDocs, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, set, get } from 'firebase/database';
import { db, realtimeDb } from '../config/firebase';

// Number of hours after which sessions are considered old and can be deleted
export const SESSION_CLEANUP_HOURS = 48;

/**
 * Delete a specific session and all its related data
 * @param sessionId The ID of the session to delete
 */
export const deleteSession = async (sessionId: string): Promise<void> => {
  try {
    console.log(`Deleting session: ${sessionId}`);
    
    // 1. Delete Firestore session document
    const sessionDoc = doc(db, 'sessions', sessionId);
    await deleteDoc(sessionDoc);
    
    // 2. Delete Realtime Database data for this session
    // Based on database.rules.json, we need to clean up the following paths:
    const paths = [
      `sessions/${sessionId}`,
      `columns/${sessionId}`,
      `stickyNotes/${sessionId}`,
      `notesPosition/${sessionId}`,
      `notesMoving/${sessionId}`,
      `notesEditing/${sessionId}`,
      `cursors/${sessionId}`,
      `drawings/${sessionId}`
    ];
    
    // Delete each path in Realtime Database
    const deletePromises = paths.map(async (path) => {
      const dbRef = ref(realtimeDb, path);
      await set(dbRef, null);
    });
    
    await Promise.all(deletePromises);
      } catch (error) {
    console.error(`Error deleting session ${sessionId}:`, error);
    throw error;
  }
};

/**
 * Check if a session exists in Firestore
 * @param sessionId The ID of the session to check
 * @returns true if the session exists, false otherwise
 */
const sessionExistsInFirestore = async (sessionId: string): Promise<boolean> => {
  const sessionDoc = doc(db, 'sessions', sessionId);
  const docSnap = await getDoc(sessionDoc);
  return docSnap.exists();
};

/**
 * Clean up orphaned sessions in the Realtime Database that no longer exist in Firestore
 */
export const cleanupOrphanedSessions = async (): Promise<number> => {
  try {
    let deletedCount = 0;
    
    // Get all the main realtime DB paths that contain session data
    const mainPaths = [
      'sessions',
      'columns',
      'stickyNotes',
      'notesPosition',
      'notesMoving',
      'notesEditing',
      'cursors',
      'drawings'
    ];
    
    // For each path, fetch all session IDs and check if they exist in Firestore
    for (const mainPath of mainPaths) {
      const pathRef = ref(realtimeDb, mainPath);
      const snapshot = await get(pathRef);
      
      if (!snapshot.exists()) continue;
      
      const data = snapshot.val();
      const sessionIds = Object.keys(data);
      
      console.log(`Found ${sessionIds.length} sessions in path ${mainPath}`);
      
      for (const sessionId of sessionIds) {
        // Check if this session exists in Firestore
        const exists = await sessionExistsInFirestore(sessionId);
        
        if (!exists) {
          console.log(`Found orphaned session ${sessionId} in path ${mainPath}`);
          // Delete this orphaned session data
          const sessionPathRef = ref(realtimeDb, `${mainPath}/${sessionId}`);
          await set(sessionPathRef, null);
          
          // Only count unique sessions
          if (mainPath === 'sessions') {
            deletedCount++;
          }
        }
      }
    }
    
    console.log(`Successfully cleaned up ${deletedCount} orphaned sessions`);
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up orphaned sessions:', error);
    throw error;
  }
};

/**
 * Delete all sessions that are older than the specified number of hours
 * @param hours Number of hours after which sessions should be deleted (default: SESSION_CLEANUP_HOURS)
 */
export const cleanupOldSessions = async (hours: number = SESSION_CLEANUP_HOURS): Promise<number> => {
  try {
    console.log(`Cleaning up sessions older than ${hours} hours`);
    let oldSessionsCount = 0;
    
    // Calculate the timestamp for sessions older than specified hours
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    
    // Query Firestore for old sessions
    const sessionsRef = collection(db, 'sessions');
    const oldSessionsQuery = query(sessionsRef, where('createdAt', '<', cutoffTime));
    const oldSessionsSnapshot = await getDocs(oldSessionsQuery);
    
    if (!oldSessionsSnapshot.empty) {
      console.log(`Found ${oldSessionsSnapshot.size} old sessions to delete`);
      
      // Delete each old session and its related data
      const deletePromises = oldSessionsSnapshot.docs.map(async (sessionDoc) => {
        const sessionId = sessionDoc.id;
        await deleteSession(sessionId);
      });
      
      await Promise.all(deletePromises);
      oldSessionsCount = oldSessionsSnapshot.size;
    } else {
      console.log('No old sessions found to clean up');
    }
    
    // Always clean up orphaned sessions, regardless of whether there were old sessions
    const orphanedCount = await cleanupOrphanedSessions();
    
    console.log(`Session cleanup complete: ${oldSessionsCount} old sessions, ${orphanedCount} orphaned sessions`);
    return oldSessionsCount + orphanedCount;
  } catch (error) {
    console.error('Error cleaning up old sessions:', error);
    throw error;
  }
}; 