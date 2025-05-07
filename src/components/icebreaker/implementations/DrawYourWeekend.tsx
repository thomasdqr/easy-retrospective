import React, { useState, useEffect, useCallback } from 'react';
import { updateIcebreakerState, subscribeToIcebreakerState, IcebreakerState, IcebreakerPlayerState } from '../../../services/realtimeDbService';
import { IcebreakerProps, Drawing, IcebreakerGameState, PlayerState } from '../types';
import { checkAllSubmitted, checkAllVoted, isLastUser as checkIsLastUser, getValidUserIds } from '../utils';
import { USER_SESSION_KEY } from '../../../constants';

// Import sub-components
import WaitingRoom from '../WaitingRoom';
import ResultsNavigation from '../ResultsNavigation';
import RevealButton from '../RevealButton';
import Leaderboard from '../Leaderboard';

// Import firebase directly to add individual users
import { ref, set, get } from 'firebase/database';
import { realtimeDb } from '../../../config/firebase';
import UserDrawings from '../UserDrawings';
import DrawingSubmissionForm from '../DrawingSubmissionForm';

// Extended type for DrawYourWeekend that includes the drawing property
interface DrawingPlayerState extends IcebreakerPlayerState {
  drawing?: Drawing;
}

// Helper function to convert game state to database state
const convertToDbState = (state: IcebreakerGameState): IcebreakerState => {
  const dbUsers: Record<string, IcebreakerPlayerState> = {};
  
  Object.entries(state.users).forEach(([userId, user]) => {
    // Create a base player state that matches IcebreakerPlayerState
    const baseState: IcebreakerPlayerState = {
      statements: {
        "0": { text: "", isLie: false, revealed: false },
        "1": { text: "", isLie: false, revealed: false },
        "2": { text: "", isLie: false, revealed: false }
      },
      votes: {},
      score: user.score || 0,
      revealed: user.revealed || false
    };

    // Preserve all votes as-is for draw-your-weekend
    if (user.votes) {
      baseState.votes = user.votes;
    }

    // Add drawing data if it exists
    if (user.drawing) {
      (baseState as DrawingPlayerState).drawing = user.drawing;
    }

    dbUsers[userId] = baseState;
  });
  
  return {
    users: dbUsers,
    activeUser: state.activeUser || null,
    revealed: state.revealed || false,
    finalLeaderboard: state.finalLeaderboard || false,
    retrospectiveStarted: state.retrospectiveStarted || false,
    completed: state.completed || false
  };
};

// Helper function to convert database state to game state
const convertFromDbState = (dbState: IcebreakerState): IcebreakerGameState => {
  const gameUsers: Record<string, PlayerState> = {};
  
  Object.entries(dbState.users).forEach(([userId, user]) => {
    const playerState: PlayerState = {
      score: user.score || 0,
      votes: user.votes || {},
      revealed: user.revealed || false
    };

    // Get drawing data if it exists
    const extendedUser = user as DrawingPlayerState;
    if (extendedUser.drawing) {
      playerState.drawing = extendedUser.drawing;
    }

    gameUsers[userId] = playerState;
  });
  
  return {
    users: gameUsers,
    activeUser: dbState.activeUser || null,
    revealed: dbState.revealed || false,
    finalLeaderboard: dbState.finalLeaderboard || false,
    retrospectiveStarted: dbState.retrospectiveStarted || false,
    completed: dbState.completed || false
  };
};

const DrawYourWeekend: React.FC<IcebreakerProps> = ({ sessionId, currentUser, users, onComplete }) => {
  const [drawing, setDrawing] = useState<Drawing>({
    imageData: '',
    description: '',
    revealed: false,
    correctGuesses: {}
  });

  const [gameState, setGameState] = useState<IcebreakerGameState>({
    users: {},
    activeUser: null,
    revealed: false
  });

  const [userGuesses, setUserGuesses] = useState<Record<string, string>>({});

  // Calculate game state flags
  const allSubmitted = checkAllSubmitted(gameState, users);
  const allVoted = checkAllVoted(gameState, users);
  const isLastUser = checkIsLastUser(gameState, users);

  const handleSetActiveUser = useCallback(async (userId: string) => {
    if (!currentUser.isCreator) return;

    // Keep track of whether this user's results have already been revealed
    const userWasRevealed = gameState.users[userId]?.revealed || false;

    const newState = {
      ...gameState,
      activeUser: userId,
      // Preserve revealed status if this user was previously revealed
      revealed: userWasRevealed,
      finalLeaderboard: false
    };

    await updateIcebreakerState(sessionId, convertToDbState(newState));
  }, [currentUser.isCreator, gameState, sessionId]);

  useEffect(() => {
    console.log("Setting up subscription to icebreaker state");
    const unsubscribe = subscribeToIcebreakerState(sessionId, (state) => {
      if (state) {
        // Convert database state to game state
        const gameStateUpdate = convertFromDbState(state as IcebreakerState);
        console.log("Game State Update:", {
          users: Object.keys(gameStateUpdate.users).map(userId => ({
            userId,
            hasDrawing: !!gameStateUpdate.users[userId]?.drawing,
            votes: gameStateUpdate.users[userId]?.votes,
            score: gameStateUpdate.users[userId]?.score
          })),
          activeUser: gameStateUpdate.activeUser,
          revealed: gameStateUpdate.revealed,
          finalLeaderboard: gameStateUpdate.finalLeaderboard
        });
        setGameState(gameStateUpdate);

        // Update local guess tracking - Only track guesses the current user has actually made
        if (state.users && state.users[currentUser.id]?.votes) {
          const myGuesses: Record<string, string> = {};

          // Only extract votes that the current user has actually made
          const currentUserVotes = state.users[currentUser.id]?.votes || {};
          Object.entries(currentUserVotes).forEach(([targetUserId, guess]) => {
            if (guess !== undefined) {
              myGuesses[targetUserId] = typeof guess === 'string' ? guess : String(guess);
            }
          });

          console.log("Updated user guesses (from current user votes):", myGuesses);
          setUserGuesses(myGuesses);
        }
      }
    });

    return () => {
      console.log("Cleaning up subscription to icebreaker state");
      unsubscribe();
    };
  }, [sessionId, currentUser.id]);

  // Add debug effect for tracking submission and voting status
  useEffect(() => {
    console.log("Debug - Game Status:", {
      allSubmitted,
      allVoted,
      totalUsers: Object.keys(users).length,
      validUsers: getValidUserIds(users),
      submittedUsers: Object.entries(gameState.users).filter(([, user]) => user.drawing?.imageData).map(([id]) => id),
      userVotes: Object.entries(gameState.users).map(([userId, user]) => ({
        userId,
        votesGiven: user.votes ? Object.keys(user.votes).length : 0,
        votesReceived: Object.entries(gameState.users).filter(([, u]) => u.votes?.[userId]).length
      }))
    });
  }, [gameState, users, allSubmitted, allVoted]);

  // Set initial active user when all users have submitted
  useEffect(() => {
    if (allSubmitted && !gameState.activeUser && currentUser.isCreator) {
      const validUserIds = getValidUserIds(users);
      if (validUserIds.length > 0) {
        handleSetActiveUser(validUserIds[0]);
      }
    }
  }, [allSubmitted, gameState.activeUser, currentUser.isCreator, users, handleSetActiveUser]);

  // Add useEffect to watch for retrospective start
  useEffect(() => {
    if (gameState.retrospectiveStarted) {
      console.log("Retrospective started, redirecting all users");
      onComplete();
    }
  }, [gameState.retrospectiveStarted, onComplete]);

  // Add useEffect to watch for kicked users
  useEffect(() => {
    if (Object.keys(users).length > 0 && !users[currentUser.id]) {
      console.log("User was kicked from session");
      localStorage.removeItem(USER_SESSION_KEY);
      window.location.href = '/';
    }
  }, [users, currentUser.id]);

  // Add useEffect to initialize game state for users who rejoin
  useEffect(() => {
    if (!sessionId || !currentUser || !users[currentUser.id]) return;

    if (Object.keys(gameState.users || {}).length > 0 && !gameState.users[currentUser.id]) {
      console.log("Initializing game state for rejoined user");

      const newUserState = {
        drawing: {
          imageData: '',
          description: '',
          revealed: false,
          correctGuesses: {}
        },
        votes: {},
        score: 0
      };

      const updatingRef = ref(realtimeDb, `sessions/${sessionId}/icebreaker/users/${currentUser.id}`);

      set(updatingRef, newUserState)
        .then(() => {
          console.log("New user added successfully without changing other users' data");
        })
        .catch(error => {
          console.error("Error adding new user:", error);

          if (gameState.users) {
            const updatedUsers = {
              ...gameState.users,
              [currentUser.id]: newUserState
            };

            const newState = {
              ...gameState,
              users: updatedUsers
            };

            updateIcebreakerState(sessionId, convertToDbState(newState));
          }
        });
    }
  }, [sessionId, currentUser, users, gameState.users]);

  // Add this effect to handle automatic transition to reveal phase
  useEffect(() => {
    if (allSubmitted && allVoted && !gameState.finalLeaderboard && !gameState.activeUser && currentUser.isCreator) {
      // Set first user as active when all have submitted and voted
      const validUserIds = getValidUserIds(users);
      if (validUserIds.length > 0) {
        handleSetActiveUser(validUserIds[0]);
      }
    }
  }, [allSubmitted, allVoted, gameState.finalLeaderboard, gameState.activeUser, currentUser.isCreator, users, handleSetActiveUser]);

  // Add additional effect to monitor voting status and transition when all votes are in
  useEffect(() => {
    // Only proceed if all required conditions are met
    if (
      currentUser.isCreator && // Only the creator should trigger this
      allSubmitted &&          // All users have submitted drawings
      allVoted &&              // All users have voted
      !gameState.finalLeaderboard && // Not already in leaderboard view
      !gameState.revealed      // Not already in reveal state
    ) {
      console.log("All users have voted! Transitioning to results phase...");
      
      // Set the first user as active if no active user
      if (!gameState.activeUser) {
        const validUserIds = getValidUserIds(users);
        if (validUserIds.length > 0) {
          handleSetActiveUser(validUserIds[0]);
        }
      }
    }
  }, [
    allSubmitted, 
    allVoted, 
    currentUser.isCreator, 
    gameState.activeUser, 
    gameState.finalLeaderboard, 
    gameState.revealed, 
    handleSetActiveUser, 
    users
  ]);

  const handleSubmit = async () => {
    if (!drawing.imageData || !drawing.description.trim()) {
      alert('Please draw something and provide a description');
      return;
    }

    try {
      // Create a minimal user state with just the essential fields
      const userState = {
        drawing: {
          imageData: drawing.imageData,
          description: drawing.description,
          revealed: false,
          correctGuesses: {}
        },
        votes: {},
        score: 0
      };

      // Try three different approaches to writing the data
      
      // Approach 1: Direct write to the user's specific path
      try {
        const userRef = ref(realtimeDb, `sessions/${sessionId}/icebreaker/users/${currentUser.id}`);
        await set(userRef, userState);
        console.log("Success with approach 1");
      } catch (err) {
        console.error("Approach 1 failed:", err);
        
        // Approach 2: Write to the session with an update
        try {
          // Write just the drawing part directly
          const drawingRef = ref(realtimeDb, `sessions/${sessionId}/icebreaker/users/${currentUser.id}/drawing`);
          await set(drawingRef, userState.drawing);
          
          // Then add the votes and score
          const votesRef = ref(realtimeDb, `sessions/${sessionId}/icebreaker/users/${currentUser.id}/votes`);
          await set(votesRef, {});
          
          const scoreRef = ref(realtimeDb, `sessions/${sessionId}/icebreaker/users/${currentUser.id}/score`);
          await set(scoreRef, 0);
          
          console.log("Success with approach 2");
        } catch (err2) {
          console.error("Approach 2 failed:", err2);
          
          // Approach 3: Write to the entire icebreaker state (last resort)
          try {
            // Get current state
            const icebreakerRef = ref(realtimeDb, `sessions/${sessionId}/icebreaker`);
            const snapshot = await get(icebreakerRef);
            const currentState = snapshot.exists() ? snapshot.val() : { users: {} };
            
            // Update with new user data
            currentState.users = currentState.users || {};
            currentState.users[currentUser.id] = userState;
            
            // Write back entire state
            await set(icebreakerRef, currentState);
            console.log("Success with approach 3");
          } catch (err3) {
            console.error("All approaches failed:", err3);
            throw err3;
          }
        }
      }

      // Update local state
      setGameState(prev => ({
        ...prev,
        users: {
          ...prev.users,
          [currentUser.id]: userState
        }
      }));
    } catch (error) {
      console.error("Error submitting drawing:", error);
      alert("Failed to submit drawing. Please try again.");
    }
  };

  const handleGuess = async (userId: string, guess: string) => {
    if (userId === currentUser.id) return;

    console.log("Submitting guess:", {
      targetUserId: userId,
      guess,
      currentUserId: currentUser.id,
      currentUserVotes: gameState.users[currentUser.id]?.votes
    });

    // Only update userGuesses for the specific drawing being guessed
    setUserGuesses(prev => ({
      ...prev,
      [userId]: guess
    }));

    const updatedUserState = {
      ...gameState.users[currentUser.id],
      votes: {
        ...gameState.users[currentUser.id]?.votes,
        [userId]: guess
      }
    };

    const updatedUsers = {
      ...gameState.users,
      [currentUser.id]: updatedUserState
    };

    const newState = {
      ...gameState,
      users: updatedUsers
    };

    console.log("Updating state with new guess:", {
      updatedUserState,
      allUsers: updatedUsers
    });

    await updateIcebreakerState(sessionId, convertToDbState(newState));
  };

  const showFinalLeaderboard = useCallback(async () => {
    if (!currentUser.isCreator) return;

    console.log("Showing leaderboard, current state:", gameState);

    const newState = {
      users: {...gameState.users},
      activeUser: null,
      revealed: true,
      finalLeaderboard: true,
      completed: true
    };

    console.log("New leaderboard state:", newState);

    try {
      setGameState(prev => ({
        ...prev,
        finalLeaderboard: true,
        activeUser: null,
        revealed: true,
        completed: true
      }));

      await updateIcebreakerState(sessionId, convertToDbState(newState));
    } catch (error) {
      console.error("Error showing leaderboard:", error);
    }
  }, [currentUser.isCreator, gameState, sessionId]);

  const handleShowLeaderboard = useCallback(() => {
    const button = document.querySelector('#show-leaderboard-button');
    if (button) {
      button.setAttribute('disabled', 'true');
      button.textContent = 'Loading...';
    }

    setTimeout(() => {
      showFinalLeaderboard();
    }, 100);
  }, [showFinalLeaderboard]);

  const handleNextUser = useCallback(async () => {
    if (!gameState.activeUser || !currentUser.isCreator) return;

    const validUserIds = getValidUserIds(users);
    const currentIndex = validUserIds.indexOf(gameState.activeUser);

    // Calculate the next index, wrapping around if needed
    const nextIndex = (currentIndex + 1) % validUserIds.length;

    // If we're at the last user and already revealed, and we're about to loop back to the first user
    if (currentIndex === validUserIds.length - 1 && gameState.revealed && nextIndex === 0) {
      console.log("All users have been viewed, showing leaderboard");
      handleShowLeaderboard();
      return;
    }

    // Otherwise, just move to the next user
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

    if (gameState.revealed) {
      const newState = {
        ...gameState,
        revealed: true
      };
      await updateIcebreakerState(sessionId, convertToDbState(newState));
      return;
    }

    const activeUserState = gameState.users[gameState.activeUser];
    if (!activeUserState || !activeUserState.drawing) return;

    const updatedUsers = { ...gameState.users };
    const validUserIds = getValidUserIds(users);

    // Mark that this user has been revealed
    updatedUsers[gameState.activeUser] = {
      ...activeUserState,
      revealed: true
    };

    validUserIds.forEach(voterId => {
      if (voterId === gameState.activeUser) return; // Skip the drawing owner

      const userState = updatedUsers[voterId];
      if (!userState) return;

      // Get the guess this user made for the active user's drawing
      const activeUserIdSafe = gameState.activeUser || '';
      if (!activeUserIdSafe) return; // Skip if no active user
      
      const userGuess = gameState.users[voterId]?.votes?.[activeUserIdSafe];
      if (userGuess) {
        const guessText = typeof userGuess === 'string' ? userGuess : String(userGuess);
        
        // Compare with the actual description
        if (guessText.toLowerCase() === activeUserState.drawing?.description.toLowerCase()) {
          // Award points for correct guess
          updatedUsers[voterId] = {
            ...userState,
            score: (userState.score || 0) + 1
          };

          // Mark the guess as correct
          const activeUser = gameState.activeUser || '';
          if (activeUser && updatedUsers[activeUser]) {
            updatedUsers[activeUser].drawing = {
              ...updatedUsers[activeUser].drawing!,
              correctGuesses: {
                ...updatedUsers[activeUser].drawing!.correctGuesses,
                [voterId]: true
              }
            };
          }
        }
      }
    });

    const newState = {
      ...gameState,
      revealed: true,
      users: updatedUsers
    };

    await updateIcebreakerState(sessionId, convertToDbState(newState));
  }, [currentUser.isCreator, gameState, sessionId, users]);

  const handleStartRetrospective = useCallback(async () => {
    if (!currentUser.isCreator) return;

    console.log("Starting retrospective for all users");

    const newState = {
      ...gameState,
      retrospectiveStarted: true
    };

    try {
      const button = document.querySelector('#start-retrospective-button');
      if (button) {
        button.setAttribute('disabled', 'true');
        (button as HTMLButtonElement).textContent = 'Starting...';
      }

      await updateIcebreakerState(sessionId, convertToDbState(newState));

      setGameState(prev => ({
        ...prev,
        retrospectiveStarted: true
      }));
    } catch (error) {
      console.error("Error starting retrospective:", error);

      const button = document.querySelector('#start-retrospective-button');
      if (button) {
        button.removeAttribute('disabled');
        (button as HTMLButtonElement).textContent = 'Start Retrospective';
      }
    }
  }, [currentUser.isCreator, gameState, sessionId]);

  const hasUserSubmitted = (userId: string): boolean => {
    const userDrawing = gameState.users[userId]?.drawing;
    if (!userDrawing) return false;
    return userDrawing.imageData !== '' && userDrawing.description.trim() !== '';
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
          <h2 className="text-2xl font-bold mb-6 text-indigo-800">Draw Your Weekend</h2>

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
              {!hasUserSubmitted(currentUser.id) && (
                <DrawingSubmissionForm
                  drawing={drawing}
                  setDrawing={setDrawing}
                  onSubmit={handleSubmit}
                />
              )}

              {hasUserSubmitted(currentUser.id) && !allSubmitted && (
                <WaitingRoom users={users} gameState={gameState} />
              )}

              {hasUserSubmitted(currentUser.id) && allSubmitted && !allVoted && !gameState.finalLeaderboard && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full">
                      <div
                        className="h-2 bg-indigo-600 rounded-full transition-all duration-300 ease-in-out"
                        style={{
                          width: `${(Object.keys(gameState.users[currentUser.id]?.votes || {}).length / (getValidUserIds(users).length - 1)) * 100}%`
                        }}
                      ></div>
                    </div>
                    <div className="ml-4 text-sm font-medium text-gray-700">
                      {Object.keys(gameState.users[currentUser.id]?.votes || {}).length}/{getValidUserIds(users).length - 1} guessed
                    </div>
                  </div>

                  {getValidUserIds(users).map(userId => {
                    if (userId === currentUser.id) return null;
                    return (
                      <div key={userId}>
                        <UserDrawings
                          userId={userId}
                          gameState={gameState}
                          currentUser={currentUser}
                          users={users}
                          userGuesses={userGuesses}
                          handleGuess={handleGuess}
                          sessionId={sessionId}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {hasUserSubmitted(currentUser.id) && allSubmitted && allVoted && !gameState.finalLeaderboard && (
                <div className="space-y-8">
                  <ResultsNavigation
                    gameState={gameState}
                    currentUser={currentUser}
                    users={users}
                    handlePrevUser={handlePrevUser}
                    handleNextUser={handleNextUser}
                    handleShowLeaderboard={handleShowLeaderboard}
                    isLastUser={isLastUser}
                    icebreakerType="draw-your-weekend"
                  />

                  {gameState.activeUser && (
                    <UserDrawings
                      userId={gameState.activeUser}
                      gameState={gameState}
                      currentUser={currentUser}
                      users={users}
                      userGuesses={userGuesses}
                      handleGuess={handleGuess}
                      sessionId={sessionId}
                    />
                  )}

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

export default DrawYourWeekend; 