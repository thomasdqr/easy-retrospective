import React from 'react';
import { WaitingRoomProps } from './types';

const WaitingRoom: React.FC<WaitingRoomProps> = ({ users, gameState }) => {
  return (
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
  );
};

export default WaitingRoom; 