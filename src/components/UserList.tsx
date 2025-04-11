import React, { useMemo } from 'react';
import { User } from '../types';

interface UserListProps {
  users: Record<string, User>;
}

function UserList({ users }: UserListProps) {
  // Use useMemo to create a stable sorted array of users
  const sortedUsers = useMemo(() => {
    return Object.values(users)
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [users]);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-lg p-4 w-64 border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Participants</h3>
      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
        {sortedUsers.map((user) => (
          <div key={user.id} className="flex items-center gap-3">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              {user.isCreator && (
                <span className="text-xs text-indigo-600">Creator</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UserList;