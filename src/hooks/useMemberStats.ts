import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface WeeklyRecord {
  poin: number;
  kondisi: string;
  week_start: string;
}

interface MemberStats {
  totalPoin: number;
  thisWeek: WeeklyRecord | null;
  history: WeeklyRecord[];
}

export function useMemberStats(userId?: string) {
  const [data,    setData]    = useState<MemberStats>({ totalPoin: 0, thisWeek: null, history: [] });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [{ data: allRows }, { data: recentRows }, { data: bonusRows }] = await Promise.all([
      supabase.from('rekap_poin_mingguan').select('poin').eq('user_id', userId),
      supabase
        .from('rekap_poin_mingguan')
        .select('poin, kondisi, week_start')
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(8),
      supabase.from('poin_bonus').select('poin').eq('user_id', userId),
    ]);

    if (recentRows) {
      const weeklyTotal = (allRows   || []).reduce((s: number, r: any) => s + (r.poin || 0), 0);
      const bonusTotal  = (bonusRows || []).reduce((s: number, r: any) => s + (r.poin || 0), 0);
      setData({ totalPoin: weeklyTotal + bonusTotal, thisWeek: recentRows[0] || null, history: recentRows });
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, refetch: load };
}
