import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { updateIcebreakerState, subscribeToIcebreakerState } from '../../../services/realtimeDbService';
import { IcebreakerProps, Statement, IcebreakerGameState } from '../types';
import { shuffleArray, checkAllSubmitted, checkAllVoted, isLastUser as checkIsLastUser, getValidUserIds } from '../utils';
import { USER_SESSION_KEY } from '../../../constants';

// Import sub-components
import SubmissionForm from '../SubmissionForm';
import WaitingRoom from '../WaitingRoom';
import UserStatements from '../UserStatements';
import ResultsNavigation from '../ResultsNavigation';
import RevealButton from '../RevealButton';
import Leaderboard from '../Leaderboard';

// Import firebase directly to add individual users
import { ref, set } from 'firebase/database';
import { realtimeDb } from '../../../config/firebase';

const TwoTruthsOneLie: React.FC<IcebreakerProps> = ({ sessionId, currentUser, users, onComplete }) => {
  const [statements, setStatements] = useState<Statement[]>([
    { text: '', isLie: false, revealed: false },
    { text: '', isLie: false, revealed: false },
    { text: '', isLie: true, revealed: false }
  ]);
  
  const [gameState, setGameState] = useState<IcebreakerGameState>({
    users: {},
    activeUser: null,
    revealed: false
  });
  
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  
  // Generate a shuffled order for statements
  const statementOrder = useMemo(() => shuffleArray([0, 1, 2]), []);

  // Calculate game state flags
  const allSubmitted = checkAllSubmitted(gameState, users);
  const allVoted = checkAllVoted(gameState, users);
  const isLastUser = checkIsLastUser(gameState, users);

  // Reference to store previous userVotes
  const prevUserVotesRef = useRef(userVotes);

  const handleSetActiveUser = useCallback(async (userId: string) => {
    if (!currentUser.isCreator) return;
    
    const newState = {
      ...gameState,
      activeUser: userId,
      revealed: false, // Reset revealed state when changing user
      finalLeaderboard: false
    };
    
    await updateIcebreakerState(sessionId, newState);
  }, [currentUser.isCreator, gameState, sessionId]);

  useEffect(() => {
    console.log("Setting up subscription to icebreaker state");
    const unsubscribe = subscribeToIcebreakerState(sessionId, (state) => {
      if (state) {
        setGameState(state);
        
        // Update local vote tracking
        if (state.users && state.users[currentUser.id]?.votes) {
          const myVotes: Record<string, number> = {};
          
          Object.entries(state.users).forEach(([userId, userState]) => {
            if (userState.votes && userState.votes[currentUser.id] !== undefined) {
              myVotes[userId] = userState.votes[currentUser.id];
            }
          });
          
          setUserVotes(myVotes);
        }
      }
    });

    return () => {
      console.log("Cleaning up subscription to icebreaker state");
      unsubscribe();
    };
  }, [sessionId, currentUser.id]);

  // Set initial active user when all users have submitted
  useEffect(() => {
    if (allSubmitted && !gameState.activeUser && currentUser.isCreator) {
      // Set first user as active when all have submitted
      const validUserIds = getValidUserIds(users);
      if (validUserIds.length > 0) {
        handleSetActiveUser(validUserIds[0]);
      }
    }
  }, [allSubmitted, gameState.activeUser, currentUser.isCreator, users, handleSetActiveUser]);

  // Add debugging useEffect to track gameState changes
  useEffect(() => {
    console.log("GameState updated:", gameState);
    
    // Add specific logging for finalLeaderboard changes
    if (gameState.finalLeaderboard) {
      console.log("FINAL LEADERBOARD MODE ACTIVATED");
    }
  }, [gameState]);

  // Add useEffect to watch for retrospective start
  useEffect(() => {
    if (gameState.retrospectiveStarted) {
      console.log("Retrospective started, redirecting all users");
      onComplete();
    }
  }, [gameState.retrospectiveStarted, onComplete]);

  // Add useEffect to watch for kicked users
  useEffect(() => {
    // If the current user is no longer in the users list, they were kicked
    if (Object.keys(users).length > 0 && !users[currentUser.id]) {
      console.log("User was kicked from session");
      localStorage.removeItem(USER_SESSION_KEY);
      window.location.href = '/';
    }
  }, [users, currentUser.id]);

  // Add useEffect to initialize game state for users who rejoin
  useEffect(() => {
    if (!sessionId || !currentUser || !users[currentUser.id]) return;

    // Check if the user exists in the game state
    if (Object.keys(gameState.users || {}).length > 0 && !gameState.users[currentUser.id]) {
      console.log("Initializing game state for rejoined user");
      
      // Create the new user state
      const newUserState = {
        statements: {
          "0": { text: '', isLie: false, revealed: false },
          "1": { text: '', isLie: false, revealed: false },
          "2": { text: '', isLie: true, revealed: false }
        },
        votes: {},
        score: 0,
        statementOrder: shuffleArray([0, 1, 2])
      };

      // Prevent triggering another update if this effect runs while we're already waiting for an update
      const updatingRef = ref(realtimeDb, `sessions/${sessionId}/icebreaker/users/${currentUser.id}`);
      
      // Use Firebase to directly update just this user's data
      set(updatingRef, newUserState)
        .then(() => {
          console.log("New user added successfully without changing other users' data");
        })
        .catch(error => {
          console.error("Error adding new user:", error);
          
          // Fallback to the old method if direct update fails
          if (gameState.users) { // Extra check to prevent errors
            const updatedUsers = {
              ...gameState.users,
              [currentUser.id]: newUserState
            };
            
            const newState = {
              ...gameState,
              users: updatedUsers
            };
            
            updateIcebreakerState(sessionId, newState);
          }
        });
    }
  }, [sessionId, currentUser, users, gameState.users]);

  // Add useEffect to clean up votes from removed users
  useEffect(() => {
    // Only creators can clean up votes
    if (!currentUser.isCreator || !gameState.users || Object.keys(gameState.users).length === 0) return;

    const validUserIds = getValidUserIds(users);
    const gameStateUserIds = Object.keys(gameState.users);
    
    // Find users who exist in gameState but not in the valid users list
    const removedUserIds = gameStateUserIds.filter(id => !validUserIds.includes(id));

    // Only update userVotes if there are invalid votes
    const hasInvalidVotes = Object.keys(userVotes).some(key => !validUserIds.includes(key));
    if (hasInvalidVotes) {
      const filteredUserVotes = Object.fromEntries(
        Object.entries(userVotes).filter(([key]) => validUserIds.includes(key))
      );
      setUserVotes(filteredUserVotes);
    }
    
    if (removedUserIds.length === 0) return; // No cleanup needed
    
    console.log("Cleaning up votes from removed users:", removedUserIds);
    
    // Create a copy of the game state
    const updatedGameState = {...gameState};
    
    // For each active user in the game
    gameStateUserIds.forEach(userId => {
      // Skip if this user was also removed
      if (removedUserIds.includes(userId)) return;
      
      const userState = {...updatedGameState.users[userId]};
      let hasChanges = false;
      
      // If they have votes, remove votes for removed users
      if (userState.votes) {
        const updatedVotes = {...userState.votes};
        
        removedUserIds.forEach(removedId => {
          if (updatedVotes[removedId] !== undefined) {
            delete updatedVotes[removedId];
            hasChanges = true;
          }
        });
        
        if (hasChanges) {
          userState.votes = updatedVotes;
          updatedGameState.users[userId] = userState;
        }
      }
    });
    
    // Remove the removed users from the game state
    removedUserIds.forEach(id => {
      delete updatedGameState.users[id];
    });
    
    // Only update if changes were made
    if (removedUserIds.length > 0) {
      console.log("Updating game state to remove data from removed users");
      updateIcebreakerState(sessionId, updatedGameState);
    }
    
    // Update the ref after the effect runs
    prevUserVotesRef.current = userVotes;
  }, [gameState, users, currentUser.isCreator, sessionId]);

  const handleSubmit = async () => {
    if (statements.some(s => !s.text.trim())) {
      alert('Please fill in all statements');
      return;
    }

    const updatedUsers = {
      ...gameState.users,
      [currentUser.id]: {
        statements: {
          "0": statements[0],
          "1": statements[1],
          "2": statements[2]
        },
        votes: {},
        score: 0,
        statementOrder: statementOrder
      },
    };

    const newState = {
      ...gameState,
      users: updatedUsers
    };

    await updateIcebreakerState(sessionId, newState);
  };

  const handleVote = async (userId: string, statementIndex: number) => {
    if (userId === currentUser.id) return;
    
    // Update local state for immediate feedback
    setUserVotes({
      ...userVotes,
      [userId]: statementIndex
    });

    // Update votes in database
    const updatedUserState = {
      ...gameState.users[userId],
      votes: {
        ...gameState.users[userId].votes,
        [currentUser.id]: statementIndex
      }
    };

    const updatedUsers = {
      ...gameState.users,
      [userId]: updatedUserState
    };

    const newState = {
      ...gameState,
      users: updatedUsers
    };

    await updateIcebreakerState(sessionId, newState);
  };
  
  // Modify the showFinalLeaderboard function to prevent race conditions
  const showFinalLeaderboard = useCallback(async () => {
    if (!currentUser.isCreator) return;
    
    console.log("Showing leaderboard, current state:", gameState);
    
    // Create a completely new state object with only the properties we need
    const newState = {
      users: {...gameState.users},
      activeUser: null,
      revealed: true,
      finalLeaderboard: true,
      completed: true  // Add this to prevent any further state transitions
    };
    
    console.log("New leaderboard state:", newState);
    
    try {
      // Directly set the state locally first to prevent flickering
      setGameState(prev => ({
        ...prev,
        finalLeaderboard: true,
        activeUser: null,
        revealed: true,
        completed: true
      }));
      
      // Then update the database
      await updateIcebreakerState(sessionId, newState);
    } catch (error) {
      console.error("Error showing leaderboard:", error);
    }
  }, [currentUser.isCreator, gameState, sessionId]);

  // Add a function to handle the Show Final Leaderboard button click with debounce
  const handleShowLeaderboard = useCallback(() => {
    // Prevent multiple rapid clicks
    const button = document.querySelector('#show-leaderboard-button');
    if (button) {
      button.setAttribute('disabled', 'true');
      button.textContent = 'Loading...';
    }
    
    // Use setTimeout to allow React to flush state updates
    setTimeout(() => {
      showFinalLeaderboard();
    }, 100);
  }, [showFinalLeaderboard]);

  // Modify the handleNextUser function to ensure clean transition to leaderboard
  const handleNextUser = useCallback(async () => {
    if (!gameState.activeUser || !currentUser.isCreator) return;
    
    const validUserIds = getValidUserIds(users);
    const currentIndex = validUserIds.indexOf(gameState.activeUser);
    
    // If we're at the last user and already revealed
    if (currentIndex === validUserIds.length - 1 && gameState.revealed) {
      console.log("Last user reached and revealed, showing leaderboard");
      handleShowLeaderboard();
      return;
    }
    
    const nextIndex = (currentIndex + 1) % validUserIds.length;
    handleSetActiveUser(validUserIds[nextIndex]);
  }, [gameState.activeUser, gameState.revealed, currentUser.isCreator, users, handleSetActiveUser, handleShowLeaderboard]);
  
  const handlePrevUser = useCallback(() => {
    if (!gameState.activeUser || !currentUser.isCreator) return;
    
    const validUserIds = getValidUserIds(users);
    const currentIndex = validUserIds.indexOf(gameState.activeUser);
    const prevIndex = (currentIndex - 1 + validUserIds.length) % validUserIds.length;
    handleSetActiveUser(validUserIds[prevIndex]);
  }, [gameState.activeUser, currentUser.isCreator, users, handleSetActiveUser]);
  
  const handleReveal = useCallback(async () => {
    if (!currentUser.isCreator || !gameState.activeUser) return;
    
    // If already revealed, just toggle the revealed state without recalculating scores
    if (gameState.revealed) {
      const newState = {
        ...gameState,
        revealed: true
      };
      await updateIcebreakerState(sessionId, newState);
      return;
    }
    
    // Calculate which users voted correctly for this person's lie
    const activeUserState = gameState.users[gameState.activeUser];
    if (!activeUserState) return;
    
    // Find the index of the lie
    let lieIndex = -1;
    Object.entries(activeUserState.statements).forEach(([index, statement]) => {
      if (statement.isLie) {
        lieIndex = parseInt(index);
      }
    });
    
    if (lieIndex === -1) return;
    
    // Update scores for users who guessed correctly (only on first reveal)
    const updatedUsers = { ...gameState.users };
    const validUserIds = getValidUserIds(users);
    
    // Only process votes from valid users
    validUserIds.forEach(userId => {
      if (userId === gameState.activeUser) return; // Skip active user
      
      const userState = updatedUsers[userId];
      if (!userState) return; // Skip if user state doesn't exist
      
      const userVote = activeUserState.votes?.[userId];
      // If user voted for the correct lie
      if (userVote === lieIndex) {
        updatedUsers[userId] = {
          ...userState,
          score: (userState.score || 0) + 1
        };
      }
    });
    
    const newState = {
      ...gameState,
      revealed: true,
      users: updatedUsers
    };
    
    await updateIcebreakerState(sessionId, newState);
  }, [currentUser.isCreator, gameState, sessionId, users]);

  // Replace the direct onComplete call with a synchronized database update
  const handleStartRetrospective = useCallback(async () => {
    if (!currentUser.isCreator) return;
    
    console.log("Starting retrospective for all users");
    
    // Update the state to notify all users
    const newState = {
      ...gameState,
      retrospectiveStarted: true
    };
    
    try {
      // Disable the button to prevent multiple clicks
      const button = document.querySelector('#start-retrospective-button');
      if (button) {
        button.setAttribute('disabled', 'true');
        (button as HTMLButtonElement).textContent = 'Starting...';
      }
      
      // Update the database first
      await updateIcebreakerState(sessionId, newState);
      
      // Then update local state to show the loading indicator
      setGameState(prev => ({
        ...prev,
        retrospectiveStarted: true
      }));
      
      // onComplete will be called via the useEffect hook after the state update propagates
    } catch (error) {
      console.error("Error starting retrospective:", error);
      
      // Re-enable the button in case of error
      const button = document.querySelector('#start-retrospective-button');
      if (button) {
        button.removeAttribute('disabled');
        (button as HTMLButtonElement).textContent = 'Start Retrospective';
      }
    }
  }, [currentUser.isCreator, gameState, sessionId]);

  // Helper function to check if the current user has submitted valid statements
  const hasUserSubmitted = (userId: string): boolean => {
    const userStatements = gameState.users[userId]?.statements;
    if (!userStatements) return false;
    
    return Object.values(userStatements).every(statement => 
      statement && statement.text && statement.text.trim().length > 0
    );
  };

  return (
    <div className='flex flex-col items-center justify-center h-screen'>
      <div className="absolute top-4 left-4">
        <a href="/" className="flex items-center justify-center w-8 h-8 rounded-full bg-white/80 hover:bg-white shadow-sm text-indigo-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </a>
      </div>
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center p-6 bg-white/80 rounded-lg shadow-lg min-w-[50vw] min-h-[50vh] mt-20 mb-4">
        <div className="w-full overflow-y-auto">
          <h2 className="text-2xl font-bold mb-6 text-indigo-800">Two Truths and a Lie</h2>
          
          {/* Leaderboard Phase - Highest priority, render first */}
          {gameState.finalLeaderboard === true || gameState.completed === true ? (
            <div className="space-y-8">
              <Leaderboard 
                gameState={gameState} 
                currentUser={currentUser} 
                users={users} 
                handleStartRetrospective={handleStartRetrospective} 
              />
            </div>
          ) : (
            <>
              {/* Statement submission phase */}
              {!hasUserSubmitted(currentUser.id) && (
                <SubmissionForm 
                  statements={statements} 
                  setStatements={setStatements} 
                  onSubmit={handleSubmit} 
                />
              )}
              
              {/* Waiting for others to submit */}
              {hasUserSubmitted(currentUser.id) && !allSubmitted && (
                <WaitingRoom users={users} gameState={gameState} />
              )}
              
              {/* Voting Phase - Only show if the current user has submitted */}
              {hasUserSubmitted(currentUser.id) && allSubmitted && !allVoted && !gameState.finalLeaderboard && (
                <div className="space-y-8">
                  {/* Progress indicator */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 bg-indigo-600 rounded-full"
                        style={{
                          width: `${Object.keys(userVotes).length / (getValidUserIds(users).length - 1) * 100}%`
                        }}
                      ></div>
                    </div>
                    <div className="ml-4 text-sm font-medium text-gray-700">
                      {Object.keys(userVotes).length}/{getValidUserIds(users).length - 1} voted
                    </div>
                  </div>
                  
                  {/* All users' statements */}
                  {getValidUserIds(users).map(userId => (
                    <div key={userId}>
                      <UserStatements 
                        userId={userId}
                        gameState={gameState}
                        currentUser={currentUser}
                        users={users}
                        userVotes={userVotes}
                        handleVote={handleVote}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Results Phase - Only show if the current user has submitted */}
              {hasUserSubmitted(currentUser.id) && allSubmitted && allVoted && !gameState.finalLeaderboard && (
                <div className="space-y-8">
                  {/* Navigation controls */}
                  <ResultsNavigation 
                    gameState={gameState}
                    currentUser={currentUser}
                    users={users}
                    handlePrevUser={handlePrevUser}
                    handleNextUser={handleNextUser}
                    handleShowLeaderboard={handleShowLeaderboard}
                    isLastUser={isLastUser}
                  />
                  
                  {/* Active user statements */}
                  {gameState.activeUser && (
                    <UserStatements 
                      userId={gameState.activeUser}
                      gameState={gameState}
                      currentUser={currentUser}
                      users={users}
                      userVotes={userVotes}
                      handleVote={handleVote}
                    />
                  )}
                  
                  {/* Reveal button */}
                  <RevealButton 
                    currentUser={currentUser}
                    gameState={gameState}
                    handleReveal={handleReveal}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwoTruthsOneLie; 