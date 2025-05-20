import { useMemo } from 'react';
import { User } from '../types';
import { removeUserFromSession } from '../services/firebaseService';
import { UserMinus, ChevronUp, ChevronDown } from 'lucide-react';
import { subscribeToIcebreakerState } from '../services/realtimeDbService';
import { useEffect, useState } from 'react';
import { getValidUserIds } from '../components/icebreaker/utils';
import { IcebreakerGameState, Statement, PlayerState } from '../components/icebreaker/types';
import { Drawing } from '../components/icebreaker/types';

interface ExtendedPlayerState extends PlayerState {
  drawing?: Drawing;
  statements?: {
    "0": Statement;
    "1": Statement;
    "2": Statement;
  };
  votes: Record<string, string | number>;
  score: number;
}

interface ExtendedGameState extends Omit<IcebreakerGameState, 'users'> {
  users: Record<string, ExtendedPlayerState>;
}

interface UserListProps {
  users: Record<string, User>;
  sessionId: string;
  currentUser: User;
}

function UserList({ users, sessionId, currentUser }: UserListProps) {
  const [gameState, setGameState] = useState<ExtendedGameState | null>(null);
  const [isIcebreakerVotingPhase, setIsIcebreakerVotingPhase] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Subscribe to icebreaker game state to get voting information
  useEffect(() => {
    const unsubscribe = subscribeToIcebreakerState(sessionId, (state) => {
      if (state) {
        // Convert the state to our extended type
        const extendedState: ExtendedGameState = {
          ...state,
          users: state.users as Record<string, ExtendedPlayerState>
        };
        setGameState(extendedState);
        
        // Check if we're in the voting phase (all users have submitted but not all have voted)
        const validUserIds = getValidUserIds(users);
        
        // Check if all users have submitted
        const allSubmitted = validUserIds.every(userId => {
          const userState = extendedState.users[userId];
          if (!userState) return false;
          
          // Check for either statements (TwoTruthsOneLie) or drawing (DrawYourWeekend)
          let hasSubmitted = false;
          
          if (userState.drawing) {
            // For DrawYourWeekend, check drawing data
            hasSubmitted = userState.drawing && 
                          userState.drawing.imageData !== '' && 
                          userState.drawing.description.trim() !== '';
          } else if (userState.statements) {
            // For TwoTruthsOneLie, check statements
            hasSubmitted = Object.values(userState.statements).every(
              (s: Statement) => s && s.text && s.text.trim().length > 0
            );
          }
          
          return hasSubmitted;
        });


        // Check if all votes are complete
        const allVotesComplete = validUserIds.every(userId => {
          // Count how many votes this user has cast (not received)
          const votesCast = validUserIds.filter(targetId => {
            // Skip self
            if (targetId === userId) return false;
            
            const targetUserState = extendedState.users[targetId];
            return targetUserState?.votes && targetUserState.votes[userId] !== undefined;
          }).length;
          
          // User has completed voting if they've cast votes for all other users
          return votesCast >= validUserIds.length - 1;
        });
        
        const isVotingPhase = allSubmitted && !allVotesComplete;
        setIsIcebreakerVotingPhase(isVotingPhase);
      }
    });

    return () => unsubscribe();
  }, [sessionId, users]);

  // Use useMemo to create a stable sorted array of users
  const sortedUsers = useMemo(() => {
    return Object.values(users)
      .filter(user => user !== null && user !== undefined)
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [users]);

  const handleKickUser = async (userId: string) => {
    if (!currentUser.isCreator || userId === currentUser.id) return;
    await removeUserFromSession(sessionId, userId);
  };

  // Function to get voting progress for a user during the icebreaker voting phase
  const getVotingProgress = (userId: string) => {
    if (!gameState || !gameState.users || !isIcebreakerVotingPhase) {
      return null;
    }
    
    const actualValidUserIds = getValidUserIds(users);
    // Total users except self
    const totalPossibleVotes = actualValidUserIds.length - 1;
    
    // Count votes made BY this user across all other users' vote records
    const votesCast = actualValidUserIds.reduce((count, targetUserId) => {
      // Skip counting votes for self
      if (targetUserId === userId) return count;
      
      // Check if this user has voted for the target user
      const targetUserState = gameState.users[targetUserId];
      if (targetUserState?.votes && targetUserState.votes[userId] !== undefined) {
        return count + 1;
      }
      return count;
    }, 0);
    
    return { votesCast, totalPossibleVotes };
  };

  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-lg shadow-lg ${isCollapsed ? 'p-2 max-w-[200px] ml-auto' : 'p-4 w-full'} border border-gray-100 transition-all duration-200`}>
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-gray-900 ${isCollapsed ? 'text-sm' : 'text-lg'}`}>
          {isCollapsed ? (
            <span className="flex items-center gap-1">
              <span>{sortedUsers.length}</span>
              <span className="text-xs text-gray-500">participant{sortedUsers.length !== 1 ? 's' : ''}</span>
            </span>
          ) : (
            `Participants (${sortedUsers.length})`
          )}
        </h3>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="text-gray-500 hover:text-indigo-600 transition-colors p-1"
          aria-label={isCollapsed ? "Expand participants list" : "Collapse participants list"}
        >
          {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="space-y-3 max-h-[50vh] overflow-y-auto mt-3">
          {sortedUsers.map((user) => {
            // Get voting progress for user in icebreaker voting phase
            const votingProgress = getVotingProgress(user.id);
            
            return (
              <div key={user.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-full bg-gray-100"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      
                      {/* Show voting progress during icebreaker voting phase */}
                      {votingProgress && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          votingProgress.votesCast === votingProgress.totalPossibleVotes 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {votingProgress.votesCast}/{votingProgress.totalPossibleVotes}
                        </span>
                      )}
                    </div>
                    {user.isCreator && (
                      <span className="text-xs text-indigo-600">Creator</span>
                    )}
                  </div>
                </div>
                {currentUser.isCreator && !user.isCreator && (
                  <button
                    onClick={() => handleKickUser(user.id)}
                    className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                    title="Kick user"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default UserList;