import React from 'react';
import { LeaderboardProps } from './types';

const Leaderboard: React.FC<LeaderboardProps> = ({
  gameState,
  currentUser,
  users,
  handleStartRetrospective
}) => {
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

export default Leaderboard; 