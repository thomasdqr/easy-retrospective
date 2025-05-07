import React from 'react';
import { IcebreakerProps } from './types';
import TwoTruthsOneLie from './implementations/TwoTruthsOneLie';
import DrawYourWeekend from './implementations/DrawYourWeekend';

const Icebreaker: React.FC<IcebreakerProps> = (props) => {
  // Route to the appropriate icebreaker implementation based on the type
  switch (props.icebreakerType) {
    case 'two-truths-one-lie':
      return <TwoTruthsOneLie {...props} />;
    case 'draw-your-weekend':
      return <DrawYourWeekend {...props} />;
    default:
      console.error('Unknown icebreaker type:', props.icebreakerType);
      return null;
  }
};

export default Icebreaker; 