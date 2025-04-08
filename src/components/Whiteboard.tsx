import React, { useEffect, useRef, useState, useMemo } from 'react';
import { User, StickyNote } from '../types';
import { Plus, MoveHorizontal } from 'lucide-react';
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

// Add interface for cursor data
interface CursorData {
  x: number;
  y: number;
  pan: { x: number; y: number };
  lastUpdate: number;
}

function Whiteboard({ sessionId, currentUser, users }: WhiteboardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const cursorUpdateRef = useRef<ReturnType<typeof createCursorUpdater>>();
  const [realtimeCursors, setRealtimeCursors] = useState<Record<string, CursorData>>({});
  const [stickyNotes, setStickyNotes] = useState<Record<string, StickyNote>>({});
  const [isRevealed, setIsRevealed] = useState(true);
  
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPosition = useRef({ x: 0, y: 0 });

  // Transform cursor positions between viewports
  const transformCursorPosition = (
    cursor: CursorData,
    localPan: { x: number; y: number }
  ) => {
    // Handle cases where cursor might not have pan data yet
    const cursorPan = cursor.pan ?? { x: 0, y: 0 };

    // Convert from other user's viewport to our viewport
    return {
      x: cursor.x - cursorPan.x + localPan.x,
      y: cursor.y - cursorPan.y + localPan.y
    };
  };

  // Memoize sticky notes array to prevent unnecessary re-renders
  const stickyNotesArray = useMemo(() => {
    return Object.values(stickyNotes)
      .filter(note => note !== null && users[note.authorId] !== undefined);
  }, [stickyNotes, users]);

  // Update cursor memoization to include transformation
  const cursors = useMemo(() => {
    return Object.entries(realtimeCursors)
      .filter(([userId]) => userId !== currentUser.id && users[userId])
      .map(([userId, cursor]) => {
        // Transform the cursor position from the other user's viewport to our viewport
        const transformedPosition = transformCursorPosition(cursor, pan);
        return {
          userId,
          user: users[userId],
          position: transformedPosition
        };
      });
  }, [realtimeCursors, users, currentUser.id, pan]);

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

      // Send cursor position along with current pan state
      cursorUpdateRef.current({
        x,
        y,
        pan,
        lastUpdate: Date.now()
      });
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
  }, [sessionId, currentUser.id, pan]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only enable panning when clicking directly on the sticky notes container
    // and not on any sticky notes themselves
    if (e.button === 0 && e.target === boardRef.current) {
      e.preventDefault();
      setIsPanning(true);
      lastPanPosition.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPosition.current.x;
      const deltaY = e.clientY - lastPanPosition.current.y;
      
      setPan(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      lastPanPosition.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleAddNote = async (e: React.MouseEvent) => {
    if (!isAddingNote || isPanning) return;
    
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate the position in the viewport
    const viewportX = e.clientX - rect.left;
    const viewportY = e.clientY - rect.top;

    // Convert viewport coordinates to whiteboard coordinates
    const whiteboardX = viewportX - pan.x;
    const whiteboardY = viewportY - pan.y;

    const noteId = nanoid();
    const note = {
      id: noteId,
      content: '',
      authorId: currentUser.id,
      position: { x: whiteboardX, y: whiteboardY },
      color: getRandomColor()
    };
    
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

        <button
          onClick={() => setPan({ x: 0, y: 0 })}
          className="p-2 rounded-lg bg-white text-gray-700 hover:bg-gray-50"
          title="Reset View"
        >
          <MoveHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Whiteboard */}
      <div
        onClick={handleAddNote}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full bg-white rounded-lg shadow-lg overflow-hidden cursor-default relative"
        style={{
          cursor: isPanning ? 'grabbing' : isAddingNote ? 'crosshair' : 'default'
        }}
      >
        {/* Other users' cursors - rendered above everything */}
        <div className="absolute inset-0 pointer-events-none">
          {cursors.map(({ userId, user, position }) => (
            <div
              key={userId}
              className="absolute pointer-events-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
                transition: 'transform 0.2s ease-out',
                zIndex: 1000
              }}
            >
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full border-2 border-white shadow-md"
              />
              <span
                className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap"
              >
                {user.name}
              </span>
            </div>
          ))}
        </div>

        {/* Sticky notes container */}
        <div
          ref={boardRef}
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transition: isPanning ? 'none' : 'transform 0.1s ease-out'
          }}
        >
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
    </div>
  );
}

export default Whiteboard;