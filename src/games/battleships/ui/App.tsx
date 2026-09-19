import { useEffect } from 'react';
import { useBattleships } from '../store/gameStore';
import { Home } from './Home';
import { Play } from './Play';
import { StatsView } from './StatsView';
import './styles.css';

export function BattleshipsApp() {
  const ready = useBattleships((s) => s.ready);
  const screen = useBattleships((s) => s.screen);
  const theme = useBattleships((s) => s.theme);
  const init = useBattleships((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  if (!ready) {
    return (
      <div className="app app--loading">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="app">
      {screen === 'home' && <Home />}
      {screen === 'play' && <Play />}
      {screen === 'stats' && <StatsView />}
    </div>
  );
}
