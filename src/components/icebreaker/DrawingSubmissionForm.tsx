import React, { useRef, useEffect, useState } from 'react';
import { SubmissionFormProps } from './types';

const DrawingSubmissionForm: React.FC<SubmissionFormProps> = ({
  drawing,
  setDrawing,
  onSubmit
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [brushSize, setBrushSize] = useState(2);
  const [brushColor, setBrushColor] = useState('#000');
  const [isEraser, setIsEraser] = useState(false);

  // Colors for the palette
  const colors = ['#000', '#f44336', '#2196f3', '#4caf50', '#ffeb3b', '#ff9800', '#9c27b0'];

  // Resize the canvas to match its container
  const resizeCanvas = () => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    // Get the container's width
    const containerWidth = container.clientWidth;
    
    // Set canvas dimensions to match container
    canvas.width = containerWidth;
    canvas.height = 300;

    // Re-initialize the context after resize
    const context = canvas.getContext('2d');
    if (!context) return;

    // Reset styles
    context.strokeStyle = '#000';
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.lineWidth = 2;

    // Set white background
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    setCtx(context);
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize canvas
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    setCtx(context);
    
    // Resize canvas initially
    resizeCanvas();
    
    // Add resize event listener
    window.addEventListener('resize', resizeCanvas);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Update brush settings when they change
  useEffect(() => {
    if (!ctx) return;
    
    // Set stroke style based on whether eraser is active or not
    if (isEraser) {
      ctx.strokeStyle = '#fff';
    } else {
      ctx.strokeStyle = brushColor;
    }
    
    ctx.lineWidth = brushSize;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }, [ctx, brushColor, brushSize, isEraser]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ctx || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setLastX(x);
    setLastY(y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctx || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    setLastX(x);
    setLastY(y);
  };

  const stopDrawing = () => {
    if (!isDrawing || !canvasRef.current) return;

    setIsDrawing(false);
    // Save the drawing
    const imageData = canvasRef.current.toDataURL();
    setDrawing?.({
      ...drawing!,
      imageData
    });
  };

  const clearCanvas = () => {
    if (!ctx || !canvasRef.current) return;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setDrawing?.({
      ...drawing!,
      imageData: ''
    });
  };

  const toggleEraser = () => {
    setIsEraser(!isEraser);
  };

  const handleSubmit = () => {
    if (!drawing?.imageData) {
      alert('Please draw something first!');
      return;
    }
    if (!drawing?.description.trim()) {
      alert('Please provide a description of your drawing!');
      return;
    }
    onSubmit();
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <p className="mb-6 text-gray-700">Draw what you did during your weekend:</p>
      
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {colors.map(color => (
              <button
                key={color}
                onClick={() => { setBrushColor(color); setIsEraser(false); }}
                className={`w-8 h-8 rounded-full ${brushColor === color && !isEraser ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                style={{ backgroundColor: color }}
                aria-label={`Select ${color} color`}
              />
            ))}
            <button
              onClick={toggleEraser}
              className={`ml-2 px-3 py-1 text-sm border border-gray-300 rounded ${isEraser ? 'bg-gray-200 font-bold' : 'bg-white'}`}
            >
              Eraser
            </button>
          </div>
          <div className="flex items-center">
            <span className="mr-2 text-sm text-gray-600">Brush size:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-24"
            />
          </div>
        </div>
        <div ref={containerRef} className="border border-gray-300 rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            className="cursor-crosshair w-full"
            style={{ touchAction: 'none' }}
          />
        </div>
        <div className="mt-2 flex justify-end">
          <button
            onClick={clearCanvas}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Clear Canvas
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description:
        </label>
        <input
          type="text"
          value={drawing?.description || ''}
          onChange={(e) => setDrawing?.({
            ...drawing!,
            description: e.target.value
          })}
          placeholder="Describe what you did during your weekend"
          className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <button
        onClick={handleSubmit}
        className="w-full bg-indigo-600 text-white px-6 py-3 rounded-md font-medium shadow-md hover:bg-indigo-700 transition-colors duration-200"
      >
        Submit
      </button>
    </div>
  );
};

export default DrawingSubmissionForm; 