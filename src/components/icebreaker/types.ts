import { User } from '../../types';
import { IcebreakerType } from '../../types/icebreaker';

export interface Statement {
  text: string;
  isLie: boolean;
  revealed: boolean;
}

export interface Drawing {
  imageData: string;
  description: string;
  revealed: boolean;
  correctGuesses: { [userId: string]: boolean };
}

export interface PlayerState {
  statements?: {
    [key: string]: Statement;
  };
  drawing?: Drawing;
  votes?: { [voterId: string]: string | number };
  score: number;
  statementOrder?: number[];
}

export interface IcebreakerGameState {
  users: {
    [userId: string]: PlayerState;
  };
  activeUser: string | null;
  revealed: boolean;
  finalLeaderboard?: boolean;
  retrospectiveStarted?: boolean;
  completed?: boolean;
}

export interface IcebreakerProps {
  sessionId: string;
  currentUser: User;
  users: { [key: string]: User };
  onComplete: () => void;
  icebreakerType?: IcebreakerType;
}

// Interfaces for component props
export interface SubmissionFormProps {
  statements?: Statement[];
  setStatements?: (statements: Statement[]) => void;
  drawing?: Drawing;
  setDrawing?: (drawing: Drawing) => void;
  onSubmit: () => void;
}

export interface WaitingRoomProps {
  users: { [key: string]: User };
  gameState: IcebreakerGameState;
}

export interface UserStatementsProps {
  userId: string;
  gameState: IcebreakerGameState;
  currentUser: User;
  users: { [key: string]: User };
  userVotes?: { [key: string]: number };
  userGuesses?: { [key: string]: string };
  handleVote?: (userId: string, vote: number) => void;
  handleGuess?: (userId: string, guess: string) => void;
  sessionId?: string;
}

export interface ResultsNavigationProps {
  gameState: IcebreakerGameState;
  currentUser: User;
  users: { [key: string]: User };
  handlePrevUser: () => void;
  handleNextUser: () => void;
  handleShowLeaderboard: () => void;
  isLastUser: boolean;
  icebreakerType?: IcebreakerType;
}

export interface RevealButtonProps {
  currentUser: User;
  gameState: IcebreakerGameState;
  handleReveal: () => void;
}

export interface LeaderboardProps {
  gameState: IcebreakerGameState;
  currentUser: User;
  users: { [key: string]: User };
  handleStartRetrospective: () => void;
} 