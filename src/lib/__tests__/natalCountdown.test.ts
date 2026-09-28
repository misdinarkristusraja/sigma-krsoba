import { describe, it, expect } from 'vitest';
import { calculateCountdownState } from '../../hooks/useNatalCountdown';

describe('calculateCountdownState', () => {
  it('detects normal state (> 5 minutes)', () => {
    const state = calculateCountdownState(600); // 10 minutes
    expect(state.isUnder5Min).toBe(false);
    expect(state.tensionLevel).toBe('calm');
    expect(state.isExpired).toBe(false);
  });

  it('detects tension level 1 (< 5 minutes)', () => {
    const state = calculateCountdownState(240); // 4 minutes
    expect(state.isUnder5Min).toBe(true);
    expect(state.tensionLevel).toBe('rising');
  });

  it('detects tension level 2 (< 1 minute)', () => {
    const state = calculateCountdownState(45); // 45 seconds
    expect(state.isUnder1Min).toBe(true);
    expect(state.tensionLevel).toBe('critical');
  });

  it('detects climax level (< 10 seconds)', () => {
    const state = calculateCountdownState(5); // 5 seconds
    expect(state.isUnder10Sec).toBe(true);
    expect(state.tensionLevel).toBe('climax');
  });

  it('detects expired (0 seconds)', () => {
    const state = calculateCountdownState(0);
    expect(state.isExpired).toBe(true);
    expect(state.tensionLevel).toBe('reveal');
  });
});
