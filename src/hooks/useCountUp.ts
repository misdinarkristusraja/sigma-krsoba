import { useState, useEffect, useRef } from 'react';

export function useCountUp(target: number, duration = 900, delay = 0): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }

    const timer = setTimeout(() => {
      let startTime: number | null = null;

      function step(ts: number) {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) rafRef.current = requestAnimationFrame(step);
        else setValue(target);
      }

      rafRef.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);

  return value;
}
