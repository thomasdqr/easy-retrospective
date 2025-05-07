import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { History } from 'lucide-react';
import { createSession } from '../services/firebaseService';
import { cleanupOldSessions } from '../services/sessionCleanupService';
import { useState } from 'react';
import favicon from '../assets/favicon.png';


function Home() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);



  const createNewSession = async () => {
    try {
      setIsCreating(true);
      const sessionId = nanoid(10);
      
      // Clean up old sessions before creating a new one
      try {
        await cleanupOldSessions();
      } catch (cleanupError) {
        console.error('Error cleaning up old sessions:', cleanupError);
        // Continue with session creation even if cleanup fails
      }
      
      console.log('Creating session with ID:', sessionId);
      const success = await createSession(sessionId);
      
      if (success) {
        console.log('Session created successfully, navigating to:', `/session/${sessionId}`);
        navigate(`/session/${sessionId}`);
      } else {
        console.error('Failed to verify session creation');
        alert('Failed to create session. Please try again.');
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session. Please try again.');
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-linear-to-br from-indigo-100 to-purple-100">
      <div className="max-w-2xl w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <img src={favicon} alt="Favicon" className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Easy Retrospective
          </h2>
          <p className="font-semibold text-xl text-indigo-600 mt-1 whitespace-nowrap">
            Grow Understanding, Explore Perspectives, Inspire Next.
          </p>
          <p className="mt-4 text-sm text-gray-600">
            Start a new session and invite team members to collaborate on retrospectives in real-time, enhancing team communication and growth.
          </p>
        </div>

        <div className="mt-8">
          <button
            onClick={createNewSession}
            disabled={isCreating}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isCreating ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors`}
          >
            {isCreating ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                Creating...
              </>
            ) : (
              'Create New Session'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;