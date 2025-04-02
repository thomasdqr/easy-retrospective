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
}

export interface SessionBasicInfo {
  id: string;
  createdAt: number;
  users: Record<string, User>;
}