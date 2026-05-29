import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface ScheduleAssignment {
  id: string;
  slot_number: number;
  events: {
    nama_event: string;
    tanggal_tugas: string;
    perayaan?: string;
    tipe_event: string;
  } | null;
}

export function useSchedule(userId?: string) {
  const [data,    setData]    = useState<ScheduleAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data: rows } = await supabase
      .from('assignments')
      .select('id, slot_number, events(nama_event, tanggal_tugas, perayaan, tipe_event)')
      .eq('user_id', userId)
      .limit(50);

    const filtered = (rows || [])
      .filter((d: any) =>
        d.events &&
        d.events.tipe_event !== 'Misa_Harian' &&
        d.events.tanggal_tugas >= today
      )
      .sort((a: any, b: any) => a.events.tanggal_tugas.localeCompare(b.events.tanggal_tugas))
      .slice(0, 6);
    setData(filtered as ScheduleAssignment[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, refetch: load };
}
