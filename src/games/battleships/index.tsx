// Battleships (Solitaire / Bimaru) game definition — plugs into the shell.
import type { GameDefinition } from '../../shell/types';
import { BattleshipsApp } from './ui/App';
import { BattleshipsPreview } from './ui/Preview';

export const battleshipsGame: GameDefinition = {
  id: 'battleships',
  title: 'Battleships',
  tagline: 'Find the hidden fleet from the row and column counts.',
  Root: BattleshipsApp,
  Preview: BattleshipsPreview,
};
