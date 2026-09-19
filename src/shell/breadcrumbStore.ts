// Shared breadcrumb trail shown in the shell's top bar. A game publishes the
// crumbs beyond the top-level "Gamebox" root (its own title plus any sub-screen
// such as Stats or Settings) so the shell can render a single, consistent
// filesystem-style path: Gamebox › Battleships › Stats.
import { create } from 'zustand';

export interface Crumb {
  label: string;
  /** When set, the crumb is a link that runs this handler; otherwise it is the current page. */
  onClick?: () => void;
}

interface BreadcrumbState {
  trail: Crumb[];
  setTrail: (trail: Crumb[]) => void;
}

export const useBreadcrumb = create<BreadcrumbState>((set) => ({
  trail: [],
  setTrail: (trail) => set({ trail }),
}));

/** Convenience helper for games to publish their breadcrumb trail. */
export function setBreadcrumbTrail(trail: Crumb[]): void {
  useBreadcrumb.getState().setTrail(trail);
}
