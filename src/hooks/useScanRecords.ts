import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ScanRecord } from '@/types';

interface UseScanRecordsOptions {
  userId?: string;
  limit?: number;
  page?: number;
}

export function useScanRecords({ userId, limit = 20, page = 0 }: UseScanRecordsOptions = {}) {
  const [data,    setData]    = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total,   setTotal]   = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const from = page * limit;
    const to   = from + limit - 1;

    let q = supabase
      .from('scan_records')
      .select(`
        id, scan_type, is_walk_in, timestamp, is_anomaly,
        user:user_id(nickname, nama_panggilan),
        scanner:scanner_user_id(nickname, nama_panggilan),
        event:event_id(nama_event, tanggal_tugas)
      `, { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(from, to);

    if (userId) q = q.eq('user_id', userId);

    const { data: rows, count, error } = await q;
    if (!error) {
      setData((rows as any[]) || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [userId, limit, page]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, total, refetch: load };
}
