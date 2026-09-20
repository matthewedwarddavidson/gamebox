import { useEffect } from 'react';
import { useBattleships } from '../store/gameStore';
import { setBreadcrumbTrail } from '../../../shell/breadcrumbStore';
import { requestLeave, setLeaveGuard } from '../../../shell/leaveGuard';
import { Home } from './Home';
import { Play } from './Play';
import { StatsView } from './StatsView';
import './styles.css';

export function BattleshipsApp() {
  const ready = useBattleships((s) => s.ready);
  const screen = useBattleships((s) => s.screen);
  const theme = useBattleships((s) => s.theme);
  const init = useBattleships((s) => s.init);
  const navigate = useBattleships((s) => s.navigate);
  const abandon = useBattleships((s) => s.abandon);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // While a puzzle is unfinished, leaving it (by any route) goes through the guard.
  const inProgress = useBattleships((s) => s.screen === 'play' && s.puzzle !== null && !s.solved && !s.review);
  // Dailies are exempt from the forfeit warning: leaving one just pauses it.
  const isDaily = useBattleships((s) => s.mode === 'daily');
  useEffect(() => {
    setLeaveGuard(inProgress ? { warn: !isDaily, onLeave: abandon } : null);
    return () => setLeaveGuard(null);
  }, [inProgress, isDaily, abandon]);

  useEffect(() => {
    if (screen === 'stats') {
      setBreadcrumbTrail([{ label: 'Battleships', onClick: () => navigate('home') }, { label: 'Stats' }]);
    } else if (screen === 'play') {
      setBreadcrumbTrail([
        { label: 'Battleships', onClick: () => requestLeave(abandon) },
        { label: 'Play' },
      ]);
    } else {
      setBreadcrumbTrail([{ label: 'Battleships' }]);
    }
  }, [screen, navigate, abandon]);

  useEffect(() => () => setBreadcrumbTrail([]), []);

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
