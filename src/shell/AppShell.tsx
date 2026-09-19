import { useEffect, useState } from 'react';
import { useShell } from './shellStore';
import { getGame, GAMES } from './registry';
import { onProviderChange } from './db';
import { Hub } from './Hub';

/**
 * Top-level router. With no active game it shows the hub; otherwise it renders
 * the active game's Root with a slim shell bar offering a way back to the hub.
 */
export function AppShell() {
  const activeGameId = useShell((s) => s.activeGameId);
  const goHome = useShell((s) => s.goHome);
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
      <div className="shell__bar">
        <button className="btn btn--subtle shell__back" onClick={goHome}>
          ‹ Gamebox
        </button>
        <span className="shell__title">{game.title}</span>
      </div>
      <Root key={dataVersion} />
    </>
  );
}
