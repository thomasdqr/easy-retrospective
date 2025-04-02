import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '../types';
import UserOnboarding from '../components/UserOnboarding';
import UserList from '../components/UserList';
import Whiteboard from '../components/Whiteboard';
import { Eye, EyeOff } from 'lucide-react';
import { nanoid } from 'nanoid';
import { subscribeToSessionBasicInfo, addUserToSession } from '../services/firebaseService';
import { subscribeToSessionRevealed, toggleSessionReveal } from '../services/realtimeDbService';

// Constants for localStorage
const USER_SESSION_KEY = 'retrospective_user_session';

function Session() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [sessionBasicInfo, setSessionBasicInfo] = useState<{id: string, createdAt: number, users: Record<string, User>} | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }

    // Try to retrieve stored user session for this specific sessionId
    const storedSession = localStorage.getItem(USER_SESSION_KEY);
    if (storedSession) {
      try {
        const parsedSession = JSON.parse(storedSession);
        // Check if the stored session matches the current sessionId
        if (parsedSession.sessionId === sessionId) {
          setCurrentUser(parsedSession.user);
        }
      } catch (error) {
        console.error("Error parsing stored session:", error);
        localStorage.removeItem(USER_SESSION_KEY);
      }
    }

    // Subscribe to session basic info updates
    const unsubscribeBasicInfo = subscribeToSessionBasicInfo(
      sessionId,
      (basicInfoData) => {
        setSessionBasicInfo(basicInfoData);
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to session basic info:", error);
        if (error.message === 'Session not found') {
          alert('The session you are trying to access does not exist or has been deleted.');
        } else {
          alert('An error occurred while loading the session. Please try again later.');
        }
        navigate('/');
      }
    );

    // Subscribe to isRevealed status from Realtime DB
    const unsubscribeRevealed = subscribeToSessionRevealed(
      sessionId,
      (revealedStatus) => {
        console.log('Received revealed status update:', revealedStatus);
        setIsRevealed(revealedStatus);
      }
    );

    return () => {
      unsubscribeBasicInfo();
      unsubscribeRevealed();
    };
  }, [sessionId, navigate]);

  const handleUserComplete = async (userData: Omit<User, 'id'>) => {
    if (!sessionId || !sessionBasicInfo) return;

    const userId = nanoid();
    const user: User = {
      ...userData,
      id: userId
    };

    // Add user using the service for basic user data
    await addUserToSession(sessionId, userId, user);
    
    // Save user session in localStorage
    const sessionData = {
      sessionId,
      user
    };
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(sessionData));
    
    setCurrentUser(user);
  };

  const handleToggleReveal = async () => {
    if (!sessionId || !currentUser?.isCreator) return;

    // Toggle local state immediately for responsive UI
    const newRevealedState = !isRevealed;
    console.log('Toggling from', isRevealed, 'to', newRevealedState);
    setIsRevealed(newRevealedState);
    
    // Toggle session reveal status in Realtime DB
    await toggleSessionReveal(sessionId, newRevealedState);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <UserOnboarding
        onComplete={handleUserComplete}
        isCreator={sessionBasicInfo ? Object.keys(sessionBasicInfo.users || {}).length === 0 : false}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-purple-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Retrospective Board</h1>
          {currentUser.isCreator && (
            <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-lg shadow-sm">
              <span className="text-sm text-gray-600">{isRevealed ? 'Visible Notes' : 'Hidden Notes'}</span>
              <label className="inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox"
                  className="sr-only peer" 
                  checked={isRevealed}
                  onChange={handleToggleReveal}
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:translate-x-[-100%] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-2">
                  {isRevealed ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {/* Main whiteboard area */}
          <div className="flex-1 bg-white rounded-lg shadow-lg min-h-[calc(100vh-8rem)]">
            {sessionBasicInfo && sessionId && (
              <Whiteboard
                sessionId={sessionId}
                currentUser={currentUser}
                users={sessionBasicInfo.users}
              />
            )}
          </div>
          
          {/* User list sidebar */}
          <UserList users={sessionBasicInfo?.users || {}} />
        </div>
      </div>
    </div>
  );
}

export default Session;