import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '../types';
import UserOnboarding from '../components/UserOnboarding';
import UserList from '../components/UserList';
import Whiteboard from '../components/Whiteboard';
import Icebreaker from '../components/Icebreaker';
import Timer from '../components/Timer';
import VoteSummary from '../components/VoteSummary';
import { Copy, EyeOff, ThumbsUp } from 'lucide-react';
import { nanoid } from 'nanoid';
import { subscribeToSessionBasicInfo, addUserToSession, updateSessionBasicInfo } from '../services/firebaseService';
import { subscribeToSessionRevealed, toggleSessionReveal, subscribeToIcebreakerState, subscribeToVotingPhase, subscribeToStickyNotes } from '../services/realtimeDbService';
import { USER_SESSION_KEY } from '../constants';
import { StickyNote } from '../types';
import { IcebreakerType, DEFAULT_ICEBREAKER } from '../types/icebreaker';
import { ref, onValue } from 'firebase/database';
import { realtimeDb } from '../config/firebase';

// Key for storing retrospective started status in localStorage
const RETROSPECTIVE_STARTED_KEY = 'retrospective_started_';

function Session() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [sessionBasicInfo, setSessionBasicInfo] = useState<{id: string, createdAt: number, users: Record<string, User>, icebreakerType?: IcebreakerType} | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [isVotingPhase, setIsVotingPhase] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [icebreakerCompleted, setIcebreakerCompleted] = useState(false);
  const [retrospectiveStarted, setRetrospectiveStarted] = useState(false);
  const [showVoteSummary, setShowVoteSummary] = useState(false);
  const [stickyNotes, setStickyNotes] = useState<Record<string, StickyNote>>({});
  const [currentIcebreakerType, setCurrentIcebreakerType] = useState<IcebreakerType | undefined>(undefined);

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

    // Subscribe to icebreaker type from Realtime DB
    const unsubscribeIcebreakerType = onValue(
      ref(realtimeDb, `sessions/${sessionId}/icebreakerType`),
      (snapshot) => {
        const type = snapshot.val() as IcebreakerType | null;
        setCurrentIcebreakerType(type || DEFAULT_ICEBREAKER);
      }
    );

    // Subscribe to voting phase status
    const unsubscribeVoting = subscribeToVotingPhase(
      sessionId,
      (votingPhaseStatus) => {
        console.log('Received voting phase update:', votingPhaseStatus);
        setIsVotingPhase(votingPhaseStatus);
        // Hide vote summary when voting starts
        if (votingPhaseStatus) {
          setShowVoteSummary(false);
        }
      }
    );

    // Subscribe to sticky notes
    const unsubscribeStickyNotes = subscribeToStickyNotes(
      sessionId,
      (stickyNotesData) => {
        setStickyNotes(stickyNotesData);
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
      unsubscribeStickyNotes();
      unsubscribeIcebreakerType();
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

  const handleUserComplete = async (userData: Omit<User, 'id'>, icebreakerType?: IcebreakerType) => {
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

    // If the user is a creator and specified an icebreaker type, update both databases
    if (user.isCreator && icebreakerType) {
      try {
        // Update Firestore
        await updateSessionBasicInfo(sessionId, { icebreakerType });

        // Update Realtime Database
        const { set, ref } = await import('firebase/database');
        const { realtimeDb } = await import('../config/firebase');
        const icebreakerTypeRef = ref(realtimeDb, `sessions/${sessionId}/icebreakerType`);
        await set(icebreakerTypeRef, icebreakerType);
      } catch (error) {
        console.error('Error updating icebreaker type:', error);
      }
    }
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

  // Handle voting end notification from Whiteboard
  const handleVotingEnd = (hasVotes: boolean) => {
    if (hasVotes) {
      setShowVoteSummary(true);
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
    // Check if the creator is the only person in the session
    const isCreatorAlone = currentUser?.isCreator && Object.keys(sessionBasicInfo.users || {}).length === 1;
    
    // Use the current icebreaker type from Realtime DB
    const icebreakerType = currentIcebreakerType || DEFAULT_ICEBREAKER;

    return (
      <div className="min-h-screen bg-linear-to-br from-indigo-100 to-purple-100">
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm p-4">
          <div className="flex justify-between items-center mx-1">
            <div className="flex items-center">
              <a href="/" className="flex items-center justify-center w-8 h-8 rounded-full mr-2 bg-white/80 hover:bg-white shadow-sm text-indigo-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </a>
              <h1 className="text-2xl font-bold text-gray-900">Icebreaker</h1>
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

        {isCreatorAlone ? (
          <div className="flex flex-col items-center justify-center h-screen pt-16">
            <div className="max-w-4xl mx-auto flex flex-col items-center justify-center p-8 bg-white/80 rounded-lg shadow-lg min-w-[50vw] min-h-[40vh] mt-8 mb-4 text-center">
              <h2 className="text-3xl font-bold mb-6 text-indigo-800">Waiting for participants...</h2>
              <p className="text-xl text-gray-700 mb-6">Share the invite link above to invite others to your session.</p>
              <div className="animate-pulse flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500">The icebreaker will start when others join</p>
              </div>
            </div>
            <div className="fixed bottom-4 right-4 z-50 w-80">
              <UserList 
                users={sessionBasicInfo.users || {}} 
                sessionId={sessionId}
                currentUser={currentUser}
              />
            </div>
          </div>
        ) : (
          <>
            <Icebreaker
              sessionId={sessionId}
              currentUser={currentUser}
              users={sessionBasicInfo.users}
              onComplete={handleIcebreakerComplete}
              icebreakerType={icebreakerType}
            />

            <div className="fixed bottom-4 right-4 z-50 w-80">
              <UserList 
                users={sessionBasicInfo.users || {}} 
                sessionId={sessionId}
                currentUser={currentUser}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-100 to-purple-100">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm p-4 shadow-sm">
        <div className="flex justify-between items-center mx-1">
          <div className="flex items-center">
            <a href="/" className="flex items-center justify-center w-8 h-8 rounded-full mr-2 bg-white/80 hover:bg-white shadow-sm text-indigo-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </a>
            <h1 className="text-2xl font-bold text-gray-900">Retrospective Board</h1>
          </div>
          
          <div className="absolute left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-2">
              {!isRevealed && (
                <div className="flex items-center gap-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                  <EyeOff className="w-4 h-4" />
                  <span>Stickies are hidden</span>
                </div>
              )}
              {isVotingPhase && (
                <div className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
                  <ThumbsUp className="w-4 h-4" />
                  <span>Voting in progress</span>
                </div>
              )}
            </div>
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
            onVotingEnd={handleVotingEnd}
            icebreakerType={currentIcebreakerType || DEFAULT_ICEBREAKER}
          />
        )}
      </div>
      
      {/* Unified bottom bar with Timer, Vote Summary and User list */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-4 w-80">
        {showVoteSummary && !isVotingPhase && sessionId && (
          <VoteSummary stickyNotes={stickyNotes} users={sessionBasicInfo?.users || {}} />
        )}
        {currentUser && sessionId && (
          <Timer currentUser={currentUser} sessionId={sessionId} />
        )}
        {sessionBasicInfo && sessionId && (
          <UserList 
            users={sessionBasicInfo.users || {}} 
            sessionId={sessionId}
            currentUser={currentUser}
          />
        )}
      </div>

      {/* Add keyframe animations for the gradient effects */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes glowPulse {
          0% { box-shadow: 0 0 10px rgba(99, 102, 241, 0.4); }
          50% { box-shadow: 0 0 20px rgba(167, 139, 250, 0.6); }
          100% { box-shadow: 0 0 10px rgba(236, 72, 153, 0.4); }
        }
      `}} />
    </div>
  );
}

export default Session;