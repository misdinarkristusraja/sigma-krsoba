import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { SwapRequest } from '@/types';
import { filterAndSortBoardRequests, todayStr } from '@/lib/swapUtils';

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
          assignment:assignment_id(slot_number, events(nama_event, tanggal_tugas, perayaan, tipe_event))
        `)
        .order('created_at', { ascending: false });

      if (mode === 'board') {
        q = q.eq('is_penawaran', true).eq('status', 'Offered');
        if (userId) {
          q = q.neq('requester_id', userId);
        }
      } else if (mode === 'my' && userId) {
        q = q.eq('requester_id', userId);
      }

      const { data: rows, error: err } = await q;
      if (err) throw err;

      if (mode === 'board') {
        const sortedBoard = filterAndSortBoardRequests(rows as any[], todayStr(), userId);
        setData(sortedBoard.slice(0, limit));
      } else {
        setData(((rows as any[]) || []).slice(0, limit));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [mode, userId, limit]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refetch: load };
}
