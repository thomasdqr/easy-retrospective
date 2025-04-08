import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, User } from '../types';
import { Trash2 } from 'lucide-react';
import {
  createNoteContentUpdater,
  deleteStickyNote,
  setFinalNotePosition,
  createNotePositionUpdater,
  setNoteMovingStatus,
  subscribeToNotesMoving,
  subscribeToNotesPosition,
  updateStickyNoteColor
} from '../services/realtimeDbService';

interface StickyNoteProps {
  note: StickyNote;
  sessionId: string;
  currentUser: User;
  isRevealed: boolean;
  author: User;
}

function StickyNoteComponent({ note, sessionId, currentUser, isRevealed, author }: StickyNoteProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(note.position);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [notesMoving, setNotesMoving] = useState<Record<string, string | null>>({});
  const [notesPositions, setNotesPositions] = useState<Record<string, {x: number, y: number}>>({});
  const noteRef = useRef<HTMLDivElement>(null);
  const contentUpdaterRef = useRef<ReturnType<typeof createNoteContentUpdater>>();
  const positionUpdaterRef = useRef<ReturnType<typeof createNotePositionUpdater>>();
  const localPositionRef = useRef(note.position);
  const justReleasedRef = useRef(false);
  const justReleasedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Setup the updaters when component mounts
  useEffect(() => {
    contentUpdaterRef.current = createNoteContentUpdater(sessionId, note.id);
    positionUpdaterRef.current = createNotePositionUpdater(sessionId, note.id);
  }, [sessionId, note.id]);

  // Subscribe to real-time notes moving status
  useEffect(() => {
    const unsubscribe = subscribeToNotesMoving(sessionId, (notesMovingData) => {
      setNotesMoving(notesMovingData);
    });
    
    return unsubscribe;
  }, [sessionId]);

  // Subscribe to real-time position updates
  useEffect(() => {
    const unsubscribe = subscribeToNotesPosition(sessionId, (positionsData) => {
      setNotesPositions(positionsData);
    });
    
    return unsubscribe;
  }, [sessionId]);

  // Update position from real-time updates if the note is being moved by someone else
  useEffect(() => {
    if (notesPositions[note.id]) {
      const isBeingMovedBySomeoneElse = notesMoving[note.id] && notesMoving[note.id] !== currentUser.id;
      
      // Only update our position if:
      // 1. Someone else is moving the note (real-time updates while they drag)
      // 2. We're not currently dragging ourselves
      // 3. We didn't just release the note (to prevent position jitter)
      if (isBeingMovedBySomeoneElse || (!isDragging && !justReleasedRef.current)) {
        setPosition(notesPositions[note.id]);
        localPositionRef.current = notesPositions[note.id];
      }
    }
  }, [notesPositions, note.id, isDragging, notesMoving, currentUser.id]);

  // Update local position when note's position changes in the database
  useEffect(() => {
    // Initialize with note position on first load
    if (!isDragging && !justReleasedRef.current) {
      setPosition(note.position);
      localPositionRef.current = note.position;
    }
    
    // Only update content if we're not currently editing
    if (!isEditing) {
      setContent(note.content);
    }
  }, [note.position, note.content, isEditing, isDragging]);

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only handle left click
    
    // If someone else is moving the note, don't allow moving
    if (notesMoving[note.id] && notesMoving[note.id] !== currentUser.id) return;
    
    // Clear any existing justReleased timeout
    if (justReleasedTimeoutRef.current) {
      clearTimeout(justReleasedTimeoutRef.current);
      justReleasedTimeoutRef.current = null;
    }
    
    justReleasedRef.current = false;
    setIsDragging(true);

    // Mark this note as being moved by current user using Realtime DB
    await setNoteMovingStatus(sessionId, note.id, currentUser.id);

    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (e: MouseEvent) => {
      const newPosition = {
        x: (e.clientX - startX) / 1,
        y: (e.clientY - startY) / 1
      };
      
      setPosition(newPosition);
      localPositionRef.current = newPosition;
      
      // Update position in Realtime DB in real-time (throttled)
      if (positionUpdaterRef.current) {
        positionUpdaterRef.current(newPosition.x, newPosition.y);
      }
    };

    const handleMouseUp = async () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Important: Use localPositionRef to ensure we have the latest position
      const finalPosition = {
        x: localPositionRef.current.x,
        y: localPositionRef.current.y
      };
      
      // Set flag to ignore position updates from server temporarily
      justReleasedRef.current = true;

      // First clear the moving flag
      await setNoteMovingStatus(sessionId, note.id, null);
      
      // Then set final position in database for persistence
      await setFinalNotePosition(sessionId, note.id, finalPosition);
      
      // Set a timeout to re-enable position updates from server after a delay
      // This gives time for our final position to be the one that sticks
      justReleasedTimeoutRef.current = setTimeout(() => {
        justReleasedRef.current = false;
        justReleasedTimeoutRef.current = null;
      }, 500); // Keep local position for 500ms after releasing
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    // Update content in database using debounced updater
    if (contentUpdaterRef.current) {
      contentUpdaterRef.current(newContent);
    }
  };

  const handleContentBlur = () => {
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteStickyNote(sessionId, note.id);
  };

  const isAuthor = currentUser.id === note.authorId;
  const isBeingMovedBySomeoneElse = notesMoving[note.id] && notesMoving[note.id] !== currentUser.id;
  // Allow any user to move any note, but only author can edit or delete
  const canMove = !isBeingMovedBySomeoneElse;
  const canEdit = isAuthor && !isBeingMovedBySomeoneElse;
  const shouldShowContent = isRevealed || isAuthor;

  return (
    <div
      ref={noteRef}
      className={`absolute select-none sticky-note ${note.color} rounded-lg shadow-lg p-4 w-64 ${
        isBeingMovedBySomeoneElse ? 'cursor-not-allowed' : canMove ? 'cursor-move' : 'cursor-default'
      }`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        zIndex: isDragging ? 10 : 1,
        opacity: isBeingMovedBySomeoneElse ? 0.7 : 1
      }}
      onMouseDown={canMove ? handleMouseDown : undefined}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <img
            src={author.avatar}
            alt={author.name}
            className="w-6 h-6 rounded-full"
          />
          <span className="text-sm text-gray-600">
            {author.name}
            {isBeingMovedBySomeoneElse && ' (moving...)'}
          </span>
        </div>
        {isAuthor && !isBeingMovedBySomeoneElse && (
          <button
            onClick={handleDelete}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {isEditing && canEdit ? (
        <textarea
          value={content}
          onChange={handleContentChange}
          onBlur={handleContentBlur}
          className="w-full bg-transparent resize-none focus:outline-none"
          rows={3}
          autoFocus
        />
      ) : (
        <div
          onClick={() => canEdit && !isDragging && setIsEditing(true)}
          className={`min-h-[3em] ${!shouldShowContent && 'blur-sm'} ${
            canEdit && !isDragging ? 'cursor-text hover:bg-black/5' : ''
          }`}
        >
          {content || (isAuthor ? 'Click to add text' : '')}
        </div>
      )}
    </div>
  );
}

export default StickyNoteComponent;