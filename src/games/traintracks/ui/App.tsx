import { useEffect } from 'react';
import { useTrainTracks } from '../store/gameStore';
import { setBreadcrumbTrail } from '../../../shell/breadcrumbStore';
import { Home } from './Home';
import { Play } from './Play';
import { StatsView } from './StatsView';
import './styles.css';

export function TrainTracksApp() {
  const ready = useTrainTracks((s) => s.ready);
  const screen = useTrainTracks((s) => s.screen);
  const theme = useTrainTracks((s) => s.theme);
  const init = useTrainTracks((s) => s.init);
  const navigate = useTrainTracks((s) => s.navigate);
  const abandon = useTrainTracks((s) => s.abandon);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (screen === 'stats') {
      setBreadcrumbTrail([
        { label: 'Train Tracks', onClick: () => navigate('home') },
        { label: 'Stats' },
      ]);
    } else if (screen === 'play') {
      setBreadcrumbTrail([{ label: 'Train Tracks', onClick: abandon }, { label: 'Play' }]);
    } else {
      setBreadcrumbTrail([{ label: 'Train Tracks' }]);
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
