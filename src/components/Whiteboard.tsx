import React, { useEffect, useRef, useState, useMemo } from 'react';
import { User, StickyNote } from '../types';
import { Plus } from 'lucide-react';
import StickyNoteComponent from './StickyNote';
import { nanoid } from 'nanoid';
import { 
  addStickyNote, 
  createCursorUpdater, 
  subscribeToCursors, 
  subscribeToStickyNotes,
  subscribeToSessionRevealed
} from '../services/realtimeDbService';

interface WhiteboardProps {
  sessionId: string;
  currentUser: User;
  users: Record<string, User>;
}

function Whiteboard({ sessionId, currentUser, users }: WhiteboardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const cursorUpdateRef = useRef<ReturnType<typeof createCursorUpdater>>();
  const [realtimeCursors, setRealtimeCursors] = useState<Record<string, { x: number, y: number, lastUpdate: number }>>({});
  const [stickyNotes, setStickyNotes] = useState<Record<string, StickyNote>>({});
  const [isRevealed, setIsRevealed] = useState(true);

  // Memoize sticky notes array to prevent unnecessary re-renders
  const stickyNotesArray = useMemo(() => {
    return Object.values(stickyNotes)
      .filter(note => note !== null && users[note.authorId] !== undefined);
  }, [stickyNotes, users]);

  // Memoize cursors to prevent unnecessary re-renders
  const cursors = useMemo(() => {
    return Object.entries(realtimeCursors)
      .filter(([userId]) => userId !== currentUser.id && users[userId])
      .map(([userId, cursor]) => ({
        userId,
        user: users[userId],
        position: cursor
      }));
  }, [realtimeCursors, users, currentUser.id]);

  // Subscribe to realtime cursor updates
  useEffect(() => {
    const unsubscribe = subscribeToCursors(sessionId, (cursorsData) => {
      setRealtimeCursors(cursorsData);
    });
    
    return unsubscribe;
  }, [sessionId]);

  // Subscribe to sticky notes updates
  useEffect(() => {
    const unsubscribe = subscribeToStickyNotes(sessionId, (stickyNotesData) => {
      setStickyNotes(stickyNotesData);
    });
    
    return unsubscribe;
  }, [sessionId]);

  // Subscribe to revealed status updates
  useEffect(() => {
    const unsubscribe = subscribeToSessionRevealed(sessionId, (revealedStatus) => {
      setIsRevealed(revealedStatus);
    });
    
    return unsubscribe;
  }, [sessionId]);

  useEffect(() => {
    // Create a cursor updater for the current user
    cursorUpdateRef.current = createCursorUpdater(sessionId, currentUser.id);
    
    const throttledCursorUpdate = (e: MouseEvent) => {
      if (!boardRef.current || !cursorUpdateRef.current) return;
      
      const rect = boardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Update cursor position using optimized service
      cursorUpdateRef.current(x, y);
    };

    const board = boardRef.current;
    if (board) {
      board.addEventListener('mousemove', throttledCursorUpdate);
    }

    return () => {
      if (board) {
        board.removeEventListener('mousemove', throttledCursorUpdate);
      }
    };
  }, [sessionId, currentUser.id]);

  const handleAddNote = async (e: React.MouseEvent) => {
    if (!isAddingNote) return;
    
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const noteId = nanoid();
    const note = {
      id: noteId,
      content: '',
      authorId: currentUser.id,
      position: { x, y },
      color: getRandomColor()
    };
    
    // Add sticky note using realtime DB service
    await addStickyNote(sessionId, note);

    setIsAddingNote(false);
  };

  const getRandomColor = () => {
    const colors = [
      'bg-yellow-200',
      'bg-green-200',
      'bg-blue-200',
      'bg-pink-200',
      'bg-purple-200'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
    <div className="relative w-full h-full">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={() => setIsAddingNote(!isAddingNote)}
          className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${
            isAddingNote 
              ? 'bg-indigo-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Plus className="w-5 h-5" />
          <span>Add Note</span>
        </button>
      </div>

      {/* Whiteboard */}
      <div
        ref={boardRef}
        onClick={handleAddNote}
        className="w-full h-full bg-white rounded-lg shadow-lg overflow-hidden cursor-default relative"
      >
        {/* Other users' cursors */}
        {cursors.map(({ userId, user, position }) => (
          <div
            key={userId}
            className="absolute pointer-events-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px)`,
              transition: 'transform 0.2s ease-out'
            }}
          >
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full border-2 border-white shadow-md"
            />
            <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap">
              {user.name}
            </span>
          </div>
        ))}

        {/* Sticky Notes */}
        {stickyNotesArray.map((note) => (
          <StickyNoteComponent
            key={note.id}
            note={note}
            sessionId={sessionId}
            currentUser={currentUser}
            isRevealed={isRevealed}
            author={users[note.authorId]}
          />
        ))}
      </div>
    </div>
  );
}

export default Whiteboard;