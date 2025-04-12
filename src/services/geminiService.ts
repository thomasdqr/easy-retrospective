import { IcebreakerGameState } from '../components/icebreaker/types';
import { StickyNote, User, Column } from '../types';

// Gemini API endpoints and models
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'models/gemini-2.0-flash';

interface RetroSummaryData {
  icebreakerState: IcebreakerGameState;
  users: Record<string, User>;
  stickyNotes: Record<string, StickyNote>;
  columns?: Record<string, Column>;
}

export interface GeminiApiConfig {
  apiKey: string;
}

let apiConfig: GeminiApiConfig | null = null;

export const setGeminiApiConfig = (config: GeminiApiConfig) => {
  apiConfig = config;
  // Store API key in local storage for later use
  localStorage.setItem('gemini_api_key', config.apiKey);
};

export const getGeminiApiConfig = (): GeminiApiConfig | null => {
  if (apiConfig) return apiConfig;
  
  // Try to retrieve from local storage
  const storedApiKey = localStorage.getItem('gemini_api_key');
  if (storedApiKey) {
    apiConfig = { apiKey: storedApiKey };
    return apiConfig;
  }
  
  return null;
};

export const generateRetroSummary = async (data: RetroSummaryData): Promise<string> => {
  const config = getGeminiApiConfig();
  if (!config || !config.apiKey) {
    throw new Error('Gemini API key not configured');
  }

  // Extract icebreaker statements and scores
  const icebreakerData = Object.entries(data.icebreakerState.users).map(([userId, userData]) => {
    const userName = data.users[userId]?.name || 'Unknown';
    
    // Extract the statements with their revealed status
    const statements = userData.statements ? [
      { text: userData.statements["0"]?.text || '', isLie: userData.statements["0"]?.isLie || false },
      { text: userData.statements["1"]?.text || '', isLie: userData.statements["1"]?.isLie || false },
      { text: userData.statements["2"]?.text || '', isLie: userData.statements["2"]?.isLie || false }
    ] : [];
    
    return {
      name: userName,
      score: userData.score || 0,
      statements
    };
  });

  // Find the winner (highest score)
  const winner = [...icebreakerData].sort((a, b) => b.score - a.score)[0];

  // Extract and sort sticky notes by votes
  const stickyNotesWithVotes = Object.values(data.stickyNotes).map(note => {
    const voteCount = note.votes ? Object.keys(note.votes).length : 0;
    return {
      content: note.content,
      columnId: note.columnId,
      votes: voteCount
    };
  }).sort((a, b) => b.votes - a.votes);

  // Group sticky notes by column ID
  const stickyNotesByColumn: Record<string, { 
    columnId: string, 
    columnTitle: string,
    notes: { content: string, votes: number }[] 
  }> = {};
  
  stickyNotesWithVotes.forEach(note => {
    if (note.columnId) {
      if (!stickyNotesByColumn[note.columnId]) {
        // Get column title if available, or use column ID as fallback
        const columnTitle = data.columns && data.columns[note.columnId] 
          ? data.columns[note.columnId].title 
          : note.columnId;
          
        stickyNotesByColumn[note.columnId] = {
          columnId: note.columnId,
          columnTitle: columnTitle,
          notes: []
        };
      }
      stickyNotesByColumn[note.columnId].notes.push({
        content: note.content,
        votes: note.votes
      });
    }
  });

  // Prepare the prompt for Gemini
  const prompt = `
    Generate a fun and professional retrospective summary with the following data:
    
    Icebreaker (Two Truths and a Lie) results:
    ${icebreakerData.map(user => {
      const lies = user.statements.filter(s => s.isLie).map(s => s.text);
      const truths = user.statements.filter(s => !s.isLie).map(s => s.text);
      
      return `${user.name} (Score: ${user.score})
      - Truths: ${truths.join(', ')}
      - Lie: ${lies.join(', ')}`;
    }).join('\n\n')}
    
    Winner: ${winner.name} (Score: ${winner.score})
    
    Retrospective feedback by category:
    ${Object.values(stickyNotesByColumn).map(column => {
      return `${column.columnTitle}:\n${column.notes.map(note => 
        `- ${note.content} (Votes: ${note.votes})`).join('\n')}`;
    }).join('\n\n')}
    
    Please structure the summary as follows:
    1. A fun introduction mentioning the icebreaker activity with a title using markdown heading (##). 
       IMPORTANT: In "Two Truths and a Lie", a high score means the person was GOOD at detecting the lies, 
       not bad at it. Highlight the winner as the best detective ! Include 1-2 interesting or funny statements from participants.
    
    ${Object.values(stickyNotesByColumn).map((column, index) => {
      return `${index + 2}. Key insights from "${column.columnTitle}" (most voted items) with a section heading using markdown (##)`;
    }).join('\n\n')}
    
    Do not mention every sticky note in the summary. Group similar ideas together if there are multiple sticky notes with the same idea.
    Focus on the ideas with the most votes.

    FORMAT THE OUTPUT AS MARKDOWN with appropriate headings, lists, and emphasis. Use bold and italics for important points.
    Do not display the number of votes in the summary.
    Use emojis to make the message more engaging and visually appealing. Keep the tone professional but friendly.
  `;

  try {
    // Using the v1beta endpoint format for Gemini 2.0 Flash
    const response = await fetch(`${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    // Extract the generated text from the response
    const generatedText = data.candidates[0]?.content?.parts[0]?.text || 
      'Unable to generate a retrospective summary at this time.';
    
    return generatedText;
  } catch (error) {
    console.error('Error generating retrospective summary:', error);
    throw error;
  }
}; 