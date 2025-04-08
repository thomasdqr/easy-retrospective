import React, { useEffect, useRef, useState, useMemo } from 'react';
import { User, StickyNote, Column } from '../types';
import { Focus, Eye, EyeOff, Plus, Edit, Trash, Check, X } from 'lucide-react';
import StickyNoteComponent from './StickyNote';
import { nanoid } from 'nanoid';
import { 
  addStickyNote, 
  createCursorUpdater, 
  subscribeToCursors, 
  subscribeToStickyNotes,
  updateStickyNoteColor,
  subscribeToColumns,
  initializeColumns,
  addColumn,
  updateColumn,
  deleteColumn
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

// Define default retrospective columns
const DEFAULT_RETROSPECTIVE_COLUMNS: Column[] = [
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

// Tailwind color classes available for columns
const AVAILABLE_COLORS = [
  'bg-green-200',
  'bg-red-200', 
  'bg-blue-200',
  'bg-yellow-200',
  'bg-purple-200',
  'bg-pink-200',
  'bg-indigo-200',
  'bg-orange-200',
  'bg-teal-200'
];

function Whiteboard({ sessionId, currentUser, users, isRevealed = true, onToggleReveal }: WhiteboardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const cursorUpdateRef = useRef<ReturnType<typeof createCursorUpdater>>();
  const [realtimeCursors, setRealtimeCursors] = useState<Record<string, CursorData>>({});
  const [stickyNotes, setStickyNotes] = useState<Record<string, StickyNote>>({});
  const [columns, setColumns] = useState<Record<string, Column>>({});
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editColumnTitle, setEditColumnTitle] = useState('');
  const [editColumnColor, setEditColumnColor] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPosition = useRef({ x: 0, y: 0 });
  const [boardDimensions, setBoardDimensions] = useState({ width: 0, height: 0 });
  const hasPannedRef = useRef<boolean>(false);
  const initialCenterAppliedRef = useRef<boolean>(false);

  // Memoized array of columns sorted by x position
  const columnsArray = useMemo(() => {
    return Object.values(columns).sort((a, b) => a.position.x - b.position.x);
  }, [columns]);

  // Initialize columns when the component mounts
  useEffect(() => {
    const initColumns = async () => {
      try {
        // Subscribe to columns first
        subscribeToColumns(sessionId, (columnsData) => {
          if (Object.keys(columnsData).length === 0) {
            // If no columns exist yet, initialize with defaults
            initializeColumns(sessionId, DEFAULT_RETROSPECTIVE_COLUMNS);
          } else {
            setColumns(columnsData);
          }
        });
      } catch (error) {
        console.error('Error initializing columns:', error);
      }
    };
    
    initColumns();
  }, [sessionId]);
  
  // Get the column a sticky note belongs to based on its position
  const getNoteColumn = (notePosition: { x: number; y: number } | undefined): Column | null => {
    if (!boardRef.current || !notePosition) return null;
    
    // Use absolute position instead of percentage to determine column
    const absoluteX = notePosition.x;
    
    // Find the column that contains this position based on position data
    return columnsArray.find(column => 
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

  // Automatically center the whiteboard when it's first loaded
  useEffect(() => {
    // Only center once and only after the board dimensions are available
    if (!initialCenterAppliedRef.current && boardDimensions.width > 0) {
      const centerPosition = calculateCenterPosition();
      setPan(centerPosition);
      initialCenterAppliedRef.current = true;
    }
  }, [boardDimensions]);

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
    const totalBoardWidth = columnsArray.reduce(
      (total, column) => total + column.position.width, 
      0
    );
    
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
  }, [stickyNotes, boardDimensions, sessionId, columnsArray]);

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
      // Skip panning if we clicked on a sticky note, input, button, or select
      if ((e.target as HTMLElement).closest('.sticky-note, input, button, select, textarea')) return;
      
      // Check if we're editing a sticky note or a column
      const isEditingStickyNote = document.querySelector('.sticky-note textarea') !== null;
      const isEditingColumn = editingColumn !== null;
      
      // Skip panning if we're editing
      if (isEditingStickyNote || isEditingColumn) return;
      
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
        // Check if we're editing a sticky note or a column
        const isEditingStickyNote = document.querySelector('.sticky-note textarea') !== null;
        const isEditingColumn = editingColumn !== null;
        
        // Check if clicked directly on a sticky note or column editor
        const clickedOnStickyNote = (e.target as HTMLElement).closest('.sticky-note') !== null;
        const clickedOnColumnEditor = (e.target as HTMLElement).closest('input, button, select') !== null;
        
        // Only create a sticky note if we're not editing anything and didn't click on a sticky note or UI control
        if (!isEditingStickyNote && !isEditingColumn && !clickedOnStickyNote && !clickedOnColumnEditor) {
          handleAddNote(e);
        }
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

  // Add a new column
  const handleAddColumn = async () => {
    // Calculate x position after last column
    const lastColumn = columnsArray[columnsArray.length - 1];
    const newX = lastColumn ? lastColumn.position.x + lastColumn.position.width : 0;
    
    const newColumn: Column = {
      id: nanoid(),
      title: 'New Column',
      color: AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)],
      position: { x: newX, width: 350 }
    };
    
    await addColumn(sessionId, newColumn);
  };
  
  // Start editing a column
  const handleEditColumn = (column: Column) => {
    setEditingColumn(column.id);
    setEditColumnTitle(column.title);
    setEditColumnColor(column.color);
  };
  
  // Save column edits
  const handleSaveColumnEdit = async () => {
    if (!editingColumn) return;
    
    await updateColumn(sessionId, editingColumn, {
      title: editColumnTitle,
      color: editColumnColor
    });
    
    setEditingColumn(null);
    setShowColorPicker(false);
  };
  
  // Cancel column edits
  const handleCancelColumnEdit = () => {
    setEditingColumn(null);
    setShowColorPicker(false);
  };
  
  // Delete a column
  const handleDeleteColumn = async (columnId: string) => {
    // Don't allow deleting all columns
    if (Object.keys(columns).length <= 1) return;
    
    // Update the positions of remaining columns
    const deletedColumn = columns[columnId];
    if (deletedColumn) {
      const columnsToUpdate = columnsArray
        .filter(col => col.position.x > deletedColumn.position.x)
        .map(col => ({
          ...col,
          position: {
            ...col.position,
            x: col.position.x - deletedColumn.position.width
          }
        }));
      
      // Delete the column
      await deleteColumn(sessionId, columnId);
      
      // Update positions of remaining columns
      for (const col of columnsToUpdate) {
        await updateColumn(sessionId, col.id, { position: col.position });
      }
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Toolbar - moved outside and above the whiteboard */}
      <div className="py-2 px-4 flex gap-2 bg-gray-50 border-b border-gray-200 justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setPan(calculateCenterPosition())}
            className="p-2 rounded-lg bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm flex items-center gap-1"
            title="Center View"
          >
            <Focus className="w-4 h-4" />
            <span className="text-sm">Center</span>
          </button>
          
          {currentUser.isCreator && (
            <button
              onClick={handleAddColumn}
              className="p-2 rounded-lg bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm flex items-center gap-1"
              title="Add Column"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add Column</span>
            </button>
          )}
        </div>
        
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
          <div className="absolute inset-0 flex h-full" style={{ width: `${columnsArray.reduce((sum, col) => sum + col.position.width, 0)}px` }}>
            {columnsArray.map((column, index) => (
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
                <div className="sticky top-0 h-14 flex items-center justify-center font-semibold text-gray-700 border-b border-gray-200 bg-white bg-opacity-90 backdrop-blur-sm z-10 shadow-sm group">
                  {editingColumn === column.id ? (
                    <div className="flex flex-col w-full px-4 gap-2">
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          value={editColumnTitle}
                          onChange={(e) => setEditColumnTitle(e.target.value)}
                          autoFocus
                        />
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className={`w-6 h-6 rounded ${editColumnColor} border border-gray-300`}
                            title="Change Color"
                          />
                          <button 
                            onClick={handleSaveColumnEdit} 
                            className="text-green-600 hover:bg-green-50 p-1 rounded"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={handleCancelColumnEdit} 
                            className="text-red-600 hover:bg-red-50 p-1 rounded"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {showColorPicker && (
                        <div className="flex flex-wrap gap-1 p-1 bg-white border border-gray-200 rounded shadow-md">
                          {AVAILABLE_COLORS.map(color => (
                            <button
                              key={color}
                              className={`w-5 h-5 rounded-full ${color} ${editColumnColor === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                              onClick={() => setEditColumnColor(color)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{column.title}</span>
                      
                      {currentUser.isCreator && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100">
                          <button 
                            onClick={() => handleEditColumn(column)} 
                            className="text-gray-400 hover:text-gray-600 p-1"
                            title="Edit Column"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleDeleteColumn(column.id)} 
                            className="text-gray-400 hover:text-red-600 p-1"
                            title="Delete Column"
                            disabled={Object.keys(columns).length <= 1}
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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