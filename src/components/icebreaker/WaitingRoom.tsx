import React from 'react';
import { WaitingRoomProps } from './types';

const WaitingRoom: React.FC<WaitingRoomProps> = ({ users, gameState }) => {
  // Filter out any null or undefined users
  const validUsers = Object.entries(users).filter(([, user]) => user !== null && user !== undefined);

  // Helper function to check if a user has submitted valid statements
  const hasUserSubmitted = (userId: string): boolean => {
    const userStatements = gameState.users[userId]?.statements;
    if (!userStatements) return false;
    
    return Object.values(userStatements).every(statement => 
      statement && statement.text && statement.text.trim().length > 0
    );
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg text-center">
      <p className="text-gray-700 mb-4">
        Waiting for other players to submit their statements...
      </p>
      <div className="flex flex-wrap justify-center gap-4 mt-8">
        {validUsers.map(([userId, user]) => (
          <div key={userId} className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              {user.name.charAt(0)}
            </div>
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-gray-500">
                {hasUserSubmitted(userId) ? 'Submitted ✓' : 'Waiting...'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WaitingRoom; 