import React, { useEffect, useRef, useState, useMemo } from 'react';
import { User, StickyNote, Column } from '../types';
import { Focus, Eye, EyeOff, Plus, Edit, Trash, Check, X, ThumbsUp } from 'lucide-react';
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
  deleteColumn,
  toggleVotingPhase,
  subscribeToVotingPhase
} from '../services/realtimeDbService';

interface WhiteboardProps {
  sessionId: string;
  currentUser: User;
  users: Record<string, User>;
  isRevealed?: boolean;
  onToggleReveal?: () => void;
  isVotingPhase?: boolean;
}

// Add interface for cursor data
interface CursorData {
  x: number;
  y: number;
  pan: { x: number; y: number };
  lastUpdate: number;
}

const COLUMN_WIDTH = 350;

// Define default retrospective columns
const DEFAULT_RETROSPECTIVE_COLUMNS: Column[] = [
  {
    id: 'went-well',
    title: '✅ What Went Well',
    color: 'bg-green-200',
    position: { x: 0, width: COLUMN_WIDTH }
  },
  {
    id: 'needs-improvement',
    title: '❌ What Needs Improvement',
    color: 'bg-red-200',
    position: { x: COLUMN_WIDTH, width: COLUMN_WIDTH }
  },
  {
    id: 'action-items',
    title: '💪 What can we do better?',
    color: 'bg-blue-200',
    position: { x: COLUMN_WIDTH * 2, width: COLUMN_WIDTH }
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

function Whiteboard({ sessionId, currentUser, users, isRevealed = true, onToggleReveal, isVotingPhase: externalVotingPhase }: WhiteboardProps) {
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
  const [isVotingPhase, setIsVotingPhase] = useState(externalVotingPhase || false);

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
    
    // Width of a sticky note matches the w-64 class in StickyNote.tsx
    const stickyNoteWidth = 256; // 16rem or 256px (w-64 in Tailwind)
    
    // Calculate the center position of the sticky note
    const centerX = absoluteX + (stickyNoteWidth / 2);
    
    // Find the column that contains this position based on position data
    return columnsArray.find(column => 
      centerX >= column.position.x && 
      centerX < (column.position.x + column.position.width)
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

  // Separate effect to handle initial centering after everything is loaded
  useEffect(() => {
    // Only center if we have columns and board dimensions
    if (Object.keys(columns).length > 0 && boardDimensions.width > 0) {
      // Small delay to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        setPan(calculateCenterPosition());
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [columns, boardDimensions.width]);

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
    return { x: centerX, y: 60 };
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

  const handleToggleVotingPhase = async () => {
    if (currentUser.isCreator) {
      const newVotingPhase = !isVotingPhase;
      setIsVotingPhase(newVotingPhase);
      await toggleVotingPhase(sessionId, newVotingPhase);
    }
  };

  const handleAddNote = async (e: React.MouseEvent) => {
    // Prevent adding notes during voting phase
    if (isVotingPhase) return;
    
    // Get mouse position relative to the viewport
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Adjust for current pan position
    const adjustedX = mouseX - pan.x;
    const adjustedY = mouseY - pan.y;
    
    // Sticky note width (should match the value in getNoteColumn)
    const stickyNoteWidth = 256; // 16rem or 256px (w-64 in Tailwind)
    
    // Determine which column the note belongs to using center position
    const column = getNoteColumn({ 
      x: adjustedX - (stickyNoteWidth / 2), // Offset X so click position is center of note
      y: adjustedY 
    });
    
    const noteId = nanoid();
    const note: StickyNote = {
      id: noteId,
      content: '',
      authorId: currentUser.id,
      position: {
        x: adjustedX - (stickyNoteWidth / 2), // Offset X so click position is center of note
        y: adjustedY
      },
      color: 'bg-yellow-100',
      columnId: column?.id
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
      position: { x: newX, width: COLUMN_WIDTH }
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

  // Subscribe to voting phase state
  useEffect(() => {
    const unsubscribe = subscribeToVotingPhase(sessionId, (votingPhase) => {
      setIsVotingPhase(votingPhase);
    });
    
    return () => unsubscribe();
  }, [sessionId]);

  // Update voting phase when prop changes
  useEffect(() => {
    if (externalVotingPhase !== undefined) {
      setIsVotingPhase(externalVotingPhase);
    }
  }, [externalVotingPhase]);

  return (
    <div className="relative w-full h-full flex flex-col">
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
        {/* Floating Toolbar */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-white rounded-full shadow-lg border border-gray-200 flex gap-3 transition-all duration-300 hover:shadow-xl">
          <button
            onClick={() => setPan(calculateCenterPosition())}
            className="p-2 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 transition-colors"
            title="Center View"
          >
            <Focus className="w-4 h-4" />
            <span className="text-sm font-medium">Center</span>
          </button>
          
          {currentUser.isCreator && !isVotingPhase && (
            <button
              onClick={handleAddColumn}
              className="p-2 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 transition-colors"
              title="Add Column"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Add Column</span>
            </button>
          )}
          
          {currentUser.isCreator && onToggleReveal && (
            <>
              <div className="h-8 w-px bg-gray-200 mx-1"></div>
              <button
                onClick={onToggleReveal}
                className="p-2 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 transition-colors"
                title={isRevealed ? "Hide Notes" : "Show Notes"}
              >
                {isRevealed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="text-sm font-medium">{isRevealed ? "Hide" : "Show"}</span>
              </button>
              
              <div className="h-8 w-px bg-gray-200 mx-1"></div>
              <button
                onClick={handleToggleVotingPhase}
                className={`p-2 rounded-full ${isVotingPhase ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-700'} hover:bg-indigo-100 hover:text-indigo-700 flex items-center gap-1.5 transition-colors`}
                title={isVotingPhase ? "End Voting" : "Start Voting"}
              >
                <ThumbsUp className="w-4 h-4" />
                <span className="text-sm font-medium">{isVotingPhase ? "End Voting" : "Start Voting"}</span>
              </button>
            </>
          )}
          
          {!currentUser.isCreator && isVotingPhase && (
            <div className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
              <ThumbsUp className="w-4 h-4" />
              <span>Voting in progress</span>
            </div>
          )}
        </div>

        {/* Content area that pans with the board */}
        <div
          ref={boardRef}
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
            height: 'auto',
            minHeight: '3000px'
          }}
        >
          {/* Column backgrounds, headers, and vertical dividers */}
          <div className="absolute inset-0 flex h-auto" style={{ 
            width: `${columnsArray.reduce((sum, col) => sum + col.position.width, 0)}px`,
            minHeight: '100%'
          }}>
            {columnsArray.map((column, index) => (
              <div
                key={column.id}
                className="h-full relative"
                style={{ 
                  width: `${column.position.width}px`,
                  paddingTop: '20px', // Add some space at the top
                  minHeight: '3000px', // Make columns very tall
                  paddingLeft: index !== 0 ? '5px' : '0px' // Add subtle spacing between columns
                }}
              >
                {/* Column background */}
                <div 
                  className="absolute inset-0 transition-colors duration-200 overflow-hidden"
                  style={{ 
                    backgroundColor: column.color === 'bg-green-200' ? 'rgba(167, 243, 208, 0.5)' :
                                     column.color === 'bg-red-200' ? 'rgba(254, 202, 202, 0.5)' :
                                     column.color === 'bg-blue-200' ? 'rgba(191, 219, 254, 0.5)' :
                                     column.color === 'bg-yellow-200' ? 'rgba(254, 240, 138, 0.5)' :
                                     column.color === 'bg-purple-200' ? 'rgba(233, 213, 255, 0.5)' :
                                     column.color === 'bg-pink-200' ? 'rgba(251, 207, 232, 0.5)' :
                                     column.color === 'bg-indigo-200' ? 'rgba(199, 210, 254, 0.5)' :
                                     column.color === 'bg-orange-200' ? 'rgba(254, 215, 170, 0.5)' :
                                     column.color === 'bg-teal-200' ? 'rgba(153, 246, 228, 0.5)' :
                                     'rgba(229, 231, 235, 0.5)', // Default gray if no match
                    height: '100%',
                    minHeight: 'inherit'
                  }}
                />
                
                {/* Column header */}
                <div className="sticky top-4 flex items-center justify-center font-semibold text-gray-700 z-10 shadow-sm group mx-3 mt-3 rounded-xl border transition-all duration-200 hover:shadow-md"
                  style={{
                    backgroundColor: 'white',
                    borderColor: column.color === 'bg-green-200' ? 'rgba(167, 243, 208, 1)' :
                                 column.color === 'bg-red-200' ? 'rgba(254, 202, 202, 1)' :
                                 column.color === 'bg-blue-200' ? 'rgba(191, 219, 254, 1)' :
                                 column.color === 'bg-yellow-200' ? 'rgba(254, 240, 138, 1)' :
                                 column.color === 'bg-purple-200' ? 'rgba(233, 213, 255, 1)' :
                                 column.color === 'bg-pink-200' ? 'rgba(251, 207, 232, 1)' :
                                 column.color === 'bg-indigo-200' ? 'rgba(199, 210, 254, 1)' :
                                 column.color === 'bg-orange-200' ? 'rgba(254, 215, 170, 1)' :
                                 column.color === 'bg-teal-200' ? 'rgba(153, 246, 228, 1)' :
                                 'rgba(229, 231, 235, 1)', // Default gray if no match
                    height: editingColumn === column.id && showColorPicker ? 'auto' : '3.5rem',
                    minHeight: '3.5rem'
                  }}
                >
                  {editingColumn === column.id ? (
                    <div className="flex flex-col w-full px-4 gap-2 py-2">
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                          value={editColumnTitle}
                          onChange={(e) => setEditColumnTitle(e.target.value)}
                          autoFocus
                        />
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className={`w-6 h-6 rounded-full ${editColumnColor} border border-gray-300`}
                            title="Change Color"
                          />
                          <button 
                            onClick={handleSaveColumnEdit} 
                            className="text-green-600 hover:bg-green-50 p-1 rounded-full"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={handleCancelColumnEdit} 
                            className="text-red-600 hover:bg-red-50 p-1 rounded-full"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {showColorPicker && (
                        <div className="flex flex-wrap gap-1 p-1 bg-white border border-gray-200 rounded-lg shadow-md">
                          {AVAILABLE_COLORS.map(color => (
                            <button
                              key={color}
                              className={`w-5 h-5 rounded-full ${color} ${editColumnColor === color ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                              onClick={() => setEditColumnColor(color)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 py-2 px-4 w-full justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div 
                          className={`min-w-[0.75rem] w-3 h-3 rounded-full ${column.color} ring-1 ring-white`}
                        />
                        <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">{column.title}</span>
                      </div>
                      
                      {currentUser.isCreator && (
                        <div className="flex items-center gap-1 ml-2">
                          <button 
                            onClick={() => handleEditColumn(column)} 
                            className="text-gray-600 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
                            title="Edit Column"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteColumn(column.id)} 
                            className="text-gray-600 hover:text-red-600 p-1 rounded-full hover:bg-gray-100"
                            title="Delete Column"
                            disabled={Object.keys(columns).length <= 1}
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
              isVotingPhase={isVotingPhase}
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