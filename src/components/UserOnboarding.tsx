import React, { useState } from 'react';
import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';
import { User } from '../types';
import { RefreshCw } from 'lucide-react';

interface UserOnboardingProps {
  onComplete: (user: Omit<User, 'id'>) => void;
  isCreator?: boolean;
}

function UserOnboarding({ onComplete, isCreator = false }: UserOnboardingProps) {
  const [name, setName] = useState('');
  const [seed, setSeed] = useState(() => Math.random().toString(36).substring(7));

  const generateAvatar = (seed: string) => {
    const avatar = createAvatar(lorelei, {
      seed,
      size: 128,
    });
    return avatar.toDataUriSync();
  };

  const regenerateAvatar = () => {
    setSeed(Math.random().toString(36).substring(7));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onComplete({
        name: name.trim(),
        avatar: generateAvatar(seed),
        isCreator
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 p-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Join Session
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your name and customize your avatar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              placeholder="Enter your name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Avatar
            </label>
            <div className="flex items-center gap-4">
              <img
                src={generateAvatar(seed)}
                alt="Avatar"
                className="w-24 h-24 rounded-full bg-gray-100"
              />
              <button
                type="button"
                onClick={regenerateAvatar}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Join Session
          </button>
        </form>
      </div>
    </div>
  );
}

export default UserOnboarding;