import { useState, useEffect } from 'react';

export type TensionLevel = 'calm' | 'rising' | 'critical' | 'climax' | 'reveal';

export interface CountdownState {
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isUnder5Min: boolean;
  isUnder1Min: boolean;
  isUnder10Sec: boolean;
  isExpired: boolean;
  tensionLevel: TensionLevel;
}

export function calculateCountdownState(diffInSeconds: number): CountdownState {
  const safeDiff = Math.max(0, Math.floor(diffInSeconds));
  const days = Math.floor(safeDiff / (3600 * 24));
  const hours = Math.floor((safeDiff % (3600 * 24)) / 3600);
  const minutes = Math.floor((safeDiff % 3600) / 60);
  const seconds = safeDiff % 60;

  const isExpired = safeDiff <= 0;
  const isUnder10Sec = safeDiff > 0 && safeDiff <= 10;
  const isUnder1Min = safeDiff > 0 && safeDiff <= 60;
  const isUnder5Min = safeDiff > 0 && safeDiff <= 300;

  let tensionLevel: TensionLevel = 'calm';
  if (isExpired) {
    tensionLevel = 'reveal';
  } else if (isUnder10Sec) {
    tensionLevel = 'climax';
  } else if (isUnder1Min) {
    tensionLevel = 'critical';
  } else if (isUnder5Min) {
    tensionLevel = 'rising';
  }

  return {
    totalSeconds: safeDiff,
    days,
    hours,
    minutes,
    seconds,
    isUnder5Min,
    isUnder1Min,
    isUnder10Sec,
    isExpired,
    tensionLevel,
  };
}

export function useNatalCountdown(targetIsoDate: string, bypassCountdown: boolean = false) {
  const [state, setState] = useState<CountdownState>(() => {
    if (bypassCountdown) return calculateCountdownState(0);
    const targetMs = new Date(targetIsoDate).getTime();
    if (isNaN(targetMs)) return calculateCountdownState(0);
    return calculateCountdownState((targetMs - Date.now()) / 1000);
  });

  useEffect(() => {
    if (bypassCountdown) {
      setState(calculateCountdownState(0));
      return;
    }

    const updateTimer = () => {
      const targetMs = new Date(targetIsoDate).getTime();
      if (isNaN(targetMs)) {
        setState(calculateCountdownState(0));
        return;
      }
      const diffSec = (targetMs - Date.now()) / 1000;
      setState(calculateCountdownState(diffSec));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetIsoDate, bypassCountdown]);

  return state;
}
