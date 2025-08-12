import React from 'react';
import { RevealButtonProps } from './types';

const RevealButton: React.FC<RevealButtonProps> = ({
  currentUser,
  gameState,
  handleReveal,
  icebreakerType = 'two-truths-one-lie'
}) => {
  if (!currentUser.isCreator || !gameState.activeUser || gameState.revealed) {
    return null;
  }

  const label = icebreakerType === 'two-truths-one-lie'
    ? 'Reveal Truth & Lie'
    : 'Reveal Drawing Results';

  return (
    <div className="mt-8 text-center">
      <button
        onClick={handleReveal}
        className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg shadow hover:bg-indigo-700 transition-colors"
      >
        {label}
      </button>
    </div>
  );
};

export default RevealButton; 