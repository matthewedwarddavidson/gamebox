import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelLeave, confirmLeave, requestLeave, setLeaveGuard, useLeave } from './leaveGuard';

describe('leave guard', () => {
  afterEach(() => setLeaveGuard(null));

  it('leaves straight away when nothing is in progress', () => {
    const action = vi.fn();
    requestLeave(action);
    expect(action).toHaveBeenCalledOnce();
    expect(useLeave.getState().pending).toBeNull();
  });

  it('waits for confirmation, then forfeits and leaves', () => {
    const onLeave = vi.fn();
    const action = vi.fn();
    setLeaveGuard({ warn: true, onLeave });
    requestLeave(action);
    expect(action).not.toHaveBeenCalled();
    expect(useLeave.getState().pending).not.toBeNull();

    confirmLeave();
    expect(onLeave).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();
    expect(useLeave.getState().pending).toBeNull();
  });

  it('keeps playing when the player cancels', () => {
    const onLeave = vi.fn();
    const action = vi.fn();
    setLeaveGuard({ warn: true, onLeave });
    requestLeave(action);
    cancelLeave();
    expect(onLeave).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    expect(useLeave.getState().pending).toBeNull();
  });

  it('drops a pending question if the guard is cleared', () => {
    setLeaveGuard({ warn: true, onLeave: vi.fn() });
    requestLeave(vi.fn());
    setLeaveGuard(null);
    expect(useLeave.getState().pending).toBeNull();
  });

  it('pauses without asking when the guard does not warn', () => {
    const onLeave = vi.fn();
    const action = vi.fn();
    setLeaveGuard({ warn: false, onLeave });
    requestLeave(action);
    expect(onLeave).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();
    expect(useLeave.getState().pending).toBeNull();
  });
});
