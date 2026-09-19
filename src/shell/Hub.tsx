import type { GameDefinition } from './types';
import { useShell } from './shellStore';
import { AccountMenu } from './AccountMenu';

/** The game picker: a landing screen listing every registered game. */
export function Hub({ games }: { games: GameDefinition[] }) {
  const openGame = useShell((s) => s.openGame);

  return (
    <div className="app hub">
      <header className="home__header">
        <h1 className="home__title">Gamebox</h1>
        <p className="home__subtitle">Pick something to play.</p>
      </header>

      <AccountMenu />

      <div className="hub__grid">
        {games.map((g) => (
          <button key={g.id} className="card hub__card" onClick={() => openGame(g.id)}>
            <div className="hub__preview" aria-hidden="true">
              {g.Preview ? <g.Preview /> : null}
            </div>
            <div className="hub__text">
              <h2>{g.title}</h2>
              <p className="muted">{g.tagline}</p>
            </div>
          </button>
        ))}
      </div>

      <footer className="hub__footer">
        <details className="privacy">
          <summary className="privacy__summary">Privacy</summary>
          <div className="privacy__body">
            <p>
              Your puzzles and progress are saved in your browser. Signing in is
              optional and only used to sync that data across your devices via
              Firebase (Google).
            </p>
            <p>
              We collect anonymous, cookieless usage stats (visits and games
              played) to understand what's popular. No cookies, no persistent
              identifier and no cross-site tracking; the browser's Do-Not-Track
              setting is respected. Analytics run through Firebase (Google),
              which processes your IP address to deliver the request.
            </p>
          </div>
        </details>
      </footer>
    </div>
  );
}
