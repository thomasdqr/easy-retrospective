import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '../types';
import UserOnboarding from '../components/UserOnboarding';
import UserList from '../components/UserList';
import Whiteboard from '../components/Whiteboard';
import Icebreaker from '../components/Icebreaker';
import Timer from '../components/Timer';
import { Copy, EyeOff, ThumbsUp } from 'lucide-react';
import { nanoid } from 'nanoid';
import { subscribeToSessionBasicInfo, addUserToSession } from '../services/firebaseService';
import { subscribeToSessionRevealed, toggleSessionReveal, subscribeToIcebreakerState, subscribeToVotingPhase } from '../services/realtimeDbService';
import { USER_SESSION_KEY } from '../constants';

// Key for storing retrospective started status in localStorage
const RETROSPECTIVE_STARTED_KEY = 'retrospective_started_';

function Session() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [sessionBasicInfo, setSessionBasicInfo] = useState<{id: string, createdAt: number, users: Record<string, User>} | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [isVotingPhase, setIsVotingPhase] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [icebreakerCompleted, setIcebreakerCompleted] = useState(false);
  const [retrospectiveStarted, setRetrospectiveStarted] = useState(false);

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

    // Check if retrospective has already been started for this session
    const retrospectiveStartedKey = `${RETROSPECTIVE_STARTED_KEY}${sessionId}`;
    const hasRetrospectiveStarted = localStorage.getItem(retrospectiveStartedKey) === 'true';
    if (hasRetrospectiveStarted) {
      setIcebreakerCompleted(true);
      setRetrospectiveStarted(true);
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

    // Subscribe to voting phase status
    const unsubscribeVoting = subscribeToVotingPhase(
      sessionId,
      (votingPhaseStatus) => {
        console.log('Received voting phase update:', votingPhaseStatus);
        setIsVotingPhase(votingPhaseStatus);
      }
    );

    // Subscribe to icebreaker state to detect when retrospective is started
    const unsubscribeIcebreaker = subscribeToIcebreakerState(
      sessionId,
      (icebreakerState) => {
        if (icebreakerState?.retrospectiveStarted) {
          // If retrospective has been started, save to localStorage and update state
          localStorage.setItem(retrospectiveStartedKey, 'true');
          setIcebreakerCompleted(true);
          setRetrospectiveStarted(true);
        }
      }
    );

    return () => {
      unsubscribeBasicInfo();
      unsubscribeRevealed();
      unsubscribeIcebreaker();
      unsubscribeVoting();
    };
  }, [sessionId, navigate]);

  // Handle kicked users
  useEffect(() => {
    if (sessionBasicInfo && currentUser && Object.keys(sessionBasicInfo.users).length > 0 && !sessionBasicInfo.users[currentUser.id]) {
      console.log("User was kicked from session");
      localStorage.removeItem(USER_SESSION_KEY);
      navigate('/');
    }
  }, [sessionBasicInfo, currentUser, navigate]);

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

  const handleCopyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(
      () => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };

  const handleIcebreakerComplete = () => {
    setIcebreakerCompleted(true);
    // If the completion was due to retrospective starting, save to localStorage
    if (retrospectiveStarted && sessionId) {
      localStorage.setItem(`${RETROSPECTIVE_STARTED_KEY}${sessionId}`, 'true');
    }
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

  if (!icebreakerCompleted && sessionBasicInfo && sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-purple-100">
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm p-4">
          <div className="flex justify-between items-center mx-1">
            <h1 className="text-2xl font-bold text-gray-900">Icebreaker</h1>
            {currentUser?.isCreator && (
              <div className="flex items-center">
                <div className="bg-white border border-gray-300 rounded-l-md px-3 py-2 flex-1 text-sm text-gray-700 truncate max-w-[200px]">
                  {window.location.href}
                </div>
                <button
                  onClick={handleCopyInviteLink}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-r-md border border-l-0 border-gray-300 ${
                    copySuccess ? 'bg-green-500 text-white' : 'bg-white hover:bg-gray-50 text-gray-700'
                  } transition-colors duration-300 shadow-sm`}
                  title="Copy invite link to clipboard"
                >
                  <Copy className="w-4 h-4" />
                  {copySuccess ? 'Copied!' : 'Invite to Session'}
                </button>
              </div>
            )}
          </div>
        </div>

        <Icebreaker
          sessionId={sessionId}
          currentUser={currentUser}
          users={sessionBasicInfo.users}
          onComplete={handleIcebreakerComplete}
        />

        <div className="fixed bottom-4 right-4 z-50">
          <UserList 
            users={sessionBasicInfo.users || {}} 
            sessionId={sessionId}
            currentUser={currentUser}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-purple-100">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm p-4 shadow-sm">
        <div className="flex justify-between items-center mx-1">
          <h1 className="text-2xl font-bold text-gray-900">Retrospective Board</h1>
          
          <div className="absolute left-1/2 -translate-x-1/2">
            {!isRevealed && (
              <div className="flex items-center gap-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                <EyeOff className="w-4 h-4" />
                <span>Notes are hidden</span>
              </div>
            )}
            {isVotingPhase && (
              <div className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium ml-2">
                <ThumbsUp className="w-4 h-4" />
                <span>Voting in progress</span>
              </div>
            )}
          </div>
          
          {currentUser?.isCreator && (
            <div className="flex items-center">
              <div className="bg-white border border-gray-300 rounded-l-md px-3 py-2 flex-1 text-sm text-gray-700 truncate max-w-[200px]">
                {window.location.href}
              </div>
              <button
                onClick={handleCopyInviteLink}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-r-md border border-l-0 border-gray-300 ${
                  copySuccess ? 'bg-green-500 text-white' : 'bg-white hover:bg-gray-50 text-gray-700'
                } transition-colors duration-300 shadow-sm`}
                title="Copy invite link to clipboard"
              >
                <Copy className="w-4 h-4" />
                {copySuccess ? 'Copied!' : 'Invite to Session'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="h-screen">
        {sessionBasicInfo && sessionId && (
          <Whiteboard
            sessionId={sessionId}
            currentUser={currentUser}
            users={sessionBasicInfo.users}
            isRevealed={isRevealed}
            onToggleReveal={currentUser.isCreator ? handleToggleReveal : undefined}
            isVotingPhase={isVotingPhase}
          />
        )}
      </div>
      
      {/* Bottom bar with Timer and User list */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-4">
        {currentUser && <Timer currentUser={currentUser} sessionId={sessionId || ''} />}
        <UserList 
          users={sessionBasicInfo?.users || {}} 
          sessionId={sessionId || ''}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
}

export default Session;