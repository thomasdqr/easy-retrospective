import React from 'react';
import { IcebreakerProps } from '../types';
import { updateIcebreakerState } from '../../../services/realtimeDbService';

const DrawYourWeekend: React.FC<IcebreakerProps> = ({ sessionId, currentUser, users, onComplete }) => {
  // This is a placeholder component that will be implemented later
  
  const handleStartRetrospective = async () => {
    if (!currentUser.isCreator) return;
    
    try {
      // Update the state to notify all users
      const newState = {
        retrospectiveStarted: true
      };
      
      // Update the database
      await updateIcebreakerState(sessionId, newState);
      
      // Call onComplete directly as well
      onComplete();
    } catch (error) {
      console.error("Error starting retrospective:", error);
    }
  };

  return (
    <div className='flex flex-col items-center justify-center h-screen'>
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center p-6 bg-white/80 rounded-lg shadow-lg min-w-[50vw] min-h-[50vh] mt-20 mb-4">
        <div className="w-full overflow-y-auto text-center">
          <h2 className="text-2xl font-bold mb-6 text-indigo-800">Draw Your Weekend</h2>
          
          <div className="py-8 px-4">
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-8" role="alert">
              <p className="font-bold">Coming Soon</p>
              <p>This icebreaker activity is under development and will be available in a future update.</p>
            </div>
            
            <div className="w-64 h-64 mx-auto border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center mb-8">
              <svg className="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            
            <p className="text-gray-600 mb-8">
              The "Draw Your Weekend" activity will let team members express themselves 
              through drawings that represent their weekend experiences, fostering creative 
              communication and team bonding.
            </p>
            
            {currentUser.isCreator && (
              <button
                onClick={handleStartRetrospective}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Skip & Start Retrospective
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrawYourWeekend; 