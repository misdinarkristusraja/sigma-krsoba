import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sigma_theme');
      return stored === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('sigma_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('sigma_theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-brand-800 dark:bg-amber-500 text-white dark:text-slate-950 shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 border-2 border-white/20 flex items-center justify-center"
      title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
      aria-label="Toggle Mode Gelap/Terang"
    >
      {isDark ? (
        <Sun size={22} className="text-slate-950 font-bold" />
      ) : (
        <Moon size={22} className="text-white" />
      )}
    </button>
  );
}
