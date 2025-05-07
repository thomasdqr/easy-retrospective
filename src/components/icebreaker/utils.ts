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
 * Check if all valid users have submitted their statements or drawings
 */
export const checkAllSubmitted = (gameState: IcebreakerGameState, users: Record<string, User>): boolean => {
  const validUserIds = getValidUserIds(users);
  
  // First, find users who are in both the users object and the game state
  const usersInGameState = validUserIds.filter(userId => 
    gameState.users[userId]
  );
  
  console.log("Debug - checkAllSubmitted:", {
    validUserIds,
    usersInGameState,
    gameStateUsers: Object.keys(gameState.users),
    submissions: usersInGameState.map(userId => ({
      userId,
      hasDrawing: !!gameState.users[userId]?.drawing,
      drawingData: gameState.users[userId]?.drawing?.imageData ? 'exists' : 'missing',
      description: gameState.users[userId]?.drawing?.description ? 'exists' : 'missing'
    }))
  });
  
  // If no users are in the game state yet, return false
  if (usersInGameState.length === 0) return false;
  
  // Check if all users have completed their submissions
  const allUsersSubmitted = usersInGameState.every(userId => {
    const userState = gameState.users[userId];
    if (!userState) return false;
    
    // Check for statements (TwoTruthsOneLie)
    if (userState.statements) {
      return Object.values(userState.statements).every(statement => 
        statement && statement.text && statement.text.trim().length > 0
      );
    }
    
    // Check for drawing (DrawYourWeekend)
    if (userState.drawing) {
      return userState.drawing.imageData !== '' && userState.drawing.description.trim() !== '';
    }
    
    return false;
  });
  
  // Make sure all valid users are in the game state
  const result = allUsersSubmitted && usersInGameState.length === validUserIds.length;
  console.log("Debug - checkAllSubmitted result:", result);
  return result;
};

/**
 * Check if all users have voted
 */
export const checkAllVoted = (gameState: IcebreakerGameState, users: Record<string, User>): boolean => {
  const validUserIds = getValidUserIds(users);
  
  const votingStatus = validUserIds.map(userId => {
    // Count how many votes this user has given (instead of received)
    const votesGiven = Object.keys(gameState.users[userId]?.votes || {}).length;
    const requiredVotes = validUserIds.length - 1; // excluding self-vote
    
    return {
      userId,
      votesGiven,
      requiredVotes,
      hasEnoughVotes: votesGiven >= requiredVotes
    };
  });

  console.log("Debug - checkAllVoted:", {
    validUserIds,
    votingStatus,
    gameStateVotes: Object.entries(gameState.users).map(([userId, user]) => ({
      userId,
      votes: user.votes,
      votesGiven: Object.keys(user.votes || {}).length,
      requiredVotes: validUserIds.length - 1
    }))
  });
  
  const result = votingStatus.every(status => status.hasEnoughVotes);
  console.log("Debug - checkAllVoted result:", result);
  return result;
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