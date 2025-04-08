import { ref, set, onValue, off, DatabaseReference } from 'firebase/database';
import { realtimeDb } from '../config/firebase';
import { StickyNote } from '../types';

// Active subscriptions cache
const activeRtSubscriptions: Record<string, DatabaseReference> = {};

interface CursorData {
  x: number;
  y: number;
  pan: { x: number; y: number };
  lastUpdate: number;
}

/**
 * Subscribe to real-time cursors data
 * Returns an unsubscribe function
 */
export const subscribeToCursors = (
  sessionId: string,
  onCursorsUpdate: (cursors: Record<string, CursorData>) => void
) => {
  const path = `cursors/${sessionId}`;
  const cursorsRef = ref(realtimeDb, path);
  
  // Re-use existing subscription if available
  if (activeRtSubscriptions[path]) {
    console.log('Using existing cursors subscription');
    const existingRef = activeRtSubscriptions[path];
    onValue(existingRef, (snapshot) => {
      const data = snapshot.val() || {};
      onCursorsUpdate(data);
    });
    
    return () => {
      off(existingRef);
      delete activeRtSubscriptions[path];
    };
  }
  
  // Create new subscription
  console.log(`Creating new subscription for cursors in session ${sessionId}`);
  activeRtSubscriptions[path] = cursorsRef;
  
  onValue(cursorsRef, (snapshot) => {
    const data = snapshot.val() || {};
    onCursorsUpdate(data);
  });
  
  return () => {
    off(cursorsRef);
    delete activeRtSubscriptions[path];
  };
};

/**
 * Update cursor position with throttling
 * Using a closure to handle throttling per user
 */
export const createCursorUpdater = (sessionId: string, userId: string) => {
  let timeout: NodeJS.Timeout | null = null;
  let lastCursorData: CursorData | null = null;
  
  return (cursorData: CursorData) => {
    // Store the latest data
    lastCursorData = cursorData;
    
    if (timeout) return; // Skip if update is already pending
    
    // Immediate first update for responsiveness
    const updateCursor = async () => {
      if (!lastCursorData) return;
      
      const cursorDataToUpdate = { ...lastCursorData };
      const cursorRef = ref(realtimeDb, `cursors/${sessionId}/${userId}`);
      await set(cursorRef, cursorDataToUpdate);
      
      // Allow next update after timeout
      timeout = null;
      
      // If there's been a position change during the update, schedule another update
      if (lastCursorData.x !== cursorDataToUpdate.x || 
          lastCursorData.y !== cursorDataToUpdate.y ||
          lastCursorData.pan.x !== cursorDataToUpdate.pan.x ||
          lastCursorData.pan.y !== cursorDataToUpdate.pan.y) {
        setTimeout(updateCursor, 30); // 30ms throttle for snappier cursor updates
      }
    };
    
    // Start the update cycle if not already running
    if (!timeout) {
      timeout = setTimeout(updateCursor, 0);
    }
  };
};

/**
 * Subscribe to notes moving status
 * This tracks which notes are being moved in real-time
 */
export const subscribeToNotesMoving = (
  sessionId: string,
  onNotesMovingUpdate: (notesMoving: Record<string, string | null>) => void
) => {
  const path = `notesMoving/${sessionId}`;
  const notesMovingRef = ref(realtimeDb, path);
  
  // Re-use existing subscription if available
  if (activeRtSubscriptions[path]) {
    console.log('Using existing notes moving subscription');
    const existingRef = activeRtSubscriptions[path];
    onValue(existingRef, (snapshot) => {
      const data = snapshot.val() || {};
      onNotesMovingUpdate(data);
    });
    
    return () => {
      off(existingRef);
      delete activeRtSubscriptions[path];
    };
  }
  
  // Create new subscription
  console.log(`Creating new subscription for notes moving in session ${sessionId}`);
  activeRtSubscriptions[path] = notesMovingRef;
  
  onValue(notesMovingRef, (snapshot) => {
    const data = snapshot.val() || {};
    onNotesMovingUpdate(data);
  });
  
  return () => {
    off(notesMovingRef);
    delete activeRtSubscriptions[path];
  };
};

/**
 * Set note moving status
 */
export const setNoteMovingStatus = async (
  sessionId: string,
  noteId: string,
  userId: string | null
): Promise<void> => {
  const noteMovingRef = ref(realtimeDb, `notesMoving/${sessionId}/${noteId}`);
  await set(noteMovingRef, userId);
};

/**
 * Update note position while moving with throttling
 */
export const createNotePositionUpdater = (sessionId: string, noteId: string) => {
  let timeout: NodeJS.Timeout | null = null;
  let lastPosition: { x: number, y: number } | null = null;
  let lastUpdateTime = 0;
  
  return (x: number, y: number) => {
    // Store the last position to use when drag ends
    lastPosition = { x, y };
    
    const now = Date.now();
    if (timeout || now - lastUpdateTime < 16) return; // Skip if update pending or too soon (16ms = ~60fps)
    
    const updatePosition = async () => {
      if (!lastPosition) return;
      
      const positionToUpdate = { ...lastPosition };
      const positionRef = ref(realtimeDb, `notesPosition/${sessionId}/${noteId}`);
      await set(positionRef, positionToUpdate);
      
      lastUpdateTime = Date.now();
      timeout = null;
      
      // If position changed during update, schedule another update
      if (lastPosition.x !== positionToUpdate.x || lastPosition.y !== positionToUpdate.y) {
        setTimeout(updatePosition, 16); // 16ms = ~60fps for smooth appearance
      }
    };
    
    // Start the update cycle if not already running
    if (!timeout) {
      timeout = setTimeout(updatePosition, 0);
    }
  };
};

/**
 * Subscribe to notes position updates during dragging
 */
export const subscribeToNotesPosition = (
  sessionId: string,
  onNotesPositionUpdate: (positions: Record<string, {x: number, y: number}>) => void
) => {
  const path = `notesPosition/${sessionId}`;
  const notesPositionRef = ref(realtimeDb, path);
  
  // Re-use existing subscription if available
  if (activeRtSubscriptions[path]) {
    console.log('Using existing notes position subscription');
    const existingRef = activeRtSubscriptions[path];
    onValue(existingRef, (snapshot) => {
      const data = snapshot.val() || {};
      onNotesPositionUpdate(data);
    });
    
    return () => {
      off(existingRef);
      delete activeRtSubscriptions[path];
    };
  }
  
  // Create new subscription
  console.log(`Creating new subscription for notes position in session ${sessionId}`);
  activeRtSubscriptions[path] = notesPositionRef;
  
  onValue(notesPositionRef, (snapshot) => {
    const data = snapshot.val() || {};
    onNotesPositionUpdate(data);
  });
  
  return () => {
    off(notesPositionRef);
    delete activeRtSubscriptions[path];
  };
};

/**
 * Subscribe to session's revealed status
 */
export const subscribeToSessionRevealed = (
  sessionId: string,
  onRevealedUpdate: (isRevealed: boolean) => void
) => {
  const path = `sessions/${sessionId}/isRevealed`;
  const revealedRef = ref(realtimeDb, path);
  
  // Re-use existing subscription if available
  if (activeRtSubscriptions[path]) {
    console.log('Using existing revealed status subscription');
    const existingRef = activeRtSubscriptions[path];
    onValue(existingRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Database revealed value:', data, 'Type:', typeof data);
      onRevealedUpdate(data === true);
    });
    
    return () => {
      off(existingRef);
      delete activeRtSubscriptions[path];
    };
  }
  
  // Create new subscription
  console.log(`Creating new subscription for revealed status in session ${sessionId}`);
  activeRtSubscriptions[path] = revealedRef;
  
  onValue(revealedRef, (snapshot) => {
    const data = snapshot.val();
    console.log('Database revealed value:', data, 'Type:', typeof data);
    onRevealedUpdate(data === true);
  });
  
  return () => {
    off(revealedRef);
    delete activeRtSubscriptions[path];
  };
};

/**
 * Set session reveal status in realtime DB
 */
export const toggleSessionReveal = async (
  sessionId: string,
  newRevealStatus: boolean
): Promise<void> => {
  const revealedRef = ref(realtimeDb, `sessions/${sessionId}/isRevealed`);
  await set(revealedRef, newRevealStatus);
};

/**
 * Subscribe to all sticky notes
 */
export const subscribeToStickyNotes = (
  sessionId: string,
  onStickyNotesUpdate: (stickyNotes: Record<string, StickyNote>) => void
) => {
  const path = `stickyNotes/${sessionId}`;
  const notesRef = ref(realtimeDb, path);
  
  // Re-use existing subscription if available
  if (activeRtSubscriptions[path]) {
    console.log('Using existing sticky notes subscription');
    const existingRef = activeRtSubscriptions[path];
    onValue(existingRef, (snapshot) => {
      const data = snapshot.val() || {};
      onStickyNotesUpdate(data);
    });
    
    return () => {
      off(existingRef);
      delete activeRtSubscriptions[path];
    };
  }
  
  // Create new subscription
  console.log(`Creating new subscription for sticky notes in session ${sessionId}`);
  activeRtSubscriptions[path] = notesRef;
  
  onValue(notesRef, (snapshot) => {
    const data = snapshot.val() || {};
    onStickyNotesUpdate(data);
  });
  
  return () => {
    off(notesRef);
    delete activeRtSubscriptions[path];
  };
};

/**
 * Add a sticky note to realtime DB
 */
export const addStickyNote = async (
  sessionId: string,
  note: StickyNote
): Promise<void> => {
  const noteRef = ref(realtimeDb, `stickyNotes/${sessionId}/${note.id}`);
  await set(noteRef, note);
};

/**
 * Update sticky note content directly in realtime DB
 */
export const updateStickyNoteContent = async (
  sessionId: string,
  noteId: string,
  content: string
): Promise<void> => {
  const contentRef = ref(realtimeDb, `stickyNotes/${sessionId}/${noteId}/content`);
  await set(contentRef, content);
};

/**
 * Create a note content updater with debouncing
 */
export const createNoteContentUpdater = (sessionId: string, noteId: string) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (content: string) => {
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(async () => {
      await updateStickyNoteContent(sessionId, noteId, content);
      timeout = null;
    }, 500); // 500ms debounce
  };
};

/**
 * Set final note position in realtime DB
 */
export const setFinalNotePosition = async (
  sessionId: string,
  noteId: string,
  position: { x: number, y: number }
): Promise<void> => {
  // First update the permanent position in the main sticky note data
  const stickyNotePositionRef = ref(realtimeDb, `stickyNotes/${sessionId}/${noteId}/position`);
  await set(stickyNotePositionRef, position);
  
  // Also update in the notesPosition path to ensure all clients are in sync
  const positionRef = ref(realtimeDb, `notesPosition/${sessionId}/${noteId}`);
  await set(positionRef, position);
};

/**
 * Delete sticky note from realtime DB
 */
export const deleteStickyNote = async (
  sessionId: string,
  noteId: string
): Promise<void> => {
  const noteRef = ref(realtimeDb, `stickyNotes/${sessionId}/${noteId}`);
  await set(noteRef, null);
}; 