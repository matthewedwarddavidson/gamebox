// Kakuro game definition — plugs into the shell.
import type { GameDefinition } from '../../shell/types';
import { KakuroApp } from './ui/App';
import { KakuroPreview } from './ui/Preview';

export const kakuroGame: GameDefinition = {
  id: 'kakuro',
  title: 'Kakuro',
  tagline: 'Fill each run of digits so it adds up to its clue.',
  Root: KakuroApp,
  Preview: KakuroPreview,
};
