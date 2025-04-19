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
  
  // First, find users who are in both the users object and the game state
  const usersInGameState = validUserIds.filter(userId => 
    gameState.users[userId] && gameState.users[userId].statements
  );
  
  // If no users are in the game state yet, return false
  if (usersInGameState.length === 0) return false;
  
  // Check if all users have completed their submissions (all statements filled)
  const allUsersSubmitted = usersInGameState.every(userId => {
    const userStatements = gameState.users[userId]?.statements;
    if (!userStatements) return false;
    
    // Check that all three statements have non-empty text
    return Object.values(userStatements).every(statement => 
      statement && statement.text && statement.text.trim().length > 0
    );
  });
  
  // Make sure all valid users are in the game state
  return allUsersSubmitted && usersInGameState.length === validUserIds.length;
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