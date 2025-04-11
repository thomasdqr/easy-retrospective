import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { updateIcebreakerState, subscribeToIcebreakerState } from '../services/realtimeDbService';

interface Statement {
  text: string;
  isLie: boolean;
  revealed: boolean;
}

interface PlayerState {
  statements: {
    "0": Statement;
    "1": Statement;
    "2": Statement;
  };
  hasSubmitted: boolean;
  votes: Record<string, number>; // userId -> statementIndex voted as lie
  score?: number;
  statementOrder?: number[]; // Shuffled order of statements [0,1,2]
}

interface IcebreakerGameState {
  users: Record<string, PlayerState>;
  activeUser: string | null;
  revealed: boolean;
  completed?: boolean;
  finalLeaderboard?: boolean;
  retrospectiveStarted?: boolean;
}

interface IcebreakerProps {
  sessionId: string;
  currentUser: User;
  users: Record<string, User>;
  onComplete: () => void;
}

// Utility function to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

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

  // Define allSubmitted before using it in useEffect
  const allSubmitted = Object.keys(gameState.users).length === Object.keys(users).length &&
    Object.values(gameState.users).every(state => state.hasSubmitted);
    
  // Check if all users have voted for all other users
  const allVoted = Object.keys(gameState.users).every(userId => {
    const votesReceived = Object.values(gameState.users).filter(state => 
      state.votes && state.votes[userId] !== undefined
    ).length;
    return votesReceived >= Object.keys(users).length - 1; // excluding self-vote
  });

  // Check if current user is viewing the last user
  const isLastUser = gameState.activeUser ? 
    Object.keys(gameState.users).indexOf(gameState.activeUser) === Object.keys(gameState.users).length - 1 
    : false;

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

  // Render the active user's statements for voting or results
  const renderUserStatements = (userId: string) => {
    const state = gameState.users[userId];
    const user = users[userId];
    if (!state || !user) return null;

    // Get the statements in display order
    const statementOrder = state.statementOrder || [0, 1, 2];
    const orderedStatements = statementOrder.map((index) => ({
      statement: state.statements[index.toString() as keyof typeof state.statements],
      originalIndex: index
    }));
    
    const myVote = userVotes[userId];
    const isVoting = !allVoted;
    const hasVotedForThisUser = myVote !== undefined;
    const isRevealed = gameState.revealed;
    
    // Count votes for each statement (only in results phase)
    const voteCount = !isVoting ? [0, 1, 2].map((originalIndex) => {
      if (!state.votes) return 0;
      return Object.values(state.votes).filter(vote => vote === originalIndex).length;
    }) : [];

    // For displaying correct guessers when revealed
    const correctGuessers = !isVoting && isRevealed ? Object.entries(state.votes || {})
      .filter(([, voteIndex]) => {
        // Find which statement is the lie
        const lieIndex = Object.values(state.statements).findIndex(s => s.isLie);
        return voteIndex === lieIndex;
      })
      .map(([guesserUserId]) => users[guesserUserId]?.name || 'Unknown')
      : [];

    return (
      <div className="border p-6 rounded-lg bg-white shadow-md">
        <h3 className="text-xl font-bold mb-4 text-indigo-800">{user.name}'s Statements:</h3>
        <p className="mb-4 text-gray-700">
          {isVoting
            ? hasVotedForThisUser
              ? "You've made your guess! Waiting for others..."
              : "Which one do you think is the lie? Click to vote!"
            : isRevealed
              ? "Results:"
              : "Here are the votes - creator will reveal the answers!"}
        </p>
        <div className="space-y-4">
          {orderedStatements.map(({statement, originalIndex}, displayIndex) => {
            const isLie = statement.isLie;
            const isVoted = myVote === originalIndex;
            
            // Different styles based on state
            let className = "w-full text-left p-4 rounded-md border transition-all duration-200 ";
            
            if (isVoting) {
              // Voting phase
              if (userId === currentUser.id) {
                className += "bg-gray-100 cursor-default";
              } else if (isVoted) {
                className += "border-indigo-500 bg-indigo-50 border-2";
              } else if (hasVotedForThisUser) {
                className += "bg-gray-100 cursor-default";
              } else {
                className += "hover:bg-gray-50 border-gray-300 cursor-pointer";
              }
            } else if (isRevealed) {
              // Results phase with reveal
              if (isLie) {
                className += "bg-red-50 border-red-300";
              } else {
                className += "bg-green-50 border-green-300";
              }
            } else {
              // Results phase without reveal
              className += "bg-gray-50 border-gray-300";
            }
            
            return (
              <button
                key={displayIndex}
                onClick={() => userId !== currentUser.id && isVoting && !hasVotedForThisUser && handleVote(userId, originalIndex)}
                disabled={userId === currentUser.id || hasVotedForThisUser || !isVoting}
                className={className}
              >
                <div className="flex justify-between items-center">
                  <span className="text-gray-800">{statement.text}</span>
                  
                  <div className="flex items-center gap-2">
                    {isRevealed && !isVoting && (
                      <span className={`${isLie ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'} text-xs font-semibold px-2.5 py-0.5 rounded`}>
                        {isLie ? 'LIE' : 'TRUTH'}
                      </span>
                    )}
                    
                    {!isVoting && (
                      <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                        {voteCount[originalIndex]} {voteCount[originalIndex] === 1 ? 'vote' : 'votes'}
                      </span>
                    )}
                    
                    {isVoting && isVoted && (
                      <span className="text-indigo-600 font-semibold">Your guess</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Show who guessed correctly when revealed */}
        {isRevealed && !isVoting && correctGuessers.length > 0 && (
          <div className="mt-4 p-3 bg-indigo-50 rounded-md">
            <p className="text-sm font-medium text-indigo-700">
              Correct guessers: {correctGuessers.join(', ')}
            </p>
          </div>
        )}
      </div>
    );
  };

  // Render the final leaderboard
  const renderLeaderboard = () => {
    // Get scores and sort users by score
    const scoreData = Object.entries(gameState.users)
      .map(([userId, state]) => ({
        userId,
        name: users[userId]?.name || 'Unknown',
        score: state.score || 0
      }))
      .sort((a, b) => b.score - a.score);
    
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-2xl font-bold mb-6 text-center text-indigo-800">Final Scores</h3>
        
        <div className="space-y-4">
          {scoreData.map((user, index) => (
            <div 
              key={user.userId} 
              className={`flex items-center justify-between p-4 rounded-md ${
                index === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center mr-3
                  ${index === 0 ? 'bg-yellow-400 text-yellow-800' : 
                    index === 1 ? 'bg-gray-300 text-gray-700' : 
                    index === 2 ? 'bg-amber-600 text-amber-900' : 'bg-gray-200 text-gray-600'}
                `}>
                  {index + 1}
                </div>
                <span className="font-medium">{user.name}</span>
              </div>
              <div className="flex items-center">
                <span className="font-bold text-lg">{user.score}</span>
                <span className="ml-1 text-gray-500">pts</span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Start Retrospective button for creator */}
        {currentUser.isCreator && !gameState.retrospectiveStarted && (
          <div className="mt-8 text-center">
            <button
              id="start-retrospective-button"
              onClick={handleStartRetrospective}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium shadow-md hover:bg-indigo-700 transition-colors duration-200"
            >
              Start Retrospective
            </button>
          </div>
        )}
        
        {/* Loading state when retrospective is starting */}
        {gameState.retrospectiveStarted && (
          <div className="mt-8 text-center">
            <p className="text-indigo-600 font-medium">Starting retrospective...</p>
          </div>
        )}
        
        {/* Message for non-creators waiting for retrospective to start */}
        {!currentUser.isCreator && !gameState.retrospectiveStarted && (
          <div className="mt-8 text-center">
            <p className="text-gray-600">Waiting for the creator to start the retrospective...</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto mt-20 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-indigo-800">Two Truths and a Lie</h2>
      
      {/* Leaderboard Phase - Highest priority, render first */}
      {gameState.finalLeaderboard === true || gameState.completed === true ? (
        <div className="space-y-8">{renderLeaderboard()}</div>
      ) : (
        <>
          {/* Statement submission phase */}
          {!gameState.users[currentUser.id]?.hasSubmitted && (
            <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
              <p className="mb-6 text-gray-700">Enter two true statements and one lie about yourself:</p>
              {statements.map((statement, index) => (
                <div key={index} className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {index === 2 ? "The Lie:" : `Truth ${index + 1}:`}
                  </label>
                  <input
                    type="text"
                    value={statement.text}
                    onChange={(e) => {
                      const newStatements = [...statements];
                      newStatements[index].text = e.target.value;
                      setStatements(newStatements);
                    }}
                    placeholder={index === 2 ? "Enter your lie" : `Enter truth ${index + 1}`}
                    className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              ))}
              <button
                onClick={handleSubmit}
                className="w-full bg-indigo-600 text-white px-6 py-3 rounded-md font-medium shadow-md hover:bg-indigo-700 transition-colors duration-200"
              >
                Submit
              </button>
            </div>
          )}
          
          {/* Waiting for others to submit */}
          {gameState.users[currentUser.id]?.hasSubmitted && !allSubmitted && (
            <div className="p-6 bg-white rounded-lg shadow-lg text-center">
              <p className="text-gray-700 mb-4">
                Waiting for other players to submit their statements...
              </p>
              <div className="flex flex-wrap justify-center gap-4 mt-8">
                {Object.entries(users).map(([userId, user]) => (
                  <div key={userId} className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-gray-500">
                        {gameState.users[userId]?.hasSubmitted ? 'Submitted ✓' : 'Waiting...'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
                  {renderUserStatements(userId)}
                </div>
              ))}
            </div>
          )}
          
          {/* Results Phase */}
          {allSubmitted && allVoted && !gameState.finalLeaderboard && (
            <div className="space-y-8">
              {/* Navigation controls */}
              <div className="flex justify-between items-center mb-6">
                {currentUser.isCreator && (
                  <button 
                    onClick={handlePrevUser}
                    className="bg-white p-2 rounded-full shadow hover:bg-gray-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                
                <span className="font-medium text-gray-700">
                  {gameState.activeUser && users[gameState.activeUser] 
                    ? `Showing ${gameState.revealed ? 'results' : 'votes'} for ${users[gameState.activeUser].name}`
                    : 'Waiting for results...'}
                </span>
                
                {currentUser.isCreator && (!isLastUser || !gameState.revealed) && (
                  <button 
                    onClick={handleNextUser}
                    className="bg-white p-2 rounded-full shadow hover:bg-gray-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
                
                {currentUser.isCreator && isLastUser && gameState.revealed && (
                  <button
                    id="show-leaderboard-button"
                    onClick={handleShowLeaderboard}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md shadow hover:bg-indigo-700 transition-colors"
                  >
                    Show Final Leaderboard
                  </button>
                )}
              </div>
              
              {/* Active user statements */}
              {gameState.activeUser && renderUserStatements(gameState.activeUser)}
              
              {/* Reveal button */}
              {currentUser.isCreator && !gameState.revealed && gameState.activeUser && (
                <div className="mt-8 text-center">
                  <button
                    onClick={handleReveal}
                    className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg shadow hover:bg-indigo-700 transition-colors"
                  >
                    Reveal Truth & Lie
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Icebreaker; 