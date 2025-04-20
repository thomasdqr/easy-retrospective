import React, { useMemo } from 'react';
import { StickyNote, User } from '../types';
import { ThumbsUp } from 'lucide-react';

interface VoteSummaryProps {
  stickyNotes: Record<string, StickyNote>;
  users: Record<string, User>;
}

function VoteSummary({ stickyNotes, users }: VoteSummaryProps) {
  // Filter and sort the sticky notes by votes
  const topVotedStickies = useMemo(() => {
    return Object.values(stickyNotes)
      .filter(note => note && note.votes && Object.values(note.votes).filter(Boolean).length > 0)
      .sort((a, b) => {
        const aVotes = a.votes ? Object.values(a.votes).filter(Boolean).length : 0;
        const bVotes = b.votes ? Object.values(b.votes).filter(Boolean).length : 0;
        return bVotes - aVotes; // Sort descending
      });
  }, [stickyNotes]);

  // If no voted stickies, don't show anything
  if (topVotedStickies.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-white/90 backdrop-blur-sm shadow-md p-4 rounded-lg border border-indigo-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <ThumbsUp className="w-5 h-5 text-indigo-600" />
        <span>Top Voted Notes</span>
      </h3>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
        {topVotedStickies.map(note => {
          const voteCount = note.votes ? Object.values(note.votes).filter(Boolean).length : 0;
          const author = users[note.authorId];
          
          return (
            <div 
              key={note.id}
              className={`p-3 rounded-lg ${note.color} border border-gray-100 shadow-sm`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="text-sm text-gray-700 break-words whitespace-pre-wrap">
                    {note.content}
                  </div>
                </div>
                <div className="ml-3 flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                  <ThumbsUp className="w-3 h-3" />
                  <span>{voteCount}</span>
                </div>
              </div>
              {author && (
                <div className="mt-2 flex items-center gap-1">
                  <img 
                    src={author.avatar} 
                    alt={author.name}
                    className="w-4 h-4 rounded-full border border-white shadow-sm"
                  />
                  <span className="text-xs text-gray-500">{author.name}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VoteSummary; 