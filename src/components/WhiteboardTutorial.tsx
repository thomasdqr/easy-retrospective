import React, { useState, useEffect, useRef } from 'react';
import { Move, ZoomIn, StickyNote as StickyNoteIcon } from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isCompleted: boolean;
}

interface WhiteboardTutorialProps {
  onClose: () => void;
  zoomLevel: number;
  onPan: (hasPanned: boolean) => void;
  hasPanned: boolean;
  hasZoomed: boolean;
  onZoom: (hasZoomed: boolean) => void;
  hasStickyNoteCreated: boolean;
  onStickyNoteCreated: (hasCreated: boolean) => void;
}

function WhiteboardTutorial({
  onClose,
  zoomLevel,
  hasPanned,
  hasZoomed,
  onZoom,
  hasStickyNoteCreated
}: WhiteboardTutorialProps) {
  const startingZoomLevel = useRef(zoomLevel);
  const initialZoomOccurred = useRef(false);
  const userInteracted = useRef(false);
  
  const [steps, setSteps] = useState<TutorialStep[]>([
    {
      id: 'pan',
      title: 'Move Around',
      description: 'Click and drag the board (or use two fingers on trackpad) to move around',
      icon: <Move className="w-5 h-5" />,
      isCompleted: hasPanned
    },
    {
      id: 'zoom',
      title: 'Zoom In/Out',
      description: 'Use Ctrl + Scroll (or pinch gesture) to zoom in and out',
      icon: <ZoomIn className="w-5 h-5" />,
      isCompleted: hasZoomed
    },
    {
      id: 'sticky',
      title: 'Create a Sticky Note',
      description: 'Click on the board to create a new sticky note',
      icon: <StickyNoteIcon className="w-5 h-5" />,
      isCompleted: hasStickyNoteCreated
    }
  ]);
  
  // Store initial state
  useEffect(() => {
    // Wait a bit to capture the initial auto-zoom level
    const timer = setTimeout(() => {
      startingZoomLevel.current = zoomLevel;
      initialZoomOccurred.current = true;
    }, 1500); // Allow enough time for initial zoom animations
    
    // Add a global interaction listener to detect when user has started interacting
    const handleUserInteraction = () => {
      userInteracted.current = true;
    };
    
    window.addEventListener('mousedown', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);
    window.addEventListener('wheel', handleUserInteraction);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('wheel', handleUserInteraction);
    };
  }, [zoomLevel]);

  // Update step completion status when props change
  useEffect(() => {
    setSteps(prevSteps => prevSteps.map(step => {
      if (step.id === 'pan') return { ...step, isCompleted: hasPanned };
      if (step.id === 'zoom') return { ...step, isCompleted: hasZoomed };
      if (step.id === 'sticky') return { ...step, isCompleted: hasStickyNoteCreated };
      return step;
    }));
  }, [hasPanned, hasZoomed, hasStickyNoteCreated]);

  // Check for zoom changes
  useEffect(() => {
    // Only detect zoom after initial setup and user interaction
    if (
      initialZoomOccurred.current && 
      userInteracted.current && 
      Math.abs(zoomLevel - startingZoomLevel.current) > 0.1
    ) {
      onZoom(true);
    }
  }, [zoomLevel, onZoom]);

  // Calculate completion percentage
  const completedSteps = steps.filter(step => step.isCompleted).length;
  const completionPercentage = Math.round((completedSteps / steps.length) * 100);

  // Check if all steps are completed
  const allCompleted = completedSteps === steps.length;

  return (
    <div className="fixed top-1/2 -translate-y-1/2 left-8 bg-white rounded-lg shadow-xl w-80 z-50 overflow-hidden">
      <div className="bg-indigo-600 text-white px-4 py-3 flex justify-between items-center">
        <h3 className="font-medium">Interactive Tutorial</h3>
        <div className="text-xs font-semibold">{completionPercentage}% complete</div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        
        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step) => (
            <div 
              key={step.id}
              className={`flex items-start p-3 rounded-lg border ${
                step.isCompleted 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className={`flex-shrink-0 rounded-full p-2 mr-3 ${
                step.isCompleted ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600'
              }`}>
                {step.icon}
              </div>
              <div>
                <h4 className="font-medium flex items-center">
                  {step.title}
                  {step.isCompleted && (
                    <span className="ml-2 text-green-600 text-xs font-bold">✓ COMPLETED</span>
                  )}
                </h4>
                <p className="text-sm text-gray-600 mt-1">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
        
        {/* Buttons */}
        <div className="flex justify-between pt-2">
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 text-sm font-medium"
          >
            Skip Tutorial
          </button>
          
          {allCompleted && (
            <button
              onClick={onClose}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Finish Tutorial
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default WhiteboardTutorial; 