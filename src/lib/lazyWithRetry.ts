import { lazy, ComponentType } from 'react';

/**
 * Robust lazy import wrapper that catches Vercel / Vite chunk loading errors
 * (e.g. "Failed to fetch dynamically imported module") when a new deployment invalidates old JS files.
 * Automatically reloads the window once to fetch the latest deployment assets.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const pageHasReloaded = sessionStorage.getItem('chunk_reload_retry') === 'true';

    try {
      const component = await componentImport();
      sessionStorage.removeItem('chunk_reload_retry');
      return component;
    } catch (error: any) {
      const msg = error?.message || '';
      const isChunkError =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Loading chunk');

      if (isChunkError && !pageHasReloaded) {
        sessionStorage.setItem('chunk_reload_retry', 'true');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
