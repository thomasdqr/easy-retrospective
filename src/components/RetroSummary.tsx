import React, { useState, useEffect } from 'react';
import { IcebreakerGameState } from '../components/icebreaker/types';
import { StickyNote, User } from '../types';
import { generateRetroSummary, setGeminiApiConfig, getGeminiApiConfig } from '../services/geminiService';
import { X, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RetroSummaryProps {
  sessionId?: string;
  icebreakerState: IcebreakerGameState;
  users: Record<string, User>;
  stickyNotes: Record<string, StickyNote>;
  onClose: () => void;
}

const RetroSummary: React.FC<RetroSummaryProps> = ({ 
  sessionId, 
  icebreakerState, 
  users, 
  stickyNotes, 
  onClose 
}) => {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(!getGeminiApiConfig());
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    // Check if API key is already configured
    const config = getGeminiApiConfig();
    if (config && config.apiKey) {
      setApiKey(config.apiKey);
    } else {
      setIsConfiguring(true);
    }
  }, []);

  const handleGenerateSummary = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const summaryText = await generateRetroSummary({
        icebreakerState,
        users,
        stickyNotes
      });
      setSummary(summaryText);
    } catch (err) {
      console.error('Error generating summary:', err);
      setError((err as Error).message || 'Failed to generate retrospective summary');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      setError('Please enter a valid API key');
      return;
    }
    
    setGeminiApiConfig({ apiKey });
    setIsConfiguring(false);
    setError(null);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(summary);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-indigo-800">🎯 Retrospective Summary</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {isConfiguring ? (
            <div className="bg-indigo-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">Configure Gemini API</h3>
              <p className="mb-4 text-gray-700">
                To generate a retrospective summary, you need to provide a Gemini API key.
                You can get a free API key from the Google AI Studio website.
              </p>
              
              <ol className="list-decimal list-inside mb-6 space-y-2 text-gray-700">
                <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google AI Studio</a></li>
                <li>Sign in with your Google account</li>
                <li>Create a new API key</li>
                <li>Copy and paste the API key below</li>
              </ol>
              
              <div className="mb-4">
                <label htmlFor="apiKey" className="block mb-2 font-medium text-gray-700">API Key:</label>
                <input
                  id="apiKey"
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Gemini API key"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              {error && (
                <div className="p-3 mb-4 bg-red-100 text-red-800 rounded-lg">
                  {error}
                </div>
              )}
              
              <button
                onClick={handleSaveApiKey}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium shadow-md hover:bg-indigo-700 transition-colors duration-200"
              >
                Save API Key
              </button>
            </div>
          ) : (
            <>
              {summary ? (
                <div className="prose prose-indigo max-w-none prose-headings:text-indigo-700 prose-hr:border-indigo-200 prose-a:text-indigo-600 prose-ul:list-disc prose-ol:list-decimal">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({...props}) => <h1 className="text-3xl font-bold my-4 text-indigo-800" {...props} />,
                      h2: ({...props}) => <h2 className="text-2xl font-bold my-3 text-indigo-700" {...props} />,
                      h3: ({...props}) => <h3 className="text-xl font-bold my-2 text-indigo-600" {...props} />,
                      p: ({...props}) => <p className="my-3 text-gray-700 leading-relaxed" {...props} />,
                      ul: ({...props}) => <ul className="list-disc pl-5 my-3 space-y-1" {...props} />,
                      ol: ({...props}) => <ol className="list-decimal pl-5 my-3 space-y-1" {...props} />,
                      li: ({...props}) => <li className="text-gray-700" {...props} />,
                      blockquote: ({...props}) => <blockquote className="border-l-4 border-indigo-200 pl-4 py-1 my-3 italic text-gray-600" {...props} />,
                      code: ({inline, ...props}) => (
                        inline 
                          ? <code className="bg-gray-100 text-indigo-600 px-1 py-0.5 rounded text-sm" {...props} />
                          : <code className="block bg-gray-100 p-2 rounded text-sm overflow-x-auto my-3" {...props} />
                      ),
                      hr: ({...props}) => <hr className="my-4 border-t-2 border-indigo-100" {...props} />,
                      a: ({...props}) => <a className="text-indigo-600 underline hover:text-indigo-800" {...props} />,
                      strong: ({...props}) => <strong className="font-bold text-gray-900" {...props} />,
                      em: ({...props}) => <em className="italic text-gray-700" {...props} />,
                    }}
                  >
                    {summary}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-12">
                  {loading ? (
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                      <p className="text-gray-600">Generating your retrospective summary...</p>
                    </div>
                  ) : (
                    <div className="bg-indigo-50 p-8 rounded-lg">
                      <h3 className="text-xl font-semibold mb-4">Generate Retrospective Summary</h3>
                      <p className="mb-6 text-gray-700">
                        Click the button below to generate a summary of your retrospective session using Gemini AI.
                        This will analyze the icebreaker activity, sticky notes, and votes to create a comprehensive overview.
                      </p>
                      
                      {error && (
                        <div className="p-3 mb-4 bg-red-100 text-red-800 rounded-lg">
                          {error}
                        </div>
                      )}
                      
                      <button
                        onClick={handleGenerateSummary}
                        disabled={loading}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium shadow-md hover:bg-indigo-700 transition-colors duration-200"
                      >
                        Generate Summary
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        
        {summary && (
          <div className="border-t border-gray-200 p-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 rounded-lg font-medium hover:bg-gray-300 transition-colors mr-2"
            >
              Close
            </button>
            <button
              onClick={handleCopyToClipboard}
              className="px-6 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium hover:bg-indigo-200 transition-colors flex items-center"
            >
              {copySuccess ? (
                <>
                  <Check size={18} className="mr-2" /> Copied!
                </>
              ) : (
                <>
                  <Copy size={18} className="mr-2" /> Copy to Clipboard
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RetroSummary; 