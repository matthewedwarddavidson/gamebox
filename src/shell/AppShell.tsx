import { useEffect, useState } from 'react';
import { useShell } from './shellStore';
import { getGame, GAMES } from './registry';
import { onProviderChange } from './db';
import { useBreadcrumb } from './breadcrumbStore';
import { Hub } from './Hub';

/**
 * Top-level router. With no active game it shows the hub; otherwise it renders
 * the active game's Root with a slim breadcrumb bar tracing the path back to
 * the hub.
 */
export function AppShell() {
  const activeGameId = useShell((s) => s.activeGameId);
  const goHome = useShell((s) => s.goHome);
  const trail = useBreadcrumb((s) => s.trail);
  const game = activeGameId ? getGame(activeGameId) : undefined;

  // Remount the active game when the storage backend swaps (sign-in / sign-out)
  // so it re-initialises its state from the newly-active provider.
  const [dataVersion, setDataVersion] = useState(0);
  useEffect(() => onProviderChange(() => setDataVersion((v) => v + 1)), []);

  if (!game) {
    return <Hub games={GAMES} />;
  }

  const Root = game.Root;
  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <button className="breadcrumb__crumb" onClick={goHome}>
          Gamebox
        </button>
        {trail.map((crumb, i) => (
          <span className="breadcrumb__group" key={i}>
            <span className="breadcrumb__sep" aria-hidden="true">
              ›
            </span>
            {crumb.onClick ? (
              <button className="breadcrumb__crumb" onClick={crumb.onClick}>
                {crumb.label}
              </button>
            ) : (
              <span className="breadcrumb__crumb breadcrumb__crumb--current" aria-current="page">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      <Root key={dataVersion} />
    </>
  );
}

