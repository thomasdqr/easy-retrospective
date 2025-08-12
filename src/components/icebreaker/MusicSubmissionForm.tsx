import React, { useMemo } from 'react';
import { MusicShareItem } from './types';

interface MusicSubmissionFormProps {
  music: MusicShareItem;
  setMusic: (music: MusicShareItem) => void;
  onSubmit: () => void;
}

// Extract YouTube video ID from various URL formats
const extractYouTubeId = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1) || null;
    }
    if (u.hostname.endsWith('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      // Handle embed URLs like /embed/VIDEOID
      const parts = u.pathname.split('/').filter(Boolean);
      const embedIndex = parts.indexOf('embed');
      if (embedIndex !== -1 && parts[embedIndex + 1]) return parts[embedIndex + 1];
    }
  } catch {
    // ignore invalid URL
  }
  return null;
};

const MusicSubmissionForm: React.FC<MusicSubmissionFormProps> = ({ music, setMusic, onSubmit }) => {
  const videoId = useMemo(() => extractYouTubeId(music.url), [music.url]);
  const isValid = !!videoId;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <p className="mb-4 text-gray-700">Paste a YouTube link to a song you enjoyed recently:</p>
      <div className="space-y-4">
        <input
          type="url"
          value={music.url}
          onChange={(e) => {
            const url = e.target.value;
            const id = extractYouTubeId(url) || '';
            setMusic({ ...music, url, videoId: id, revealed: false });
          }}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        />

        {isValid ? (
          <div className="aspect-video w-full border rounded-md overflow-hidden">
            <iframe
              title="YouTube Preview"
              src={`https://www.youtube.com/embed/${videoId}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          music.url && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
              Invalid YouTube link. Please paste a valid YouTube URL.
            </div>
          )
        )}

        <button
          onClick={onSubmit}
          disabled={!isValid}
          className={`w-full ${isValid ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-300 cursor-not-allowed'} text-white px-6 py-3 rounded-md font-medium shadow-md transition-colors duration-200`}
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export default MusicSubmissionForm;


