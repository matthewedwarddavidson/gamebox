import type { GameDefinition } from './types';
import { useShell } from './shellStore';

/** The game picker: a landing screen listing every registered game. */
export function Hub({ games }: { games: GameDefinition[] }) {
  const openGame = useShell((s) => s.openGame);

  return (
    <div className="app hub">
      <header className="home__header">
        <h1 className="home__title">Games</h1>
        <p className="home__subtitle">Pick something to play.</p>
      </header>

      <div className="hub__grid">
        {games.map((g) => (
          <button key={g.id} className="card hub__card" onClick={() => openGame(g.id)}>
            <h2>{g.title}</h2>
            <p className="muted">{g.tagline}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
