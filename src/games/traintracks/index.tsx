// Train Tracks game definition — plugs into the shell.
import type { GameDefinition } from '../../shell/types';
import { TrainTracksApp } from './ui/App';
import { TrainTracksPreview } from './ui/Preview';

export const trainTracksGame: GameDefinition = {
  id: 'traintracks',
  title: 'Train Tracks',
  tagline: 'Lay one continuous track from the row and column counts.',
  Root: TrainTracksApp,
  Preview: TrainTracksPreview,
};
