import React from 'react';
import { RevealButtonProps } from './types';

const RevealButton: React.FC<RevealButtonProps> = ({
  currentUser,
  gameState,
  handleReveal
}) => {
  if (!currentUser.isCreator || !gameState.activeUser || gameState.revealed) {
    return null;
  }

  return (
    <div className="mt-8 text-center">
      <button
        onClick={handleReveal}
        className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg shadow hover:bg-indigo-700 transition-colors"
      >
        Reveal Truth & Lie
      </button>
    </div>
  );
};

export default RevealButton; 