import { useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { setBreadcrumbTrail } from '../../../shell/breadcrumbStore';
import { requestLeave, setLeaveGuard } from '../../../shell/leaveGuard';
import { Home } from './Home';
import { Play } from './Play';
import { StatsView } from './StatsView';
import { SettingsView } from './SettingsView';

export function App() {
  const ready = useGame((s) => s.ready);
  const screen = useGame((s) => s.screen);
  const theme = useGame((s) => s.settings.theme);
  const init = useGame((s) => s.init);
  const navigate = useGame((s) => s.navigate);
  const abandon = useGame((s) => s.abandon);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // While a puzzle is unfinished, leaving it (by any route) goes through the guard.
  const inProgress = useGame((s) => s.screen === 'play' && s.puzzle !== null && !s.solved && !s.review);
  // Dailies are exempt from the forfeit warning: leaving one just pauses it.
  const isDaily = useGame((s) => s.mode === 'daily');
  useEffect(() => {
    setLeaveGuard(inProgress ? { warn: !isDaily, onLeave: abandon } : null);
    return () => setLeaveGuard(null);
  }, [inProgress, isDaily, abandon]);

  useEffect(() => {
    if (screen === 'stats') {
      setBreadcrumbTrail([
        { label: 'Shikaku', onClick: () => navigate('home') },
        { label: 'Stats' },
      ]);
    } else if (screen === 'settings') {
      setBreadcrumbTrail([
        { label: 'Shikaku', onClick: () => navigate('home') },
        { label: 'Settings' },
      ]);
    } else if (screen === 'play') {
      setBreadcrumbTrail([
        { label: 'Shikaku', onClick: () => requestLeave(abandon) },
        { label: 'Play' },
      ]);
    } else {
      setBreadcrumbTrail([{ label: 'Shikaku' }]);
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
      {screen === 'settings' && <SettingsView />}
    </div>
  );
}
