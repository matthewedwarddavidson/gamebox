import { useEffect, useState } from 'react';
import { useShell } from './shellStore';
import { getGame, GAMES } from './registry';
import { onProviderChange } from './db';
import { useBreadcrumb } from './breadcrumbStore';
import { Hub } from './Hub';
import { Breadcrumb } from './Breadcrumb';
import { OverallStatsView } from './OverallStatsView';
import { LeaveDialog } from './LeaveDialog';
import { requestLeave } from './leaveGuard';

/**
 * Top-level router. With no active game it shows the hub; otherwise it renders
 * the active game's Root with a slim breadcrumb bar tracing the path back to
 * the hub.
 */
export function AppShell() {
  const activeGameId = useShell((s) => s.activeGameId);
  const view = useShell((s) => s.view);
  const goHome = useShell((s) => s.goHome);
  const trail = useBreadcrumb((s) => s.trail);
  const game = activeGameId ? getGame(activeGameId) : undefined;

  // Remount the active game when the storage backend swaps (sign-in / sign-out)
  // so it re-initialises its state from the newly-active provider.
  const [dataVersion, setDataVersion] = useState(0);
  useEffect(() => onProviderChange(() => setDataVersion((v) => v + 1)), []);

  if (!game) {
    if (view === 'stats') {
      return (
        <>
          <Breadcrumb trail={[{ label: 'Your stats' }]} onHome={goHome} />
          <OverallStatsView games={GAMES} />
        </>
      );
    }
    return <Hub games={GAMES} />;
  }

  const Root = game.Root;
  return (
    <>
      <Breadcrumb trail={trail} onHome={() => requestLeave(goHome)} />
      <Root key={dataVersion} />
      <LeaveDialog />
    </>
  );
}
