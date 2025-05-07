import { useMemo } from 'react';
import { User } from '../types';
import { removeUserFromSession } from '../services/firebaseService';
import { UserMinus } from 'lucide-react';
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
          
          if (userState.metadata?.type === 'drawing') {
            // For DrawYourWeekend, check the metadata
            const drawingData = userState.metadata.data;
            hasSubmitted = drawingData && drawingData.imageData !== '' && drawingData.description.trim() !== '';
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
          const votesReceived = validUserIds.filter(voterId => {
            if (voterId === userId) return false;
            const voterState = extendedState.users[voterId];
            return voterState?.votes && voterState.votes[userId] !== undefined;
          }).length;
          
          return votesReceived >= validUserIds.length - 1;
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
    const activeUserIds = actualValidUserIds.filter(id => id !== userId);
    const totalPossibleVotes = activeUserIds.length;
    
    let votesCast = 0;
    activeUserIds.forEach(targetUserId => {
      const targetUserState = gameState.users[targetUserId];
      if (targetUserState?.votes && targetUserState.votes[userId] !== undefined) {
        votesCast++;
      }
    });
    
    return { votesCast, totalPossibleVotes };
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-lg p-4 w-full border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Participants</h3>
      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
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
    </div>
  );
}

export default UserList;