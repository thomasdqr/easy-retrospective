import { User } from '../../types';
import { IcebreakerGameState } from './types';

/**
 * Get list of valid (non-kicked) users
 */
export const getValidUsers = (users: Record<string, User>): [string, User][] => {
  return Object.entries(users).filter(([, user]) => user !== null && user !== undefined);
};

/**
 * Get list of valid user IDs
 */
export const getValidUserIds = (users: Record<string, User>): string[] => {
  return getValidUsers(users).map(([userId]) => userId);
};

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
 * Check if all valid users have submitted their statements
 */
export const checkAllSubmitted = (gameState: IcebreakerGameState, users: Record<string, User>): boolean => {
  const validUserIds = getValidUserIds(users);
  
  // Only check submissions for valid users
  const validUsersSubmitted = validUserIds.every(userId => gameState.users[userId]?.hasSubmitted);
  const validUserCount = validUserIds.length;
  const gameStateUserCount = Object.keys(gameState.users).length;

  return validUsersSubmitted && gameStateUserCount >= validUserCount;
};

/**
 * Check if all users have voted
 */
export const checkAllVoted = (gameState: IcebreakerGameState, users: Record<string, User>): boolean => {
  const validUserIds = getValidUserIds(users);
  
  return validUserIds.every(userId => {
    const votesReceived = validUserIds.filter(voterId => 
      gameState.users[voterId]?.votes && 
      gameState.users[voterId].votes[userId] !== undefined &&
      voterId !== userId // excluding self-vote
    ).length;
    return votesReceived >= validUserIds.length - 1; // excluding self-vote
  });
};

/**
 * Check if current user is viewing the last user
 */
export const isLastUser = (gameState: IcebreakerGameState, users: Record<string, User>): boolean => {
  const validUserIds = getValidUserIds(users);
  return gameState.activeUser ? 
    validUserIds.indexOf(gameState.activeUser) === validUserIds.length - 1 
    : false;
}; 