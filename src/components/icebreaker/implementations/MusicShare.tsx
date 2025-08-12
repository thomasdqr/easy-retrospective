import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IcebreakerProps, IcebreakerGameState, PlayerState, MusicShareItem } from '../types';
import { getValidUserIds, checkAllSubmitted, checkAllVoted, isLastUser as checkIsLastUser } from '../utils';
import { updateIcebreakerState, subscribeToIcebreakerState, IcebreakerState, IcebreakerPlayerState } from '../../../services/realtimeDbService';
import { ref, set } from 'firebase/database';
import { realtimeDb } from '../../../config/firebase';
import WaitingRoom from '../WaitingRoom';
import ResultsNavigation from '../ResultsNavigation';
import RevealButton from '../RevealButton';
import Leaderboard from '../Leaderboard';
import MusicSubmissionForm from '../MusicSubmissionForm';
import UserMusic from '../UserMusic';

// Extend player state for DB mapping to carry music info inside generic structure
interface MusicPlayerState extends IcebreakerPlayerState {
  music?: MusicShareItem;
}

const convertToDbState = (state: IcebreakerGameState): IcebreakerState => {
  const dbUsers: Record<string, MusicPlayerState> = {};
  Object.entries(state.users).forEach(([userId, user]) => {
    const base: MusicPlayerState = {
      statements: {
        '0': { text: '', isLie: false, revealed: false },
        '1': { text: '', isLie: false, revealed: false },
        '2': { text: '', isLie: false, revealed: false },
      },
      votes: user.votes || {},
      score: user.score || 0,
      revealed: user.revealed || false,
    };
    if (user.music) base.music = user.music;
    dbUsers[userId] = base;
  });

  return {
    users: dbUsers,
    activeUser: state.activeUser || null,
    revealed: state.revealed || false,
    finalLeaderboard: state.finalLeaderboard || false,
    retrospectiveStarted: state.retrospectiveStarted || false,
    completed: state.completed || false,
  };
};

const convertFromDbState = (dbState: IcebreakerState): IcebreakerGameState => {
  const gameUsers: Record<string, PlayerState> = {};
  Object.entries(dbState.users).forEach(([userId, user]) => {
    const mp = user as MusicPlayerState;
    gameUsers[userId] = {
      score: user.score || 0,
      votes: user.votes || {},
      revealed: user.revealed || false,
      music: mp.music,
    };
  });

  return {
    users: gameUsers,
    activeUser: dbState.activeUser || null,
    revealed: dbState.revealed || false,
    finalLeaderboard: dbState.finalLeaderboard || false,
    retrospectiveStarted: dbState.retrospectiveStarted || false,
    completed: dbState.completed || false,
  };
};

const MusicShare: React.FC<IcebreakerProps> = ({ sessionId, currentUser, users, onComplete }) => {
  const [music, setMusic] = useState<MusicShareItem>({ url: '', videoId: '', revealed: false });
  const [gameState, setGameState] = useState<IcebreakerGameState>({ users: {}, activeUser: null, revealed: false });

  const allSubmitted = checkAllSubmitted(gameState, users);
  const allVoted = checkAllVoted(gameState, users);
  const isLastUser = checkIsLastUser(gameState, users);

  const handleSetActiveUser = useCallback(async (userId: string) => {
    if (!currentUser.isCreator) return;
    const userWasRevealed = gameState.users[userId]?.revealed || false;
    const newState = { ...gameState, activeUser: userId, revealed: userWasRevealed, finalLeaderboard: false };
    await updateIcebreakerState(sessionId, convertToDbState(newState));
  }, [currentUser.isCreator, gameState, sessionId]);

  useEffect(() => {
    const unsub = subscribeToIcebreakerState(sessionId, (state) => {
      if (!state) return;
      setGameState(convertFromDbState(state));
    });
    return () => unsub();
  }, [sessionId]);

  // Auto set first active user when submissions complete
  useEffect(() => {
    if (allSubmitted && !gameState.activeUser && currentUser.isCreator) {
      const ids = getValidUserIds(users);
      if (ids.length) handleSetActiveUser(ids[0]);
    }
  }, [allSubmitted, gameState.activeUser, currentUser.isCreator, users, handleSetActiveUser]);

  // Retro start watcher
  useEffect(() => {
    if (gameState.retrospectiveStarted) onComplete();
  }, [gameState.retrospectiveStarted, onComplete]);

  // Kick watcher
  useEffect(() => {
    if (Object.keys(users).length > 0 && !users[currentUser.id]) {
      localStorage.removeItem('user_session');
      window.location.href = '/';
    }
  }, [users, currentUser.id]);

  const handleSubmit = async () => {
    if (!music.videoId) {
      alert('Please paste a valid YouTube link.');
      return;
    }

    const userState: PlayerState = {
      music: { ...music, revealed: false },
      votes: {},
      score: 0,
    };

    try {
      const userRef = ref(realtimeDb, `sessions/${sessionId}/icebreaker/users/${currentUser.id}`);
      await set(userRef, convertToDbState({ users: { [currentUser.id]: userState }, activeUser: null, revealed: false } as any).users[currentUser.id]);
    } catch (e) {
      // Fallback to full state update
      const newState = { ...gameState, users: { ...gameState.users, [currentUser.id]: userState } };
      await updateIcebreakerState(sessionId, convertToDbState(newState));
    }
  };

  // Guess is association: for target userId, set currentUser's vote to guessedOwnerId
  const handleGuess = async (targetUserId: string, guessedUserId: string) => {
    // Disallow guessing on your own song and disallow selecting yourself as owner
    if (targetUserId === currentUser.id || guessedUserId === currentUser.id) return;
    const updatedCurrent = {
      ...gameState.users[currentUser.id],
      votes: {
        ...gameState.users[currentUser.id]?.votes,
        [targetUserId]: guessedUserId,
      },
    };
    const newState = { ...gameState, users: { ...gameState.users, [currentUser.id]: updatedCurrent } };
    await updateIcebreakerState(sessionId, convertToDbState(newState));
  };

  const handleReveal = useCallback(async () => {
    if (!currentUser.isCreator || !gameState.activeUser) return;
    const activeUserState = gameState.users[gameState.activeUser];
    if (!activeUserState?.music) return;

    const updatedUsers = { ...gameState.users };
    updatedUsers[gameState.activeUser] = { ...activeUserState, revealed: true };

    const ids = getValidUserIds(users);
    ids.forEach(voterId => {
      if (voterId === gameState.activeUser) return;
      const voterState = updatedUsers[voterId];
      const guess = voterState?.votes?.[gameState.activeUser];
      if (guess === gameState.activeUser) {
        updatedUsers[voterId] = { ...voterState, score: (voterState?.score || 0) + 1 };
      }
    });

    const newState = { ...gameState, users: updatedUsers, revealed: true };
    await updateIcebreakerState(sessionId, convertToDbState(newState));
  }, [currentUser.isCreator, gameState, sessionId, users]);

  const showFinalLeaderboard = useCallback(async () => {
    if (!currentUser.isCreator) return;
    const newState = { ...gameState, activeUser: null, revealed: true, finalLeaderboard: true, completed: true };
    setGameState(prev => ({ ...prev, finalLeaderboard: true, activeUser: null, revealed: true, completed: true }));
    await updateIcebreakerState(sessionId, convertToDbState(newState));
  }, [currentUser.isCreator, gameState, sessionId]);

  const handleShowLeaderboard = useCallback(() => {
    const button = document.querySelector('#show-leaderboard-button');
    if (button) {
      button.setAttribute('disabled', 'true');
      (button as HTMLButtonElement).textContent = 'Loading...';
    }
    setTimeout(() => showFinalLeaderboard(), 100);
  }, [showFinalLeaderboard]);

  const handleNextUser = useCallback(() => {
    if (!gameState.activeUser || !currentUser.isCreator) return;
    const ids = getValidUserIds(users);
    const idx = ids.indexOf(gameState.activeUser);
    const next = (idx + 1) % ids.length;
    if (idx === ids.length - 1 && gameState.revealed && next === 0) {
      handleShowLeaderboard();
      return;
    }
    handleSetActiveUser(ids[next]);
  }, [gameState.activeUser, gameState.revealed, currentUser.isCreator, users, handleSetActiveUser, handleShowLeaderboard]);

  const handlePrevUser = useCallback(() => {
    if (!gameState.activeUser || !currentUser.isCreator) return;
    const ids = getValidUserIds(users);
    const idx = ids.indexOf(gameState.activeUser);
    const prev = (idx - 1 + ids.length) % ids.length;
    handleSetActiveUser(ids[prev]);
  }, [gameState.activeUser, currentUser.isCreator, users, handleSetActiveUser]);

  const hasUserSubmitted = (userId: string): boolean => {
    const m = gameState.users[userId]?.music;
    return !!(m && m.videoId);
  };

  const handleStartRetrospective = useCallback(async () => {
    if (!currentUser.isCreator) return;
    const newState = { ...gameState, retrospectiveStarted: true };
    await updateIcebreakerState(sessionId, convertToDbState(newState));
    setGameState(prev => ({ ...prev, retrospectiveStarted: true }));
  }, [currentUser.isCreator, gameState, sessionId]);

  // Progress: number of associations current user has done
  const associationProgress = useMemo(() => Object.keys(gameState.users[currentUser.id]?.votes || {}).length, [gameState, currentUser.id]);

  return (
    <div className='flex flex-col items-center justify-center h-screen'>
      <div className="absolute top-4 left-4">
        <a href="/" className="flex items-center justify-center w-8 h-8 rounded-full bg-white/80 hover:bg-white shadow-sm text-indigo-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </a>
      </div>
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center p-6 bg-white/80 rounded-lg shadow-lg min-w-[50vw] min-h-[50vh] mt-20 mb-4">
        <div className="w-full overflow-y-auto">
          <h2 className="text-2xl font-bold mb-6 text-indigo-800">Music Share</h2>

          {gameState.finalLeaderboard || gameState.completed ? (
            <div className="space-y-8">
              <Leaderboard
                gameState={gameState}
                currentUser={currentUser}
                users={users}
                handleStartRetrospective={handleStartRetrospective}
              />
            </div>
          ) : (
            <>
              {!hasUserSubmitted(currentUser.id) && (
                <MusicSubmissionForm music={music} setMusic={setMusic} onSubmit={handleSubmit} />
              )}

              {hasUserSubmitted(currentUser.id) && !allSubmitted && (
                <WaitingRoom users={users} gameState={gameState} />
              )}

              {hasUserSubmitted(currentUser.id) && allSubmitted && !allVoted && !gameState.finalLeaderboard && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full">
                      <div
                        className="h-2 bg-indigo-600 rounded-full transition-all duration-300 ease-in-out"
                        style={{ width: `${(associationProgress / (getValidUserIds(users).length - 1)) * 100}%` }}
                      ></div>
                    </div>
                    <div className="ml-4 text-sm font-medium text-gray-700">
                      {associationProgress}/{getValidUserIds(users).length - 1} associated
                    </div>
                  </div>

                  {getValidUserIds(users).map(uid => (
                    uid === currentUser.id ? null : (
                      <div key={uid}>
                        <UserMusic
                          userId={uid}
                          gameState={gameState}
                          currentUser={currentUser}
                          users={users}
                          handleGuess={handleGuess}
                        />
                      </div>
                    )
                  ))}
                </div>
              )}

              {hasUserSubmitted(currentUser.id) && allSubmitted && allVoted && !gameState.finalLeaderboard && (
                <div className="space-y-8">
                  <ResultsNavigation
                    gameState={gameState}
                    currentUser={currentUser}
                    users={users}
                    handlePrevUser={handlePrevUser}
                    handleNextUser={handleNextUser}
                    handleShowLeaderboard={handleShowLeaderboard}
                    isLastUser={isLastUser}
                    icebreakerType="music-share"
                  />

                  {gameState.activeUser && (
                    <UserMusic
                      userId={gameState.activeUser}
                      gameState={gameState}
                      currentUser={currentUser}
                      users={users}
                    />
                  )}

                  <RevealButton
                    currentUser={currentUser}
                    gameState={gameState}
                    handleReveal={handleReveal}
                    icebreakerType="music-share"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MusicShare;


