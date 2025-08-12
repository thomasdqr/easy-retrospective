import React, { useMemo } from 'react';
import { UserStatementsProps } from './types';
import { getValidUserIds } from './utils';

// Component to show one user's music with guessing/association UI
const UserMusic: React.FC<UserStatementsProps> = ({
  userId,
  gameState,
  currentUser,
  users,
  handleGuess,
}) => {
  const state = gameState.users[userId];
  const user = users[userId];
  if (!state || !user || !state.music) return null;

  const validUserIds = getValidUserIds(users);
  const activeUserIds = useMemo(() => Object.keys(gameState.users).filter(id => validUserIds.includes(id)), [gameState.users, validUserIds]);

  // Voting/association phase completion check per target
  const isVoting = !activeUserIds.every(targetId => {
    const votesReceived = activeUserIds.filter(voterId => (
      gameState.users[voterId]?.votes && gameState.users[voterId].votes[targetId] !== undefined && voterId !== targetId
    )).length;
    const requiredVotes = activeUserIds.filter(id => id !== targetId).length;
    return votesReceived >= requiredVotes;
  });

  const myGuess = gameState.users[currentUser.id]?.votes?.[userId];
  const hasGuessedForThisUser = myGuess !== undefined && myGuess !== null;
  const isRevealed = gameState.revealed && gameState.activeUser === userId;

  // Build options for association: all users except self; self option disabled/greyed
  const options = validUserIds
    .filter(id => users[id])
    .map(id => ({ id, name: users[id].name }));

  const handleSelect = (guessedOwnerUserId: string) => {
    if (!handleGuess || userId === currentUser.id || !isVoting) return;
    handleGuess(userId, guessedOwnerUserId);
  };

  const titleText = isRevealed ? `It was ${user.name}'s song!` : 'Whose song is this?';

  return (
    <div className="border p-6 rounded-lg bg-white shadow-md">
      <h3 className="text-xl font-bold mb-4 text-indigo-800">{titleText}</h3>

      <div className="mb-4 aspect-video w-full border rounded-md overflow-hidden">
        <iframe
          title={`${user.name} song`}
          src={`https://www.youtube.com/embed/${state.music.videoId}`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      {/* Association UI */}
      {isVoting && userId !== currentUser.id && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {options.map(opt => {
            const isSelf = opt.id === userId; // actual owner of this song (must be selectable)
            const isMine = opt.id === currentUser.id; // cannot select yourself as owner
            const selected = myGuess === opt.id;
            const disabled = isMine; // only prevent selecting yourself
            return (
              <button
                key={opt.id}
                disabled={disabled}
                onClick={() => handleSelect(opt.id)}
                className={`text-left p-3 rounded-md border transition ${
                  disabled
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : selected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'bg-white hover:bg-gray-50 border-gray-300'
                }`}
              >
                {opt.name}
                {selected && <span className="ml-2 text-indigo-600 font-medium">(selected)</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Results badges once revealed */}
      {!isVoting && (
        <div className="mt-4">
          {activeUserIds.filter(voterId => voterId !== userId).map(voterId => {
            const guessForThisSong = gameState.users[voterId]?.votes?.[userId];
            if (!guessForThisSong) return null;
            const isCorrect = isRevealed && guessForThisSong === userId;
            const voterName = users[voterId]?.name || 'Unknown';
            const guessedName = users[String(guessForThisSong)]?.name || 'Unknown';
            return (
              <div key={voterId} className={`p-3 mb-2 rounded-md border ${isRevealed ? (isCorrect ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300') : 'bg-gray-50 border-gray-300'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-gray-800">
                    <span className="font-medium">{voterName}</span> guessed <span className="font-medium">{guessedName}</span>
                  </span>
                  {isRevealed && (
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {isCorrect ? 'CORRECT' : 'INCORRECT'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserMusic;


