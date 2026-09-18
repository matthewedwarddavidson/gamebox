// Shell-level types shared across games.
import type { ComponentType } from 'react';

/**
 * A game plugs into the shell by exporting one of these. The shell knows
 * nothing about a game's internals; it only renders `Root` when the game is
 * active and shows `title`/`tagline` on the hub.
 */
export interface GameDefinition {
  id: string;
  title: string;
  tagline: string;
  /** The game's own root component. It manages its own screens and state. */
  Root: ComponentType;
}
