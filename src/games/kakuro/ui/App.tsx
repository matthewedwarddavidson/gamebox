import { useEffect } from 'react';
import { useKakuro } from '../store/gameStore';
import { setBreadcrumbTrail } from '../../../shell/breadcrumbStore';
import { requestLeave, setLeaveGuard } from '../../../shell/leaveGuard';
import { Home } from './Home';
import { Play } from './Play';
import { StatsView } from './StatsView';
import './styles.css';

export function KakuroApp() {
  const ready = useKakuro((s) => s.ready);
  const screen = useKakuro((s) => s.screen);
  const theme = useKakuro((s) => s.theme);
  const init = useKakuro((s) => s.init);
  const navigate = useKakuro((s) => s.navigate);
  const abandon = useKakuro((s) => s.abandon);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // While a puzzle is unfinished, leaving it (by any route) goes through the guard.
  const inProgress = useKakuro((s) => s.screen === 'play' && s.puzzle !== null && !s.solved && !s.review);
  // Dailies are exempt from the forfeit warning: leaving one just pauses it.
  const isDaily = useKakuro((s) => s.mode === 'daily');
  useEffect(() => {
    setLeaveGuard(inProgress ? { warn: !isDaily, onLeave: abandon } : null);
    return () => setLeaveGuard(null);
  }, [inProgress, isDaily, abandon]);

  useEffect(() => {
    if (screen === 'stats') {
      setBreadcrumbTrail([
        { label: 'Kakuro', onClick: () => navigate('home') },
        { label: 'Stats' },
      ]);
    } else if (screen === 'play') {
      setBreadcrumbTrail([{ label: 'Kakuro', onClick: () => requestLeave(abandon) }, { label: 'Play' }]);
    } else {
      setBreadcrumbTrail([{ label: 'Kakuro' }]);
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
    <div className="app kk-app">
      {screen === 'home' && <Home />}
      {screen === 'play' && <Play />}
      {screen === 'stats' && <StatsView />}
    </div>
  );
}
