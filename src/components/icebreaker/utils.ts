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
  
  // If there are no valid users or no game state, return false
  if (validUserIds.length === 0 || Object.keys(gameState.users || {}).length === 0) {
    console.log("Debug - checkAllVoted: No valid users or game state");
    return false;
  }
  
  // First, make sure all users have submitted
  const allSubmitted = checkAllSubmitted(gameState, users);
  if (!allSubmitted) {
    console.log("Debug - checkAllVoted: Not all users have submitted yet");
    return false;
  }
  
  // Check votes for each user
  let allVoted = true;
  
  // For each user, check if they've received votes from all other users
  for (const targetUserId of validUserIds) {
    // How many votes this user should receive (from all other users)
    const requiredVotes = validUserIds.length - 1; // excluding self
    
    // Count how many other users have voted for this user
    let votesReceived = 0;
    
    for (const voterId of validUserIds) {
      // Skip self (users don't vote for themselves)
      if (voterId === targetUserId) continue;
      
      const voterState = gameState.users[voterId];
      // Check if this voter has voted for the target user
      if (voterState?.votes && voterState.votes[targetUserId] !== undefined) {
        votesReceived++;
      }
    }
    
    // If this user hasn't received enough votes, not everyone has voted
    if (votesReceived < requiredVotes) {
      allVoted = false;
      console.log(`Debug - checkAllVoted: User ${targetUserId} has only received ${votesReceived}/${requiredVotes} votes`);
      break;
    }
  }
  
  console.log("Debug - checkAllVoted result:", allVoted);
  return allVoted;
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