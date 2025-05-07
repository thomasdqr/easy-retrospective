import React, { useState, useMemo } from 'react';
import { UserStatementsProps } from './types';
import { getValidUserIds } from './utils';
import { ref, update } from 'firebase/database';
import { realtimeDb } from '../../config/firebase';

const UserDrawings: React.FC<UserStatementsProps> = ({
  userId,
  gameState,
  currentUser,
  users,
  userGuesses = {}, // Default empty object to avoid undefined
  handleGuess,
  sessionId
}) => {
  const [guessInput, setGuessInput] = useState('');
  const state = gameState.users[userId];
  const user = users[userId];
  if (!state || !user || !state.drawing) return null;

  const myGuess = userGuesses[userId];
  const validUserIds = getValidUserIds(users);

  // Get only users that exist in both the Firestore users list and the game state 
  const activeUserIds = Object.keys(gameState.users).filter(id => validUserIds.includes(id));

  // Check if we're in voting phase by checking if all valid users have voted
  const isVoting = !activeUserIds.every(userId => {
    const votesReceived = activeUserIds.filter(voterId => 
      gameState.users[voterId]?.votes && 
      gameState.users[voterId].votes[userId] !== undefined &&
      voterId !== userId
    ).length;
    
    const requiredVotes = activeUserIds.filter(id => id !== userId).length;
    return votesReceived >= requiredVotes;
  });

  const hasGuessedForThisUser = myGuess !== undefined;
  const isRevealed = gameState.revealed && gameState.activeUser === userId;

  // Collect guesses from all users about this drawing
  const allGuesses = useMemo(() => {
    const guesses: Record<string, string> = {};
    
    // Loop through all active users
    activeUserIds.forEach(voterId => {
      // Skip if it's the drawing owner
      if (voterId === userId) return;
      
      // Get the user's vote for this drawing
      const userVote = gameState.users[voterId]?.votes?.[userId];
      if (userVote !== undefined) {
        // Store the guess with the voter's ID as the key
        guesses[voterId] = typeof userVote === 'string' ? userVote : String(userVote);
      }
    });
    
    return guesses;
  }, [activeUserIds, gameState.users, userId]);

  // Get correct guessers when revealed
  const correctGuessers = !isVoting && isRevealed ? Object.entries(state.drawing.correctGuesses || {})
    .filter(([guesserUserId, isCorrect]) => isCorrect && activeUserIds.includes(guesserUserId))
    .map(([guesserUserId]) => users[guesserUserId]?.name || 'Unknown')
    : [];

  const handleSubmitGuess = () => {
    if (!guessInput.trim()) {
      alert('Please enter your guess!');
      return;
    }
    if (handleGuess) {
      handleGuess(userId, guessInput.trim());
    }
    setGuessInput('');
  };

  const toggleCorrectGuess = async (voterId: string) => {
    if (!currentUser.isCreator || !isRevealed || !sessionId) return;
    
    // Get current state
    const isCurrentlyCorrect = state.drawing?.correctGuesses?.[voterId] || false;
    
    // Update the correctGuesses object
    const updates: Record<string, boolean | number> = {};
    updates[`sessions/${sessionId}/icebreaker/users/${userId}/drawing/correctGuesses/${voterId}`] = !isCurrentlyCorrect;

    // If changing from incorrect to correct, increment score
    if (!isCurrentlyCorrect) {
      const currentScore = gameState.users[voterId]?.score || 0;
      updates[`sessions/${sessionId}/icebreaker/users/${voterId}/score`] = currentScore + 1;
    } 
    // If changing from correct to incorrect, decrement score (if > 0)
    else {
      const currentScore = gameState.users[voterId]?.score || 0;
      if (currentScore > 0) {
        updates[`sessions/${sessionId}/icebreaker/users/${voterId}/score`] = currentScore - 1;
      }
    }
    
    // Update in Firebase
    try {
      await update(ref(realtimeDb), updates);
    } catch (error) {
      console.error("Error updating correct guesses:", error);
    }
  };

  return (
    <div className="border p-6 rounded-lg bg-white shadow-md">
      <h3 className="text-xl font-bold mb-4 text-indigo-800">{user.name}'s Drawing:</h3>
      <p className="mb-4 text-gray-700">
        {isVoting
          ? hasGuessedForThisUser
            ? "You've made your guess! You can change it by submitting a new one."
            : "What do you think they did during their weekend? Make your guess!"
          : isRevealed
            ? currentUser.isCreator 
              ? "Mark correct guesses by clicking on them:"
              : "Results:" 
            : "Here are the guesses - creator will reveal the answers!"}
      </p>

      <div className="mb-6">
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <img
            src={state.drawing.imageData}
            alt={`${user.name}'s weekend drawing`}
            className="w-full"
          />
        </div>
      </div>

      {isVoting && userId !== currentUser.id && (
        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              placeholder="Enter your guess..."
              className="flex-1 p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              onKeyPress={(e) => e.key === 'Enter' && handleSubmitGuess()}
            />
            <button
              onClick={handleSubmitGuess}
              className="px-6 py-3 bg-indigo-600 text-white rounded-md font-medium shadow-md hover:bg-indigo-700 transition-colors"
            >
              Submit Guess
            </button>
          </div>
          {hasGuessedForThisUser && (
            <p className="mt-2 text-sm text-indigo-600">
              Your guess: {myGuess}
            </p>
          )}
        </div>
      )}

      {!isVoting && (
        <div className="space-y-4">
          {Object.entries(allGuesses).map(([voterId, guess]) => {
            if (!activeUserIds.includes(voterId) || voterId === userId) return null;
            const voter = users[voterId];
            if (!voter) return null;

            const isCorrect = isRevealed && state.drawing?.correctGuesses?.[voterId];
            const guessClass = isRevealed
              ? isCorrect
                ? 'bg-green-50 border-green-300'
                : 'bg-red-50 border-red-300'
              : 'bg-gray-50 border-gray-300';

            const isCreatorAndRevealed = currentUser.isCreator && isRevealed;

            return (
              <div
                key={voterId}
                className={`p-4 rounded-md border ${guessClass} ${isCreatorAndRevealed ? 'cursor-pointer' : ''}`}
                onClick={isCreatorAndRevealed ? () => toggleCorrectGuess(voterId) : undefined}
              >
                <div className="flex justify-between items-center">
                  <span className="text-gray-800">
                    <span className="font-medium">{voter.name}:</span> {guess}
                  </span>
                  {isRevealed && (
                    <span className={`${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} text-xs font-semibold px-2.5 py-0.5 rounded`}>
                      {isCorrect ? 'CORRECT' : 'INCORRECT'}
                    </span>
                  )}
                </div>
                {isCreatorAndRevealed && (
                  <div className="mt-2 text-xs text-gray-500">
                    {isCorrect ? 'Click to mark as incorrect' : 'Click to mark as correct'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isRevealed && (
        <div className="mt-6 p-4 bg-indigo-50 rounded-md">
          <p className="font-medium text-indigo-800 mb-2">
            Actual weekend activity:
          </p>
          <p className="text-indigo-700">
            {state.drawing.description}
          </p>
          {correctGuessers.length > 0 && (
            <p className="mt-2 text-sm font-medium text-indigo-700">
              Correct guessers: {correctGuessers.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default UserDrawings; 