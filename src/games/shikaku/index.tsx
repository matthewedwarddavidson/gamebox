// Shikaku ("inboxes") game definition — plugs into the shell registry.
import type { GameDefinition } from '../../shell/types';
import { App } from './ui/App';

export const shikakuGame: GameDefinition = {
  id: 'shikaku',
  title: 'inboxes',
  tagline: 'Fill the grid with rectangles. (Shikaku)',
  Root: App,
};
