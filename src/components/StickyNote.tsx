import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, User } from '../types';
import { Trash2, ThumbsUp } from 'lucide-react';
import {
  createNoteContentUpdater,
  deleteStickyNote,
  setFinalNotePosition,
  createNotePositionUpdater,
  setNoteMovingStatus,
  subscribeToNotesMoving,
  subscribeToNotesPosition,
  subscribeToNotesEditing,
  setNoteEditingStatus,
  toggleVoteForStickyNote
} from '../services/realtimeDbService';

// Function to generate random characters
const generateRandomCharacters = (length: number): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

interface StickyNoteProps {
  note: StickyNote;
  sessionId: string;
  currentUser: User;
  isRevealed: boolean;
  author: User;
  isVotingPhase: boolean;
  zoomLevel?: number;
}

function StickyNoteComponent({ note, sessionId, currentUser, isRevealed, author, isVotingPhase, zoomLevel = 1 }: StickyNoteProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(note.position);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [notesMoving, setNotesMoving] = useState<Record<string, string | null>>({});
  const [notesPositions, setNotesPositions] = useState<Record<string, {x: number, y: number}>>({});
  const [notesEditing, setNotesEditing] = useState<Record<string, string | null>>({});
  const noteRef = useRef<HTMLDivElement>(null);
  const contentUpdaterRef = useRef<ReturnType<typeof createNoteContentUpdater>>();
  const positionUpdaterRef = useRef<ReturnType<typeof createNotePositionUpdater>>();
  const localPositionRef = useRef(note.position);
  const justReleasedRef = useRef(false);
  const justReleasedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maskedContentRef = useRef<string>('');

  const isAuthor = currentUser.id === note.authorId;
  const isBeingMovedBySomeoneElse = notesMoving[note.id] && notesMoving[note.id] !== currentUser.id;
  const isBeingEditedBySomeoneElse = notesEditing[note.id] && notesEditing[note.id] !== currentUser.id;
  const canMove = !isBeingMovedBySomeoneElse && !isEditing && !isBeingEditedBySomeoneElse && !isVotingPhase;
  const canEdit = isAuthor && !isBeingMovedBySomeoneElse && !isBeingEditedBySomeoneElse && !isVotingPhase;
  const shouldShowContent = isRevealed || isAuthor;

  // Count the number of votes
  const voteCount = note.votes ? Object.values(note.votes).filter(Boolean).length : 0;
  
  // Check if current user has voted for this note
  const hasVoted = note.votes && note.votes[currentUser.id];

  // Generate masked content when isRevealed changes
  useEffect(() => {
    if (!shouldShowContent) {
      maskedContentRef.current = generateRandomCharacters(content.length || 10);
    }
  }, [isRevealed, content.length]);

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

  // Subscribe to real-time notes editing status
  useEffect(() => {
    const unsubscribe = subscribeToNotesEditing(sessionId, (notesEditingData) => {
      setNotesEditing(notesEditingData);
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
        // Use requestAnimationFrame for smoother position updates
        requestAnimationFrame(() => {
          setPosition(notesPositions[note.id]);
          localPositionRef.current = notesPositions[note.id];
        });
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

    // Get the starting position in client coordinates
    const startX = e.clientX;
    const startY = e.clientY;
    
    // Store original position
    const originalX = position.x;
    const originalY = position.y;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate the delta from the starting position
      const deltaX = (e.clientX - startX) / zoomLevel;  // Adjust delta for zoom level
      const deltaY = (e.clientY - startY) / zoomLevel;  // Adjust delta for zoom level
      
      // Apply the delta to the original position to get absolute coordinates
      const newPosition = {
        x: originalX + deltaX,
        y: originalY + deltaY
      };
      
      // Use requestAnimationFrame for smoother position updates
      requestAnimationFrame(() => {
        setPosition(newPosition);
        localPositionRef.current = newPosition;
      });
      
      // Update position in Realtime DB in real-time
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

  const handleContentBlur = async () => {
    setIsEditing(false);
    await setNoteEditingStatus(sessionId, note.id, null);
  };

  const handleEditStart = async () => {
    if (canEdit) {
      setIsEditing(true);
      await setNoteEditingStatus(sessionId, note.id, currentUser.id);
    }
  };

  const handleDelete = async () => {
    await deleteStickyNote(sessionId, note.id);
  };

  const handleVoteToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isVotingPhase) {
      await toggleVoteForStickyNote(sessionId, note.id, currentUser.id);
    }
  };

  // Get display content
  const getDisplayContent = () => {
    if (shouldShowContent) {
      return content || (isAuthor ? 'Click to add text' : '');
    }
    return maskedContentRef.current;
  };

  return (
    <div
      ref={noteRef}
      className={`absolute select-none sticky-note ${note.color} rounded-xl shadow-md hover:shadow-lg p-4 w-64 ${
        isBeingMovedBySomeoneElse ? 'cursor-not-allowed' : canMove ? 'cursor-move' : 'cursor-default'
      } transition-all duration-200`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.1s ease-out, box-shadow 0.2s ease',
        zIndex: isDragging ? 10 : 1,
        opacity: isBeingMovedBySomeoneElse || isBeingEditedBySomeoneElse ? 0.7 : 1,
        border: '1px solid rgba(0,0,0,0.05)'
      }}
      onMouseDown={canMove ? handleMouseDown : undefined}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <img
            src={author.avatar}
            alt={author.name}
            className="w-6 h-6 rounded-full border border-white shadow-sm"
          />
          <span className="text-sm font-medium text-gray-700">
            {author.name}
            {isBeingMovedBySomeoneElse && ' (moving...)'}
            {isBeingEditedBySomeoneElse && ' (editing...)'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isVotingPhase && (
            <button
              onClick={handleVoteToggle}
              className={`flex items-center gap-1 text-sm font-medium px-1.5 py-1 rounded ${
                hasVoted 
                  ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } transition-colors`}
              title={hasVoted ? "Remove vote" : "Vote for this idea"}
            >
              <ThumbsUp className="w-3 h-3" />
              <span>{voteCount || 0}</span>
            </button>
          )}
          
          {isAuthor && !isBeingMovedBySomeoneElse && !isBeingEditedBySomeoneElse && !isVotingPhase && (
            <button
              onClick={handleDelete}
              className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isEditing && canEdit ? (
        <textarea
          value={content}
          onChange={handleContentChange}
          onBlur={handleContentBlur}
          className="w-full bg-transparent resize-none focus:outline-none p-1 rounded"
          rows={3}
          autoFocus
        />
      ) : (
        <div
          onClick={canEdit ? handleEditStart : undefined}
          className={`min-h-[3em] p-1 rounded ${!shouldShowContent && 'blur-sm'} ${
            canEdit && !isDragging ? 'cursor-text hover:bg-black/5' : ''
          } overflow-hidden break-words`}
        >
          {getDisplayContent()}
        </div>
      )}
    </div>
  );
}

export default StickyNoteComponent;