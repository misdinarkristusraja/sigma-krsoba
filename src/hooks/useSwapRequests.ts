import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { SwapRequest } from '@/types';

interface UseSwapRequestsOptions {
  mode?: 'board' | 'my';
  userId?: string;
  limit?: number;
}

export function useSwapRequests({ mode = 'board', userId, limit = 10 }: UseSwapRequestsOptions = {}) {
  const [data,    setData]    = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('swap_requests')
        .select(`
          id, status, alasan, is_penawaran, created_at, expires_at,
          requester:requester_id(nama_panggilan, lingkungan, nickname),
          pengganti:pengganti_id(nama_panggilan),
          assignment:assignment_id(slot_number, events(nama_event, tanggal_tugas))
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (mode === 'board') {
        q = q.eq('is_penawaran', true).eq('status', 'Offered');
      } else if (mode === 'my' && userId) {
        q = q.eq('requester_id', userId);
      }

      const { data: rows, error: err } = await q;
      if (err) throw err;
      setData((rows as any[]) || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [mode, userId, limit]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refetch: load };
}
