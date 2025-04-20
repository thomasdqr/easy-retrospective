import React from 'react';
import { UserStatementsProps } from './types';
import { getValidUserIds } from './utils';

const UserStatements: React.FC<UserStatementsProps> = ({
  userId,
  gameState,
  currentUser,
  users,
  userVotes,
  handleVote
}) => {
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
  const validUserIds = getValidUserIds(users);

  // Get only users that exist in both the Firestore users list and the game state 
  const activeUserIds = Object.keys(gameState.users).filter(id => validUserIds.includes(id));

  // Check if we're in voting phase by checking if all valid users have voted
  const isVoting = !activeUserIds.every(userId => {
    // Filter votes to only count those from active users
    const votesReceived = activeUserIds.filter(voterId => 
      gameState.users[voterId]?.votes && 
      gameState.users[voterId].votes[userId] !== undefined &&
      voterId !== userId // excluding self-vote
    ).length;
    
    // Count only active users minus self
    const requiredVotes = activeUserIds.filter(id => id !== userId).length;
    return votesReceived >= requiredVotes;
  });

  const hasVotedForThisUser = myVote !== undefined;
  const isRevealed = gameState.revealed && gameState.activeUser === userId;
  
  // Count votes for each statement (only in results phase)
  const voteCount = !isVoting ? [0, 1, 2].map((originalIndex) => {
    if (!state.votes) return 0;
    
    // Only count votes from users who are still in the session
    return activeUserIds.filter(voterId => 
      voterId !== userId && // exclude self
      validUserIds.includes(voterId) && // ensure voter is a valid user
      state.votes[voterId] === originalIndex
    ).length;
  }) : [];

  // For displaying correct guessers when revealed
  const correctGuessers = !isVoting && isRevealed ? Object.entries(state.votes || {})
    .filter(([voterId, voteIndex]) => {
      // Only include valid users who are still in the session
      if (!activeUserIds.includes(voterId) || voterId === userId) return false;
      
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
            ? "You've made your guess! You can change it by clicking on another statement."
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
              // Changed from bg-gray-100 cursor-default to allow hovering on other options
              className += "hover:bg-gray-50 border-gray-300 cursor-pointer";
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
              onClick={() => userId !== currentUser.id && isVoting && handleVote(userId, originalIndex)}
              disabled={userId === currentUser.id || !isVoting}
              className={className}
            >
              <div className="flex justify-between items-center">
                <span className="text-gray-800">{statement.text}</span>
                
                <div className="flex items-center gap-2">
                  {isRevealed && (
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
      {isRevealed && correctGuessers.length > 0 && (
        <div className="mt-4 p-3 bg-indigo-50 rounded-md">
          <p className="text-sm font-medium text-indigo-700">
            Correct guessers: {correctGuessers.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
};

export default UserStatements; 