import React, { useEffect, useRef, useState, useMemo } from 'react';
import { User, StickyNote, Column } from '../types';
import { Focus, Eye, EyeOff } from 'lucide-react';
import StickyNoteComponent from './StickyNote';
import { nanoid } from 'nanoid';
import { 
  addStickyNote, 
  createCursorUpdater, 
  subscribeToCursors, 
  subscribeToStickyNotes,
  updateStickyNoteColor
} from '../services/realtimeDbService';

interface WhiteboardProps {
  sessionId: string;
  currentUser: User;
  users: Record<string, User>;
  isRevealed?: boolean;
  onToggleReveal?: () => void;
}

// Add interface for cursor data
interface CursorData {
  x: number;
  y: number;
  pan: { x: number; y: number };
  lastUpdate: number;
}

// Define retrospective columns
const RETROSPECTIVE_COLUMNS: Column[] = [
  {
    id: 'went-well',
    title: '✅ What Went Well',
    color: 'bg-green-200',
    position: { x: 0, width: 350 }
  },
  {
    id: 'needs-improvement',
    title: '❌ What Needs Improvement',
    color: 'bg-red-200',
    position: { x: 350, width: 350 }
  },
  {
    id: 'action-items',
    title: '💪 What can we do better?',
    color: 'bg-blue-200',
    position: { x: 700, width: 350 }
  }
];

function Whiteboard({ sessionId, currentUser, users, isRevealed = true, onToggleReveal }: WhiteboardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const cursorUpdateRef = useRef<ReturnType<typeof createCursorUpdater>>();
  const [realtimeCursors, setRealtimeCursors] = useState<Record<string, CursorData>>({});
  const [stickyNotes, setStickyNotes] = useState<Record<string, StickyNote>>({});
  
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPosition = useRef({ x: 0, y: 0 });
  const [boardDimensions, setBoardDimensions] = useState({ width: 0, height: 0 });
  const hasPannedRef = useRef<boolean>(false);

  // Get the column a sticky note belongs to based on its position
  const getNoteColumn = (notePosition: { x: number; y: number } | undefined): Column | null => {
    if (!boardRef.current || !notePosition) return null;
    
    // Use absolute position instead of percentage to determine column
    const absoluteX = notePosition.x;
    
    // Find the column that contains this position based on fixed width
    return RETROSPECTIVE_COLUMNS.find(column => 
      absoluteX >= column.position.x && 
      absoluteX < (column.position.x + column.position.width)
    ) || null;
  };
  
  // Update board dimensions when the board is resized
  useEffect(() => {
    if (!boardRef.current) return;
    
    const updateDimensions = () => {
      if (boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();
        setBoardDimensions({ width: rect.width, height: rect.height });
      }
    };
    
    // Initial update
    updateDimensions();
    
    // Add resize listener
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Transform cursor positions between viewports
  const transformCursorPosition = (
    cursor: CursorData,
    localPan: { x: number; y: number }
  ) => {
    // Handle cases where cursor might not have pan data yet
    const cursorPan = cursor.pan ?? { x: 0, y: 0 };

    // Convert from other user's viewport to our viewport
    return {
      x: cursor.x + cursorPan.x + localPan.x,
      y: cursor.y + cursorPan.y + localPan.y
    };
  };

  // Calculate the center position for resetting view
  const calculateCenterPosition = () => {
    if (!boardRef.current) return { x: 0, y: 0 };
    
    const containerRect = boardRef.current.parentElement?.getBoundingClientRect();
    if (!containerRect) return { x: 0, y: 0 };
    
    // Total width of all columns
    const totalBoardWidth = RETROSPECTIVE_COLUMNS.length * 350;
    
    // Center horizontally by calculating the offset needed
    const centerX = (containerRect.width - totalBoardWidth) / 2;
    
    // For vertical centering, just return to top since columns extend to full height
    return { x: centerX, y: 0 };
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

  // Effect to detect and update sticky note colors based on their column
  useEffect(() => {
    // Skip if board dimensions aren't available yet
    if (boardDimensions.width === 0) return;
    
    // Check each sticky note's position and update its color if needed
    Object.values(stickyNotes).forEach(note => {
      // Skip invalid notes or those without position data
      if (!note || !note.position) return;
      
      const column = getNoteColumn(note.position);
      if (column) {
        // If the note color doesn't match the column color, update it
        if (note.color !== column.color) {
          updateStickyNoteColor(sessionId, note.id, column.color);
        }
      }
    });
  }, [stickyNotes, boardDimensions, sessionId]);

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
        x: x - pan.x,
        y: y - pan.y,
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
    if (e.button === 0 && (e.target === boardRef.current || e.currentTarget.contains(e.target as Node))) {
      // Skip panning if we clicked on a sticky note
      if ((e.target as HTMLElement).closest('.sticky-note')) return;
      
      e.preventDefault();
      setIsPanning(true);
      lastPanPosition.current = { x: e.clientX, y: e.clientY };
      hasPannedRef.current = false;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPosition.current.x;
      const deltaY = e.clientY - lastPanPosition.current.y;
      
      // Check if the user has moved enough to consider it a panning action
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (distance > 5) {
        hasPannedRef.current = true;
      }
      
      setPan(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      lastPanPosition.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      // If the mouse is released and there was no significant panning, consider it a click
      if (!hasPannedRef.current) {
        // Create a sticky note on single click without panning
        handleAddNote(e);
      }
      
      // Reset the panning state
      setIsPanning(false);
    }
  };

  const handleAddNote = async (e: React.MouseEvent) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate the mouse position relative to the board container
    const viewportX = e.clientX - rect.left;
    const viewportY = e.clientY - rect.top;

    // Determine which column the note is being added to
    const column = getNoteColumn({ x: viewportX, y: viewportY });
    
    const noteId = nanoid();
    const note = {
      id: noteId,
      content: '',
      authorId: currentUser.id,
      // Use viewport coordinates directly for sticky note position
      position: { x: viewportX, y: viewportY },
      color: column ? column.color : 'bg-yellow-200', // Default to yellow if no column
      // Set to "other" category when outside of columns to avoid undefined error
      columnId: column ? column.id : 'other'
    };
    
    await addStickyNote(sessionId, note);
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Toolbar - moved outside and above the whiteboard */}
      <div className="py-2 px-4 flex gap-2 bg-gray-50 border-b border-gray-200 justify-between">
        <button
          onClick={() => setPan(calculateCenterPosition())}
          className="p-2 rounded-lg bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm flex items-center gap-1"
          title="Center View"
        >
          <Focus className="w-4 h-4" />
          <span className="text-sm">Center</span>
        </button>
        
        {currentUser.isCreator && onToggleReveal && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{isRevealed ? 'Visible Notes' : 'Hidden Notes'}</span>
            <button
              onClick={onToggleReveal}
              className="p-2 rounded-lg bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm flex items-center gap-1"
              title={isRevealed ? "Hide Notes" : "Show Notes"}
            >
              {isRevealed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="text-sm">{isRevealed ? "Hide" : "Show"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Whiteboard */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full bg-white rounded-lg shadow-lg overflow-hidden cursor-default relative flex-grow"
        style={{
          cursor: isPanning ? 'grabbing' : 'default'
        }}
      >
        {/* Content area that pans with the board */}
        <div
          ref={boardRef}
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transition: isPanning ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {/* Column backgrounds, headers, and vertical dividers */}
          <div className="absolute inset-0 flex h-full" style={{ width: `${RETROSPECTIVE_COLUMNS.length * 350}px` }}>
            {RETROSPECTIVE_COLUMNS.map((column, index) => (
              <div
                key={column.id}
                className="h-full relative"
                style={{ 
                  width: `${column.position.width}px`
                }}
              >
                {/* Column background */}
                <div 
                  className="absolute inset-0"
                  style={{ 
                    backgroundColor: `${column.color.replace('bg-', '')}30`  // 30% opacity
                  }}
                />
                
                {/* Column header */}
                <div className="sticky top-0 h-14 flex items-center justify-center font-semibold text-gray-700 border-b border-gray-200 bg-white bg-opacity-90 backdrop-blur-sm z-10 shadow-sm">
                  {column.title}
                </div>
                
                {/* Vertical divider */}
                {index !== 0 && (
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-300 z-10"
                  />
                )}
              </div>
            ))}
          </div>
          
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
        
        {/* User cursors (always on top) */}
        <div className="absolute inset-0 pointer-events-none z-30">
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
      </div>
    </div>
  );
}

export default Whiteboard;