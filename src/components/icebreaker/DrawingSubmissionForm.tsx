import React, { useRef, useEffect, useState } from 'react';
import { SubmissionFormProps } from './types';

const DrawingSubmissionForm: React.FC<SubmissionFormProps> = ({
  drawing,
  setDrawing,
  onSubmit
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size
    canvas.width = 500;
    canvas.height = 300;

    // Set initial styles
    context.strokeStyle = '#000';
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.lineWidth = 2;

    // Set white background
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    setCtx(context);
  }, []);

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
      
      <div className="mb-6">
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            className="cursor-crosshair"
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