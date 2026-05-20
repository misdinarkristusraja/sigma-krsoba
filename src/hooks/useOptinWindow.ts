import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useOptinWindow() {
  const [isOpen,  setIsOpen]  = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const [{ data: s }, { data: e }] = await Promise.all([
          supabase.from('system_config').select('value').eq('key', 'window_optin_harian_start').maybeSingle(),
          supabase.from('system_config').select('value').eq('key', 'window_optin_harian_end').maybeSingle(),
        ]);
        const day   = new Date().getDate();
        const start = parseInt((s as any)?.value || '10');
        const end   = parseInt((e as any)?.value || '20');
        setIsOpen(day >= start && day <= end);
      } catch {
        setIsOpen(false);
      } finally {
        setLoading(false);
      }
    }
    check();
  }, []);

  return { isOpen, loading };
}
