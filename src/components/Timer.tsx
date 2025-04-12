import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Timer as TimerIcon } from 'lucide-react';
import { User } from '../types';
import { ref, onValue, set } from 'firebase/database';
import { realtimeDb } from '../config/firebase';

interface TimerProps {
  currentUser: User;
  sessionId: string;
}

interface TimerState {
  timeLeft: number;
  isRunning: boolean;
}

const Timer: React.FC<TimerProps> = ({ currentUser, sessionId }) => {
  const [minutes, setMinutes] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [showInput, setShowInput] = useState<boolean>(false);

  useEffect(() => {
    const timerRef = ref(realtimeDb, `sessions/${sessionId}/timer`);
    
    const unsubscribe = onValue(timerRef, (snapshot) => {
      const data = snapshot.val() as TimerState | null;
      if (data) {
        setTimeLeft(data.timeLeft);
        setIsRunning(data.isRunning);
      }
    });

    return () => unsubscribe();
  }, [sessionId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(async () => {
        const newTimeLeft = timeLeft - 1;
        setTimeLeft(newTimeLeft);
        
        if (currentUser.isCreator) {
          const timerRef = ref(realtimeDb, `sessions/${sessionId}/timer`);
          await set(timerRef, {
            timeLeft: newTimeLeft,
            isRunning: newTimeLeft > 0
          });
        }

        if (newTimeLeft <= 0) {
          setIsRunning(false);
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, timeLeft, sessionId, currentUser.isCreator]);

  const handleStartTimer = async () => {
    if (minutes > 0) {
      const newTimeLeft = minutes * 60;
      setTimeLeft(newTimeLeft);
      setIsRunning(true);
      setShowInput(false);

      const timerRef = ref(realtimeDb, `sessions/${sessionId}/timer`);
      await set(timerRef, {
        timeLeft: newTimeLeft,
        isRunning: true
      });
    }
  };

  const handlePauseTimer = async () => {
    setIsRunning(false);
    const timerRef = ref(realtimeDb, `sessions/${sessionId}/timer`);
    await set(timerRef, {
      timeLeft,
      isRunning: false
    });
  };

  const handleStopTimer = async () => {
    setIsRunning(false);
    setTimeLeft(0);
    setShowInput(false);

    const timerRef = ref(realtimeDb, `sessions/${sessionId}/timer`);
    await set(timerRef, {
      timeLeft: 0,
      isRunning: false
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentUser.isCreator && timeLeft === 0) {
    return null;
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-lg p-4 border border-gray-100">
      <div className="flex items-center gap-4">
        {showInput && currentUser.isCreator ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="60"
                value={minutes}
                onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
                className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm"
                placeholder="Mins"
              />
              <span className="text-sm text-gray-600">minutes</span>
            </div>
            <button
              onClick={handleStartTimer}
              disabled={minutes <= 0}
              className="p-1.5 rounded-md bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 px-3"
            >
              <Play className="w-4 h-4" />
              <span className="text-sm">Start</span>
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <TimerIcon className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium">{formatTime(timeLeft)}</span>
            </div>
            {currentUser.isCreator && (
              <div className="flex items-center gap-1">
                {timeLeft > 0 && (
                  <>
                    {isRunning ? (
                      <button
                        onClick={handlePauseTimer}
                        className="p-1.5 rounded-full bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsRunning(true)}
                        className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={handleStopTimer}
                      className="p-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  </>
                )}
                {timeLeft === 0 && (
                  <button
                    onClick={() => setShowInput(true)}
                    className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center gap-2 px-3"
                  >
                    <span className="text-sm">Add timer</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Timer; 