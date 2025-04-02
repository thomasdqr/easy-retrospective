import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { PenLine } from 'lucide-react';
import { createSession } from '../services/firebaseService';
import { useState } from 'react';


function Home() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);



  const createNewSession = async () => {
    try {
      setIsCreating(true);
      const sessionId = nanoid(10);
      
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-100 to-purple-100">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <PenLine className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Retrospective Board
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Create a session and invite your team to collaborate in real-time
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