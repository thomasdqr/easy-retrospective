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

  let label = 'Reveal';
  if (icebreakerType === 'two-truths-one-lie') {
    label = 'Reveal Truth & Lie';
  } else if (icebreakerType === 'draw-your-weekend') {
    label = 'Reveal Drawing Results';
  } else if (icebreakerType === 'music-share') {
    label = 'Reveal Song Owner & Scores';
  }

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