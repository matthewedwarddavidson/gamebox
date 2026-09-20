import { useMemo, useState } from 'react';
import { useBattleships } from '../store/gameStore';
import { DIFFICULTIES, dailyFor, type Difficulty } from '../engine';
import { capitalize } from './format';
import { DailyCalendar } from './DailyCalendar';

export function Home() {
  const startFree = useBattleships((s) => s.startFree);
  const startDaily = useBattleships((s) => s.startDaily);
  const viewSolution = useBattleships((s) => s.viewSolution);
  const stats = useBattleships((s) => s.stats);
  const games = useBattleships((s) => s.games);
  const navigate = useBattleships((s) => s.navigate);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [showCalendar, setShowCalendar] = useState(false);

  const daily = dailyFor();
  const dailyPaused = useBattleships(
    (s) =>
      s.puzzle !== null &&
      s.mode === 'daily' &&
      s.dailyKey === daily.dateKey &&
      !s.solved &&
      !s.review,
  );

  const completedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const g of games) {
      if (g.mode === 'daily' && g.status === 'won' && g.dailyKey) keys.add(g.dailyKey);
    }
    return keys;
  }, [games]);

  const todayDone = completedKeys.has(daily.dateKey);

  return (
    <div className="home">
      <header className="home__header">
        <h1 className="home__title">Battleships</h1>
        <p className="home__subtitle">Find the hidden fleet from the counts.</p>
      </header>

      <section className="card">
        <div className="card__head">
          <h2>Daily puzzle</h2>
          {todayDone && <span className="tag tag--done">Completed ✓</span>}
        </div>
        <p className="muted">
          {daily.dateKey} · {capitalize(daily.difficulty)}
        </p>
        {todayDone ? (
          <>
            <button className="btn btn--primary" onClick={() => viewSolution()}>
              View solution
            </button>
            <button className="btn btn--subtle" onClick={() => startDaily()}>
              Replay today’s puzzle
            </button>
          </>
        ) : (
          <button className="btn btn--primary" onClick={() => startDaily()}>
            {dailyPaused ? 'Resume' : 'Play'} today’s puzzle
          </button>
        )}
        <button
          className="btn btn--subtle calendar-toggle"
          onClick={() => setShowCalendar((v) => !v)}
          aria-expanded={showCalendar}
        >
          {showCalendar ? 'Hide past puzzles' : 'Play a past puzzle'}
        </button>
        {showCalendar && (
          <DailyCalendar
            completedKeys={completedKeys}
            onPick={(date, done) => (done ? viewSolution(date) : startDaily(date))}
          />
        )}
      </section>

      <section className="card">
        <h2>Free play</h2>
        <div className="difficulty-picker">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              className={`chip ${d === difficulty ? 'chip--active' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              {capitalize(d)}
            </button>
          ))}
        </div>
        <button className="btn btn--primary" onClick={() => startFree(difficulty)}>
          Start {capitalize(difficulty)} puzzle
        </button>
      </section>

      <section className="home__quickstats">
        <div className="stat">
          <span className="stat__value">{stats.played}</span>
          <span className="stat__label">Played</span>
        </div>
        <div className="stat">
          <span className="stat__value">{stats.won}</span>
          <span className="stat__label">Won</span>
        </div>
        <div className="stat">
          <span className="stat__value">{stats.currentStreak}</span>
          <span className="stat__label">Streak</span>
        </div>
      </section>

      <button className="btn" onClick={() => navigate('stats')}>
        View stats
      </button>
    </div>
  );
}
