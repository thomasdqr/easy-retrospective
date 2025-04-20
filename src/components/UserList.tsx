import React, { useMemo } from 'react';
import { User } from '../types';
import { removeUserFromSession } from '../services/firebaseService';
import { UserMinus } from 'lucide-react';
import { subscribeToIcebreakerState } from '../services/realtimeDbService';
import { useEffect, useState } from 'react';
import { getValidUserIds } from '../components/icebreaker/utils';
import { IcebreakerGameState, Statement } from '../components/icebreaker/types';

interface UserListProps {
  users: Record<string, User>;
  sessionId: string;
  currentUser: User;
}

function UserList({ users, sessionId, currentUser }: UserListProps) {
  const [gameState, setGameState] = useState<IcebreakerGameState | null>(null);
  const [isIcebreakerVotingPhase, setIsIcebreakerVotingPhase] = useState(false);

  // Subscribe to icebreaker game state to get voting information
  useEffect(() => {
    const unsubscribe = subscribeToIcebreakerState(sessionId, (state) => {
      if (state) {
        setGameState(state);
        
        // Check if we're in the voting phase (all users have submitted but not all have voted)
        const validUserIds = getValidUserIds(users);
        const allVotesComplete = validUserIds.every(userId => {
          const votesReceived = validUserIds.filter(voterId => 
            state.users[voterId]?.votes && 
            state.users[voterId].votes[userId] !== undefined &&
            voterId !== userId // excluding self-vote
          ).length;
          return votesReceived >= validUserIds.length - 1; // excluding self-vote
        });
        
        const allSubmitted = validUserIds.every(userId => 
          state.users[userId]?.statements && 
          Object.values(state.users[userId]?.statements).every(
            (s: Statement) => s && s.text && s.text.trim().length > 0
          )
        );
        
        setIsIcebreakerVotingPhase(allSubmitted && !allVotesComplete);
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
    if (!gameState || !gameState.users || !isIcebreakerVotingPhase) return null;
    
    // Get only users that are still in the session (not kicked or removed)
    const actualValidUserIds = getValidUserIds(users);
    
    // Filter for users that are valid in both Firestore and the game state
    const activeUserIds = Object.keys(gameState.users).filter(id => 
      actualValidUserIds.includes(id) && id !== userId
    );
    
    // Total possible votes is the number of other active users (excluding self)
    const totalPossibleVotes = activeUserIds.length;
    
    // Count votes CAST by this user by checking all other users' vote records
    // A user casts a vote by choosing which statement is a lie for another user
    let votesCast = 0;
    activeUserIds.forEach(targetUserId => {
      // If the target user has votes and this user has voted for one of their statements
      if (gameState.users[targetUserId]?.votes && 
          gameState.users[targetUserId].votes[userId] !== undefined) {
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