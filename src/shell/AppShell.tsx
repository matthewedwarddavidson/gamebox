import { useShell } from './shellStore';
import { getGame, GAMES } from './registry';
import { Hub } from './Hub';

/**
 * Top-level router. With no active game it shows the hub; otherwise it renders
 * the active game's Root with a slim shell bar offering a way back to the hub.
 */
export function AppShell() {
  const activeGameId = useShell((s) => s.activeGameId);
  const goHome = useShell((s) => s.goHome);
  const game = activeGameId ? getGame(activeGameId) : undefined;

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
      <Root />
    </>
  );
}
