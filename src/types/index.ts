import { IcebreakerType } from './icebreaker';

export interface User {
  id: string;
  name: string;
  avatar: string;
  isCreator: boolean;
}

export interface StickyNote {
  id: string;
  content: string;
  authorId: string;
  position: {
    x: number;
    y: number;
  };
  color: string;
  columnId?: string;
  votes?: Record<string, boolean>;
}

export interface Column {
  id: string;
  title: string;
  color: string;
  position: {
    x: number;
    width: number;
  };
}

export interface SessionBasicInfo {
  id: string;
  createdAt: number;
  users: Record<string, User>;
  icebreakerType?: IcebreakerType;
}

export interface SessionState {
  isRevealed: boolean;
  votingPhase: boolean;
  voteLimit?: number;
}