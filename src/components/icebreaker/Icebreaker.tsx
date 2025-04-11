import React, { useState, useEffect, useMemo } from 'react';
import { updateIcebreakerState, subscribeToIcebreakerState } from '../../services/realtimeDbService';
import { IcebreakerProps, Statement, IcebreakerGameState } from './types';
import { shuffleArray, checkAllSubmitted, checkAllVoted, isLastUser as checkIsLastUser } from './utils';

// Import sub-components
import SubmissionForm from './SubmissionForm';
import WaitingRoom from './WaitingRoom';
import UserStatements from './UserStatements';
import ResultsNavigation from './ResultsNavigation';
import RevealButton from './RevealButton';
import Leaderboard from './Leaderboard';

const Icebreaker: React.FC<IcebreakerProps> = ({ sessionId, currentUser, users, onComplete }) => {
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
  const allSubmitted = checkAllSubmitted(gameState, Object.keys(users).length);
  const allVoted = checkAllVoted(gameState);
  const isLastUser = checkIsLastUser(gameState);

  useEffect(() => {
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

    return () => unsubscribe();
  }, [sessionId, currentUser.id]);

  // Set initial active user when all users have submitted
  useEffect(() => {
    if (allSubmitted && !gameState.activeUser && currentUser.isCreator) {
      // Set first user as active when all have submitted
      const firstUserId = Object.keys(gameState.users)[0];
      handleSetActiveUser(firstUserId);
    }
  }, [gameState.users, gameState.activeUser, currentUser.isCreator, allSubmitted]);

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
        hasSubmitted: true,
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
  
  const handleSetActiveUser = async (userId: string) => {
    if (!currentUser.isCreator) return;
    
    const newState = {
      ...gameState,
      activeUser: userId,
      revealed: false, // Reset revealed state when changing user
      finalLeaderboard: false
    };
    
    await updateIcebreakerState(sessionId, newState);
  };

  // Modify the handleNextUser function to ensure clean transition to leaderboard
  const handleNextUser = async () => {
    if (!gameState.activeUser || !currentUser.isCreator) return;
    
    const userIds = Object.keys(gameState.users);
    const currentIndex = userIds.indexOf(gameState.activeUser);
    
    // If we're at the last user and already revealed
    if (currentIndex === userIds.length - 1 && gameState.revealed) {
      console.log("Last user reached and revealed, showing leaderboard");
      handleShowLeaderboard(); // Use the debounced function
      return;
    }
    
    const nextIndex = (currentIndex + 1) % userIds.length;
    handleSetActiveUser(userIds[nextIndex]);
  };
  
  const handlePrevUser = () => {
    if (!gameState.activeUser || !currentUser.isCreator) return;
    
    const userIds = Object.keys(gameState.users);
    const currentIndex = userIds.indexOf(gameState.activeUser);
    const prevIndex = (currentIndex - 1 + userIds.length) % userIds.length;
    handleSetActiveUser(userIds[prevIndex]);
  };
  
  const handleReveal = async () => {
    if (!currentUser.isCreator || !gameState.activeUser) return;
    
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
    
    // Update scores for users who guessed correctly
    const updatedUsers = { ...gameState.users };
    
    Object.entries(updatedUsers).forEach(([userId, userState]) => {
      if (userId === gameState.activeUser) return; // Skip active user
      
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
  };

  // Modify the showFinalLeaderboard function to prevent race conditions
  const showFinalLeaderboard = async () => {
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
  };

  // Add a function to handle the Show Final Leaderboard button click with debounce
  const handleShowLeaderboard = () => {
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
  };

  // Replace the direct onComplete call with a synchronized database update
  const handleStartRetrospective = async () => {
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
  };

  return (
    <div className='flex flex-col items-center justify-center h-screen'>
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
              {!gameState.users[currentUser.id]?.hasSubmitted && (
                <SubmissionForm 
                  statements={statements} 
                  setStatements={setStatements} 
                  onSubmit={handleSubmit} 
                />
              )}
              
              {/* Waiting for others to submit */}
              {gameState.users[currentUser.id]?.hasSubmitted && !allSubmitted && (
                <WaitingRoom users={users} gameState={gameState} />
              )}
              
              {/* Voting Phase */}
              {allSubmitted && !allVoted && !gameState.finalLeaderboard && (
                <div className="space-y-8">
                  {/* Progress indicator */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 bg-indigo-600 rounded-full"
                        style={{
                          width: `${Object.keys(userVotes).length / (Object.keys(users).length - 1) * 100}%`
                        }}
                      ></div>
                    </div>
                    <div className="ml-4 text-sm font-medium text-gray-700">
                      {Object.keys(userVotes).length}/{Object.keys(users).length - 1} voted
                    </div>
                  </div>
                  
                  {/* All users' statements */}
                  {Object.keys(gameState.users).map(userId => (
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
              
              {/* Results Phase */}
              {allSubmitted && allVoted && !gameState.finalLeaderboard && (
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

export default Icebreaker; 