import { User } from '../../types';

export interface Statement {
  text: string;
  isLie: boolean;
  revealed: boolean;
}

export interface PlayerState {
  statements: {
    "0": Statement;
    "1": Statement;
    "2": Statement;
  };
  votes: Record<string, number>; // userId -> statementIndex voted as lie
  score?: number;
  statementOrder?: number[]; // Shuffled order of statements [0,1,2]
}

export interface IcebreakerGameState {
  users: Record<string, PlayerState>;
  activeUser: string | null;
  revealed: boolean;
  completed?: boolean;
  finalLeaderboard?: boolean;
  retrospectiveStarted?: boolean;
}

export interface IcebreakerProps {
  sessionId: string;
  currentUser: User;
  users: Record<string, User>;
  onComplete: () => void;
}

// Interfaces for component props
export interface SubmissionFormProps {
  statements: Statement[];
  setStatements: React.Dispatch<React.SetStateAction<Statement[]>>;
  onSubmit: () => void;
}

export interface WaitingRoomProps {
  users: Record<string, User>;
  gameState: IcebreakerGameState;
}

export interface UserStatementsProps {
  userId: string;
  gameState: IcebreakerGameState;
  currentUser: User;
  users: Record<string, User>;
  userVotes: Record<string, number>;
  handleVote: (userId: string, statementIndex: number) => void;
}

export interface ResultsNavigationProps {
  gameState: IcebreakerGameState;
  currentUser: User;
  users: Record<string, User>;
  handlePrevUser: () => void;
  handleNextUser: () => void;
  handleShowLeaderboard: () => void;
  isLastUser: boolean;
}

export interface RevealButtonProps {
  currentUser: User;
  gameState: IcebreakerGameState;
  handleReveal: () => void;
}

export interface LeaderboardProps {
  gameState: IcebreakerGameState;
  currentUser: User;
  users: Record<string, User>;
  handleStartRetrospective: () => void;
} 