import { ref, set, onValue, off, DatabaseReference, get, DataSnapshot } from 'firebase/database';
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

interface IcebreakerStatement {
  text: string;
  isLie: boolean;
  revealed: boolean;
}

interface IcebreakerPlayerState {
  statements: {
    "0": IcebreakerStatement;
    "1": IcebreakerStatement;
    "2": IcebreakerStatement;
  };
  votes: Record<string, number>; // userId -> statementIndex voted as lie
  score?: number;
  statementOrder?: number[]; // Order of statements for this player (shuffled)
}

interface IcebreakerState {
  users: Record<string, IcebreakerPlayerState>;
  activeUser: string | null;
  revealed: boolean;
  completed?: boolean;
  finalLeaderboard?: boolean;
  retrospectiveStarted?: boolean;
}

/**
 * Drawing path interface
 */
export interface DrawingPath {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  authorId: string;
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
  let lastPosition: { x: number, y: number } | null = null;
  
  return (x: number, y: number) => {
    // Store the last position to use when drag ends
    lastPosition = { x, y };
    
    const updatePosition = async () => {
      if (!lastPosition) return;
      
      const positionToUpdate = { ...lastPosition };
      const positionRef = ref(realtimeDb, `notesPosition/${sessionId}/${noteId}`);
      
      try {
        await set(positionRef, positionToUpdate);
      } catch (error) {
        console.error("Error updating note position:", error);
      }
    };
    
    // Use requestAnimationFrame to batch updates with the browser's render cycle
    requestAnimationFrame(updatePosition);
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
 * Subscribe to sticky notes in a session
 */
export const subscribeToStickyNotes = (
  sessionId: string,
  onStickyNotesUpdate: (stickyNotes: Record<string, StickyNote>) => void
) => {
  const path = `stickyNotes/${sessionId}`;
  const stickyNotesRef = ref(realtimeDb, path);
  
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
  activeRtSubscriptions[path] = stickyNotesRef;
  
  onValue(stickyNotesRef, (snapshot) => {
    const data = snapshot.val() || {};
    onStickyNotesUpdate(data);
  });
  
  return () => {
    off(stickyNotesRef);
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

/**
 * Update the color of a sticky note
 */
export const updateStickyNoteColor = async (
  sessionId: string,
  noteId: string,
  color: string
): Promise<void> => {
  const noteColorRef = ref(realtimeDb, `stickyNotes/${sessionId}/${noteId}/color`);
  await set(noteColorRef, color);
};

/**
 * Subscribe to columns in a session
 */
export const subscribeToColumns = (
  sessionId: string,
  onColumnsUpdate: (columns: Record<string, import('../types').Column>) => void
) => {
  const path = `columns/${sessionId}`;
  const columnsRef = ref(realtimeDb, path);
  
  // Re-use existing subscription if available
  if (activeRtSubscriptions[path]) {
    console.log('Using existing columns subscription');
    const existingRef = activeRtSubscriptions[path];
    onValue(existingRef, (snapshot) => {
      const data = snapshot.val() || {};
      onColumnsUpdate(data);
    });
    
    return () => {
      off(existingRef);
      delete activeRtSubscriptions[path];
    };
  }
  
  // Create new subscription
  console.log(`Creating new subscription for columns in session ${sessionId}`);
  activeRtSubscriptions[path] = columnsRef;
  
  onValue(columnsRef, (snapshot) => {
    const data = snapshot.val() || {};
    onColumnsUpdate(data);
  });
  
  return () => {
    off(columnsRef);
    delete activeRtSubscriptions[path];
  };
};

/**
 * Initialize columns for a new session
 */
export const initializeColumns = async (
  sessionId: string,
  columns: import('../types').Column[]
): Promise<void> => {
  const columnsObj = columns.reduce((acc, column) => {
    acc[column.id] = column;
    return acc;
  }, {} as Record<string, import('../types').Column>);
  
  const columnsRef = ref(realtimeDb, `columns/${sessionId}`);
  await set(columnsRef, columnsObj);
};

/**
 * Add a new column to realtime DB
 */
export const addColumn = async (
  sessionId: string,
  column: import('../types').Column
): Promise<void> => {
  const columnRef = ref(realtimeDb, `columns/${sessionId}/${column.id}`);
  await set(columnRef, column);
};

/**
 * Update a column in realtime DB
 */
export const updateColumn = async (
  sessionId: string,
  columnId: string,
  updates: Partial<import('../types').Column>
): Promise<void> => {
  Object.entries(updates).forEach(async ([key, value]) => {
    const updateRef = ref(realtimeDb, `columns/${sessionId}/${columnId}/${key}`);
    await set(updateRef, value);
  });
};

/**
 * Delete a column from realtime DB
 */
export const deleteColumn = async (
  sessionId: string,
  columnId: string
): Promise<void> => {
  const columnRef = ref(realtimeDb, `columns/${sessionId}/${columnId}`);
  await set(columnRef, null);
};

/**
 * Subscribe to notes editing status
 * This tracks which notes are being edited in real-time
 */
export const subscribeToNotesEditing = (
  sessionId: string,
  onNotesEditingUpdate: (notesEditing: Record<string, string | null>) => void
) => {
  const path = `notesEditing/${sessionId}`;
  const notesEditingRef = ref(realtimeDb, path);
  
  // Re-use existing subscription if available
  if (activeRtSubscriptions[path]) {
    console.log('Using existing notes editing subscription');
    const existingRef = activeRtSubscriptions[path];
    onValue(existingRef, (snapshot) => {
      const data = snapshot.val() || {};
      onNotesEditingUpdate(data);
    });
    
    return () => {
      off(existingRef);
      delete activeRtSubscriptions[path];
    };
  }
  
  // Create new subscription
  console.log(`Creating new subscription for notes editing in session ${sessionId}`);
  activeRtSubscriptions[path] = notesEditingRef;
  
  onValue(notesEditingRef, (snapshot) => {
    const data = snapshot.val() || {};
    onNotesEditingUpdate(data);
  });
  
  return () => {
    off(notesEditingRef);
    delete activeRtSubscriptions[path];
  };
};

/**
 * Set note editing status
 */
export const setNoteEditingStatus = async (
  sessionId: string,
  noteId: string,
  userId: string | null
): Promise<void> => {
  const noteEditingRef = ref(realtimeDb, `notesEditing/${sessionId}/${noteId}`);
  await set(noteEditingRef, userId);
};

// Icebreaker state functions
export const updateIcebreakerState = async (sessionId: string, state: IcebreakerState) => {
  const dbRef = ref(realtimeDb, `sessions/${sessionId}/icebreaker`);
  await set(dbRef, state);
};

export const subscribeToIcebreakerState = (sessionId: string, callback: (state: IcebreakerState) => void) => {
  const dbRef = ref(realtimeDb, `sessions/${sessionId}/icebreaker`);
  
  const unsubscribe = onValue(dbRef, (snapshot) => {
    callback(snapshot.val());
  });

  return unsubscribe;
};

/**
 * Toggle voting phase in realtime DB
 */
export const toggleVotingPhase = async (
  sessionId: string,
  votingPhase: boolean
): Promise<void> => {
  const votingRef = ref(realtimeDb, `sessions/${sessionId}/votingPhase`);
  await set(votingRef, votingPhase);
};

/**
 * Subscribe to voting phase status
 */
export const subscribeToVotingPhase = (
  sessionId: string,
  callback: (votingPhase: boolean) => void
): (() => void) => {
  const votingRef = ref(realtimeDb, `sessions/${sessionId}/votingPhase`);
  
  const handleValueChange = (snapshot: DataSnapshot) => {
    const isVoting = snapshot.val();
    callback(isVoting === true);
  };
  
  onValue(votingRef, handleValueChange);
  
  return () => off(votingRef, 'value', handleValueChange);
};

/**
 * Vote for a sticky note
 */
export const toggleVoteForStickyNote = async (
  sessionId: string,
  noteId: string,
  userId: string
): Promise<void> => {
  // Get current votes first
  const votesRef = ref(realtimeDb, `stickyNotes/${sessionId}/${noteId}/votes`);
  const votesSnapshot = await get(votesRef);
  const votes = votesSnapshot.val() || {};
  
  // Toggle the vote (add or remove)
  if (votes[userId]) {
    votes[userId] = null;
  } else {
    votes[userId] = true;
  }
  
  // Update the votes
  await set(votesRef, votes);
};

/**
 * Subscribe to drawing paths
 */
export const subscribeToDrawings = (
  sessionId: string,
  onDrawingsUpdate: (drawings: Record<string, DrawingPath>) => void
) => {
  const path = `drawings/${sessionId}`;
  const drawingsRef = ref(realtimeDb, path);
  
  // Re-use existing subscription if available
  if (activeRtSubscriptions[path]) {
    console.log('Using existing drawings subscription');
    const existingRef = activeRtSubscriptions[path];
    onValue(existingRef, (snapshot) => {
      const data = snapshot.val() || {};
      onDrawingsUpdate(data);
    });
    
    return () => {
      off(existingRef);
      delete activeRtSubscriptions[path];
    };
  }
  
  // Create new subscription
  console.log(`Creating new subscription for drawings in session ${sessionId}`);
  activeRtSubscriptions[path] = drawingsRef;
  
  onValue(drawingsRef, (snapshot) => {
    const data = snapshot.val() || {};
    onDrawingsUpdate(data);
  });
  
  return () => {
    off(drawingsRef);
    delete activeRtSubscriptions[path];
  };
};

/**
 * Add a new drawing path
 */
export const addDrawingPath = async (
  sessionId: string,
  path: DrawingPath
): Promise<void> => {
  const drawingRef = ref(realtimeDb, `drawings/${sessionId}/${path.id}`);
  await set(drawingRef, path);
};

/**
 * Update an existing drawing path with new points
 */
export const updateDrawingPath = async (
  sessionId: string,
  pathId: string,
  points: { x: number; y: number }[]
): Promise<void> => {
  const pointsRef = ref(realtimeDb, `drawings/${sessionId}/${pathId}/points`);
  await set(pointsRef, points);
};

/**
 * Clear all drawings
 */
export const clearAllDrawings = async (
  sessionId: string
): Promise<void> => {
  const drawingsRef = ref(realtimeDb, `drawings/${sessionId}`);
  await set(drawingsRef, null);
};

/**
 * Delete a specific drawing path
 */
export const deleteDrawingPath = async (
  sessionId: string,
  pathId: string
): Promise<void> => {
  const drawingRef = ref(realtimeDb, `drawings/${sessionId}/${pathId}`);
  await set(drawingRef, null);
}; 