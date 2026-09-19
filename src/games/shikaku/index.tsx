// Shikaku game definition — plugs into the shell registry.
import type { GameDefinition } from '../../shell/types';
import { App } from './ui/App';
import { ShikakuPreview } from './ui/Preview';

export const shikakuGame: GameDefinition = {
  id: 'shikaku',
  title: 'Shikaku',
  tagline: 'Fill the grid with rectangles.',
  Root: App,
  Preview: ShikakuPreview,
};
