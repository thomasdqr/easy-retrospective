export type IcebreakerType = 'two-truths-one-lie' | 'draw-your-weekend' | 'music-share';

export interface IcebreakerConfig {
  type: IcebreakerType;
  name: string;
  description: string;
}

export const ICEBREAKER_TYPES: IcebreakerConfig[] = [
  {
    type: 'two-truths-one-lie',
    name: 'Two Truths and a Lie',
    description: 'Share two true statements and one lie about yourself.'
  },
  {
    type: 'draw-your-weekend',
    name: 'Draw your week end',
    description: 'Draw something that represents your weekend.'
  },
  {
    type: 'music-share',
    name: 'Music Share',
    description: 'Share a recent song via YouTube link, then guess who shared which track.'
  }
];

// Default icebreaker type
export const DEFAULT_ICEBREAKER: IcebreakerType = 'two-truths-one-lie'; 