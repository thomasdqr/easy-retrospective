import React, { useEffect, useRef, useState, useMemo } from 'react';
import { User, StickyNote, Column } from '../types';
import { Focus, Eye, EyeOff, Plus, Edit, Trash, Check, X, ThumbsUp, PencilLine, Eraser, Brain, ZoomIn, ZoomOut } from 'lucide-react';
import StickyNoteComponent from './StickyNote';
import RetroSummary from './RetroSummary';
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
  subscribeToVotingPhase,
  subscribeToDrawings,
  addDrawingPath,
  updateDrawingPath,
  DrawingPath,
  clearAllDrawings,
  deleteDrawingPath,
  subscribeToIcebreakerState,
  deleteStickyNote
} from '../services/realtimeDbService';
import { IcebreakerGameState } from './icebreaker/types';

interface WhiteboardProps {
  sessionId: string;
  currentUser: User;
  users: Record<string, User>;
  isRevealed?: boolean;
  onToggleReveal?: () => void;
  isVotingPhase?: boolean;
  onVotingEnd?: (hasVotes: boolean) => void;
}

// Add interface for cursor data
interface CursorData {
  x: number;
  y: number;
  pan: { x: number; y: number };
  lastUpdate: number;
}

const COLUMN_WIDTH = 800;

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

// Colors available for drawing
const DRAWING_COLORS = [
  '#FF0000', // Red
  '#0000FF', // Blue
  '#000000'  // Black
];

function Whiteboard({ sessionId, currentUser, users, isRevealed = true, onToggleReveal, isVotingPhase: externalVotingPhase, onVotingEnd }: WhiteboardProps) {
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
  const [zoomLevel, setZoomLevel] = useState(1);
  const lastPanPosition = useRef({ x: 0, y: 0 });
  const [boardDimensions, setBoardDimensions] = useState({ width: 0, height: 0 });
  const hasPannedRef = useRef<boolean>(false);
  const [isVotingPhase, setIsVotingPhase] = useState(externalVotingPhase || false);
  
  // Drawing states
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
  const [drawings, setDrawings] = useState<Record<string, DrawingPath>>({});
  const [drawingColor, setDrawingColor] = useState('#000000');
  const [drawingWidth, setDrawingWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [icebreakerState, setIcebreakerState] = useState<IcebreakerGameState>({
    users: {},
    activeUser: null,
    revealed: false
  });
  const prevVotingPhaseRef = useRef(false);

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
  
  // Update board dimensions and add wheel event listener
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
    
    // Add wheel event listener with { passive: false } to ensure preventDefault works
    // but only to prevent default browser behavior, not to prevent our own handlers
    const boardElement = boardRef.current.parentElement;
    if (boardElement) {
      const wheelHandler = (e: WheelEvent) => {
        // Only prevent default browser behavior (back/forward navigation, page scrolling)
        // but don't stop propagation - we need the event to reach our handleWheel
        if (!isDrawingMode) {
          e.preventDefault();
        }
      };
      boardElement.addEventListener('wheel', wheelHandler, { passive: false });
      return () => {
        window.removeEventListener('resize', updateDimensions);
        boardElement.removeEventListener('wheel', wheelHandler);
      };
    }
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, [isDrawingMode]);

  // Separate effect to handle initial centering after everything is loaded
  useEffect(() => {
    // Only center if we have columns and board dimensions
    if (Object.keys(columns).length > 0 && boardDimensions.width > 0) {
      // Small delay to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        const centerPosition = calculateCenterPosition();
        setPan({ x: centerPosition.x, y: centerPosition.y });
        setZoomLevel(centerPosition.zoom);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [columns, boardDimensions.width]);

  // Transform cursor positions between viewports
  const transformCursorPosition = (
    cursor: CursorData
  ) => {
    // Since cursors are inside the transformed container, we just return the coordinates
    // Using the same coordinate system as sticky notes
    return {
      x: cursor.x,
      y: cursor.y
    };
  };

  // Calculate the center position for resetting view
  const calculateCenterPosition = () => {
    if (!boardRef.current) return { x: 0, y: 0, zoom: 1 };
    
    const containerRect = boardRef.current.parentElement?.getBoundingClientRect();
    if (!containerRect) return { x: 0, y: 0, zoom: 1 };
    
    // Total width of all columns
    const totalBoardWidth = columnsArray.reduce(
      (total, column) => total + column.position.width, 
      0
    );
    
    // Calculate the zoom level needed to fit all columns in the viewport width
    // Add a small padding (0.95) to leave some space on the sides
    const optimalZoom = Math.min(
      (containerRect.width * 0.95) / totalBoardWidth,
      3 // Maximum zoom level
    );
    
    // Don't go below minimum zoom
    const finalZoom = Math.max(0.5, optimalZoom);
    
    // Calculate horizontal centering position based on the zoom
    const centerX = (containerRect.width - (totalBoardWidth * finalZoom)) / 2;
    
    // For vertical centering, just return to top since columns extend to full height
    return { x: centerX, y: 60, zoom: finalZoom };
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
        const transformedPosition = transformCursorPosition(cursor);
        return {
          userId,
          user: users[userId],
          position: transformedPosition
        };
      });
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
      } else {
        // Note is outside any column, make it yellow if it's not already
        if (note.color !== 'bg-yellow-100') {
          updateStickyNoteColor(sessionId, note.id, 'bg-yellow-100');
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
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Adjust coordinates for zoom level
      const adjustedX = mouseX / zoomLevel;
      const adjustedY = mouseY / zoomLevel;
      
      cursorUpdateRef.current({
        x: adjustedX,
        y: adjustedY,
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
  }, [sessionId, currentUser.id, pan, zoomLevel]);

  // Subscribe to drawings
  useEffect(() => {
    const unsubscribe = subscribeToDrawings(sessionId, (drawingsData) => {
      setDrawings(drawingsData);
    });
    
    return unsubscribe;
  }, [sessionId]);

  // Handle starting a drawing
  const handleStartDrawing = (e: React.MouseEvent) => {
    if (!isDrawingMode || isPanning) return;
    
    e.stopPropagation();
    
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Get board element position
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    
    // Adjust for the board's position and zoom
    const adjustedX = (mouseX - boardRect.left) / zoomLevel;
    const adjustedY = (mouseY - boardRect.top) / zoomLevel;

    if (isEraser) {
      // Set erasing state to true when mouse is pressed
      setIsErasing(true);
      // Check for collision with existing drawings and erase them
      checkAndEraseDrawings(adjustedX, adjustedY);
    } else {
      // Create a new path for drawing
      const pathId = nanoid();
      
      const newPath: DrawingPath = {
        id: pathId,
        points: [{ x: adjustedX, y: adjustedY }],
        color: drawingColor,
        width: drawingWidth,
        authorId: currentUser.id
      };
      
      setCurrentPath(newPath);
      setIsDrawing(true);
      
      // Save the initial path to the database
      addDrawingPath(sessionId, newPath);
    }
  };

  // Handle continuing a drawing
  const handleDrawing = (e: React.MouseEvent) => {
    if (!isDrawingMode) return;
    
    e.stopPropagation();
    
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Get board element position
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    
    // Adjust for the board's position and zoom
    const adjustedX = (mouseX - boardRect.left) / zoomLevel;
    const adjustedY = (mouseY - boardRect.top) / zoomLevel;
    
    if (isEraser && isErasing) {
      // Only erase if the mouse button is pressed (isErasing is true)
      checkAndEraseDrawings(adjustedX, adjustedY);
    } else if (isDrawing && currentPath) {
      // Continue drawing the current path
      const updatedPoints = [...currentPath.points, { x: adjustedX, y: adjustedY }];
      
      // Update the current path
      setCurrentPath({
        ...currentPath,
        points: updatedPoints
      });
      
      // Update the path in the database
      updateDrawingPath(sessionId, currentPath.id, updatedPoints);
    }
  };

  // Check for collision with existing drawings and erase them
  const checkAndEraseDrawings = (x: number, y: number) => {
    const eraserRadius = drawingWidth * 2; // Make eraser a bit bigger than the pen
    
    // Check each drawing for collision with the eraser
    Object.values(drawings).forEach(path => {
      // Skip checking if the path has been deleted
      if (!path || !path.points || path.points.length === 0) return;
      
      // Check if the eraser is close to any segment of this path
      for (let i = 1; i < path.points.length; i++) {
        const p1 = path.points[i - 1];
        const p2 = path.points[i];
        
        // Calculate distance from point to line segment
        const distance = distanceToLineSegment(p1, p2, { x, y });
        
        // If within erasing distance, delete the path
        if (distance < eraserRadius + (path.width / 2)) {
          deleteDrawingPath(sessionId, path.id);
          break; // Move to the next path
        }
      }
      
      // Also check if we're close to any individual point
      for (const point of path.points) {
        const distance = Math.sqrt(
          Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2)
        );
        
        if (distance < eraserRadius + (path.width / 2)) {
          deleteDrawingPath(sessionId, path.id);
          break; // Move to the next path
        }
      }
    });
  };
  
  // Calculate distance from a point to a line segment
  const distanceToLineSegment = (
    p1: { x: number; y: number }, 
    p2: { x: number; y: number }, 
    point: { x: number; y: number }
  ) => {
    const A = point.x - p1.x;
    const B = point.y - p1.y;
    const C = p2.x - p1.x;
    const D = p2.y - p1.y;
    
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    
    if (len_sq !== 0) // in case of 0 length line
      param = dot / len_sq;
    
    let xx, yy;
    
    if (param < 0) {
      xx = p1.x;
      yy = p1.y;
    } else if (param > 1) {
      xx = p2.x;
      yy = p2.y;
    } else {
      xx = p1.x + param * C;
      yy = p1.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle ending a drawing
  const handleEndDrawing = () => {
    if (isErasing) {
      setIsErasing(false);
    }
    
    if (!isDrawing) return;
    
    setIsDrawing(false);
    setCurrentPath(null);
  };

  // Toggle drawing mode
  const toggleDrawingMode = () => {
    setIsDrawingMode(!isDrawingMode);
    // Reset eraser when toggling drawing mode
    if (!isDrawingMode) {
      setIsEraser(false);
    }
  };

  // Toggle eraser mode
  const toggleEraser = () => {
    setIsEraser(!isEraser);
  };

  // Clear all drawings
  const handleClearDrawings = async () => {
    if (currentUser.isCreator) {
      await clearAllDrawings(sessionId);
    }
  };

  // Modified mouse handlers to support drawing
  const handleMouseDown = (e: React.MouseEvent) => {
    // Skip if we're in drawing mode (the drawing overlay will handle this)
    if (isDrawingMode) {
      return;
    }
    
    // Check if we're using middle mouse button
    const isMiddleMouseButton = e.button === 1;
    
    // Panning with middle mouse button or left button
    if ((isMiddleMouseButton || e.button === 0) && (e.target === boardRef.current || e.currentTarget.contains(e.target as Node))) {
      // For middle mouse button, always allow panning regardless of what's under it
      // For left click, skip panning if we clicked on a sticky note, input, button, or select
      if (!isMiddleMouseButton && (e.target as HTMLElement).closest('.sticky-note, input, button, select, textarea')) return;
      
      // Check if we're editing a sticky note or a column
      const isEditingStickyNote = document.querySelector('.sticky-note textarea') !== null;
      const isEditingColumn = editingColumn !== null;
      
      // Skip panning if we're editing, but only for left click
      if (!isMiddleMouseButton && (isEditingStickyNote || isEditingColumn)) return;
      
      e.preventDefault();
      setIsPanning(true);
      lastPanPosition.current = { x: e.clientX, y: e.clientY };
      hasPannedRef.current = false;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Skip if we're in drawing mode (the drawing overlay will handle this)
    if (isDrawingMode) {
      return;
    }
    
    // Original panning logic
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
    // Skip if we're in drawing mode (the drawing overlay will handle this)
    if (isDrawingMode) {
      return;
    }
    
    // Original panning/click logic
    if (isPanning) {
      // If the mouse is released and there was no significant panning, consider it a click
      if (!hasPannedRef.current && e.button === 0) {
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

  // Handle wheel scroll events
  const handleWheel = (e: React.WheelEvent) => {
    // Skip if we're in drawing mode
    if (isDrawingMode) return;

    // Prevent default browser behaviors
    e.preventDefault();
    
    // Only zoom when using Ctrl key (pinch on trackpad or Ctrl+mousewheel)
    const isPinchZoom = e.ctrlKey;
    
    // Handle zooming (only with Ctrl key / pinch)
    if (isPinchZoom) {
      // Get mouse position relative to board
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate zoom factor (smaller steps for smoother zoom)
      const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
      const newZoom = Math.max(0.5, Math.min(3, zoomLevel * zoomFactor));
      
      // If we hit zoom limits, don't do anything (prevent panning)
      if ((zoomLevel === 0.5 && e.deltaY > 0) || (zoomLevel === 3 && e.deltaY < 0)) {
        return;
      }
      
      // Calculate new pan position to zoom toward/away from mouse pointer
      const newPan = {
        x: pan.x - ((mouseX) * (zoomFactor - 1)),
        y: pan.y - ((mouseY) * (zoomFactor - 1))
      };
      
      setZoomLevel(newZoom);
      setPan(newPan);
    } else {
      // Regular panning behavior for all other wheel events
      setPan(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const handleToggleVotingPhase = async () => {
    if (currentUser.isCreator) {
      const newVotingPhase = !isVotingPhase;
      setIsVotingPhase(newVotingPhase);
      
      // If turning off voting phase and we have voted stickies, notify the parent
      if (!newVotingPhase && hasVotedStickies()) {
        onVotingEnd?.(true);
      }
      
      await toggleVotingPhase(sessionId, newVotingPhase);
    }
  };

  const handleShowSummary = () => {
    setShowSummary(true);
  };

  const handleAddNote = async (e: React.MouseEvent) => {
    // Prevent adding notes during voting phase
    if (isVotingPhase) return;
    
    // Get board element position
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;

    // Check if the last sticky note created by the current user is empty
    const userNotes = Object.values(stickyNotes)
      .filter(note => note.authorId === currentUser.id);
    
    // If the user has at least one empty note, delete it before creating a new one
    const emptyNotes = userNotes.filter(note => note.content === '');
    if (emptyNotes.length > 0) {
      // Get the most recently created empty note (assuming it's the last one in the array)
      const lastEmptyNote = emptyNotes[emptyNotes.length - 1];
      await deleteStickyNote(sessionId, lastEmptyNote.id);
    }

    // Calculate position
    const mouseX = e.clientX - boardRect.left;
    const mouseY = e.clientY - boardRect.top;
    
    // Adjust coordinates for zoom level
    const adjustedX = mouseX / zoomLevel;
    const adjustedY = mouseY / zoomLevel;
    
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
      color: column ? column.color : 'bg-yellow-100',
      columnId: column ? column.id : undefined
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

  // Subscribe to icebreaker state
  useEffect(() => {
    const unsubscribe = subscribeToIcebreakerState(sessionId, (state) => {
      if (state) {
        setIcebreakerState(state);
      }
    });
    
    return () => unsubscribe();
  }, [sessionId]);

  // Check if there are any stickies with votes
  const hasVotedStickies = () => {
    return Object.values(stickyNotes).some(note => 
      note.votes && Object.values(note.votes).filter(Boolean).length > 0
    );
  };

  // When voting phase changes from true to false, notify parent if we have voted stickies
  useEffect(() => {
    if (prevVotingPhaseRef.current && !isVotingPhase && hasVotedStickies()) {
      onVotingEnd?.(true);
    }
    prevVotingPhaseRef.current = isVotingPhase;
  }, [isVotingPhase, onVotingEnd]);

  return (
    <div 
      className="relative w-full h-full flex flex-col" 
      onWheel={(e) => {
        // Only prevent browser scrolling/navigation, don't stop propagation
        // so our own wheel handlers can still process the event
        e.preventDefault();
      }}
      style={{
        // Ensure the whiteboard captures all gestures
        overscrollBehavior: 'none',
        touchAction: 'none'
      }}
    >
      {/* Whiteboard */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full bg-white rounded-lg shadow-lg overflow-hidden cursor-default relative flex-grow"
        style={{
          cursor: isDrawingMode ? 'crosshair' : isPanning ? 'grabbing' : 'default',
          overscrollBehavior: 'none',
          touchAction: 'none'
        }}
      >
        {/* Floating Toolbar */}
        <div className="absolute bottom-4 left-[calc(50%-10.5rem)] transform -translate-x-1/2 z-50 px-4 py-2 bg-white rounded-full shadow-lg border border-gray-200 flex gap-3 transition-all duration-300 hover:shadow-xl">
          <button
            onClick={() => {
              const centerPosition = calculateCenterPosition();
              setPan({ x: centerPosition.x, y: centerPosition.y });
              setZoomLevel(centerPosition.zoom);
            }}
            className="p-2 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 transition-colors"
            title="Fit All Columns"
          >
            <Focus className="w-4 h-4" />
            <span className="text-sm font-medium whitespace-nowrap">Center</span>
          </button>
          
          {/* Zoom indicator and controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Get the center point of the viewport
                const container = boardRef.current?.parentElement;
                if (!container) return;
                
                const rect = container.getBoundingClientRect();
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                // Calculate zoom factor and new zoom level
                const zoomFactor = 0.9; // 10% reduction
                const newZoom = Math.max(0.5, zoomLevel * zoomFactor);
                
                // Calculate new pan position to zoom out from center
                const newPan = {
                  x: pan.x + (centerX) * (1 - zoomFactor) / zoomLevel,
                  y: pan.y + (centerY) * (1 - zoomFactor) / zoomLevel
                };
                
                setZoomLevel(newZoom);
                setPan(newPan);
              }}
              className="p-2 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            
            <div className="text-xs font-medium text-gray-500 whitespace-nowrap">
              {Math.round(zoomLevel * 100)}%
            </div>
            
            <button
              onClick={() => {
                // Get the center point of the viewport
                const container = boardRef.current?.parentElement;
                if (!container) return;
                
                const rect = container.getBoundingClientRect();
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                // Calculate zoom factor and new zoom level
                const zoomFactor = 1.1; // 10% increase
                const newZoom = Math.min(3, zoomLevel * zoomFactor);
                
                // Calculate new pan position to zoom in toward center
                const newPan = {
                  x: pan.x - (centerX) * (zoomFactor - 1) / zoomLevel,
                  y: pan.y - (centerY) * (zoomFactor - 1) / zoomLevel
                };
                
                setZoomLevel(newZoom);
                setPan(newPan);
              }}
              className="p-2 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          
          {/* Drawing mode toggle button - always visible regardless of voting phase */}
          <button
            onClick={toggleDrawingMode}
            className={`p-2 rounded-full ${isDrawingMode ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-700'} hover:bg-blue-100 hover:text-blue-700 flex items-center gap-1.5 transition-colors`}
            title={isDrawingMode ? "Exit Drawing Mode" : "Draw on Whiteboard"}
          >
            <PencilLine className="w-4 h-4" />
            <span className="text-sm font-medium whitespace-nowrap">{isDrawingMode ? "Exit Drawing" : "Draw"}</span>
          </button>
          
          {/* Drawing options - only show when in drawing mode */}
          {isDrawingMode && (
            <div className="h-full flex items-center gap-2">
              <div className="flex gap-2 items-center">
                {DRAWING_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      setDrawingColor(color);
                      setIsEraser(false);
                    }}
                    className={`w-6 h-6 rounded-full cursor-pointer ${isEraser ? '' : drawingColor === color ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                    style={{ backgroundColor: color }}
                    title={`Use ${color === '#FF0000' ? 'Red' : color === '#0000FF' ? 'Blue' : 'Black'} Color`}
                  />
                ))}
                <button
                  onClick={toggleEraser}
                  className={`p-2 rounded-full ${isEraser ? 'bg-blue-100 text-blue-700 ring-2 ring-offset-1 ring-blue-500' : 'bg-gray-50 text-gray-700'} hover:bg-blue-100 flex items-center transition-colors`}
                  title="Eraser"
                >
                  <Eraser className="w-4 h-4" />
                </button>
              </div>
              <select 
                value={drawingWidth}
                onChange={(e) => setDrawingWidth(Number(e.target.value))}
                className="p-1 rounded bg-gray-50 text-xs h-8"
                title="Line Width"
              >
                <option value="1">Thin</option>
                <option value="3">Medium</option>
                <option value="5">Thick</option>
                <option value="8">Extra Thick</option>
              </select>
              {currentUser.isCreator && (
                <button
                  onClick={handleClearDrawings}
                  className="p-2 rounded-full bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-1.5 transition-colors"
                  title="Clear All Drawings"
                >
                  <Eraser className="w-4 h-4" />
                  <span className="text-sm font-medium whitespace-nowrap">Clear</span>
                </button>
              )}
            </div>
          )}
          
          {/* Only show these buttons when NOT in drawing mode */}
          {!isDrawingMode && (
            <>
              {currentUser.isCreator && !isVotingPhase && (
                <button
                  onClick={handleAddColumn}
                  className="p-2 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 transition-colors"
                  title="Add Column"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium whitespace-nowrap">Add Column</span>
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
                    <span className="text-sm font-medium whitespace-nowrap">{isRevealed ? "Hide Notes" : "Show Notes"}</span>
                  </button>
                  
                  <div className="h-8 w-px bg-gray-200 mx-1"></div>
                  <button
                    onClick={handleToggleVotingPhase}
                    className={`p-2 rounded-full ${isVotingPhase ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-700'} hover:bg-indigo-100 hover:text-indigo-700 flex items-center gap-1.5 transition-colors`}
                    title={isVotingPhase ? "End Voting" : "Start Voting"}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span className="text-sm font-medium whitespace-nowrap">{isVotingPhase ? "End Voting" : "Start Voting"}</span>
                  </button>
                  
                  {isVotingPhase && (
                    <button
                      onClick={handleShowSummary}
                      className="p-2 rounded-full bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 text-white hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 flex items-center gap-1.5 transition-colors"
                      title="Generate AI Summary"
                      style={{ 
                        animation: 'gradientShift 3s ease infinite, glowPulse 2s ease-in-out infinite',
                        backgroundSize: '200% 200%'
                      }}
                    >
                      <Brain className="w-4 h-4" />
                      <span className="text-sm font-medium whitespace-nowrap">AI Summary</span>
                    </button>
                  )}
                </>
              )}
              
              {!currentUser.isCreator && isVotingPhase && (
                <div className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                  <ThumbsUp className="w-4 h-4" />
                  <span>Voting in progress</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Content area that pans with the board */}
        <div
          ref={boardRef}
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
            transformOrigin: '0 0',
            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
            height: 'auto',
            minHeight: '3000px'
          }}
        >
          {/* Column backgrounds, headers, and vertical dividers */}
          <div className="absolute inset-0 flex h-auto" style={{ 
            width: `${columnsArray.reduce((sum, col) => sum + col.position.width, 0)}px`,
            minHeight: '100%',
            zIndex: 10
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
          
          {/* Drawing layer - SVG for better performance */}
          <svg 
            className="absolute inset-0 pointer-events-none" 
            style={{ 
              minHeight: '3000px', 
              width: '100%',
              minWidth: `${columnsArray.reduce((sum, col) => sum + col.position.width, 0)}px`,
              zIndex: 20
            }}
          >
            {/* Render all saved drawings */}
            {Object.values(drawings).map((path) => (
              <polyline
                key={path.id}
                points={path.points.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={path.color}
                strokeWidth={path.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            
            {/* Render current drawing path */}
            {currentPath && (
              <polyline
                points={currentPath.points.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={currentPath.color}
                strokeWidth={currentPath.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>

          {/* Sticky Notes */}
          <div style={{ position: 'relative', zIndex: 30 }}>
            {stickyNotesArray.map((note) => (
              <StickyNoteComponent
                key={note.id}
                note={note}
                sessionId={sessionId}
                currentUser={currentUser}
                isRevealed={isRevealed}
                author={users[note.authorId]}
                isVotingPhase={isVotingPhase}
                zoomLevel={zoomLevel}
              />
            ))}
          </div>

          {/* Drawing overlay to capture mouse events when in drawing mode */}
          {isDrawingMode && (
            <div 
              className="absolute inset-0 cursor-crosshair" 
              style={{ 
                zIndex: 40,
                minHeight: '3000px',
                minWidth: `${columnsArray.reduce((sum, col) => sum + col.position.width, 0)}px`
              }}
              onMouseDown={handleStartDrawing}
              onMouseMove={isEraser || isDrawing ? handleDrawing : undefined}
              onMouseUp={handleEndDrawing}
              onMouseLeave={handleEndDrawing}
            />
          )}
          
          {/* User cursors - moved inside the transformed container */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 45 }}>
            {cursors.map(({ userId, user, position }) => (
              <div
                key={userId}
                className="absolute pointer-events-none"
                style={{
                  left: position.x,
                  top: position.y,
                  transform: 'translate(-50%, -50%)',
                  transition: 'left 0.2s ease-out, top 0.2s ease-out',
                  width: '32px',
                  height: '32px',
                  transformOrigin: 'center',
                  transformStyle: 'preserve-3d'
                }}
              >
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border-2 border-white shadow-md bg-gray-100"
                  style={{ width: '32px', height: '32px', objectFit: 'cover' }}
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
      
      {/* RetroSummary Modal */}
      {showSummary && (
        <RetroSummary
          sessionId={sessionId}
          icebreakerState={icebreakerState}
          users={users}
          stickyNotes={stickyNotes}
          columns={columns}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}

export default Whiteboard;