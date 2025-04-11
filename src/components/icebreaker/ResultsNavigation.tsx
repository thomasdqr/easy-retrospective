import React from 'react';
import { ResultsNavigationProps } from './types';

const ResultsNavigation: React.FC<ResultsNavigationProps> = ({
  gameState,
  currentUser,
  users,
  handlePrevUser,
  handleNextUser,
  handleShowLeaderboard,
  isLastUser
}) => {
  return (
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
  );
};

export default ResultsNavigation; 