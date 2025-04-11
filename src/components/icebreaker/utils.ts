import { IcebreakerGameState } from './types';

/**
 * Utility function to shuffle an array
 */
export const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

/**
 * Check if all users have submitted their statements
 */
export const checkAllSubmitted = (gameState: IcebreakerGameState, userCount: number): boolean => {
  return Object.keys(gameState.users).length === userCount &&
    Object.values(gameState.users).every(state => state.hasSubmitted);
};

/**
 * Check if all users have voted
 */
export const checkAllVoted = (gameState: IcebreakerGameState): boolean => {
  return Object.keys(gameState.users).every(userId => {
    const votesReceived = Object.values(gameState.users).filter(state => 
      state.votes && state.votes[userId] !== undefined
    ).length;
    return votesReceived >= Object.keys(gameState.users).length - 1; // excluding self-vote
  });
};

/**
 * Check if current user is viewing the last user
 */
export const isLastUser = (gameState: IcebreakerGameState): boolean => {
  return gameState.activeUser ? 
    Object.keys(gameState.users).indexOf(gameState.activeUser) === Object.keys(gameState.users).length - 1 
    : false;
}; 