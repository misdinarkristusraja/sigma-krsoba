import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Event } from '@/types';

export function useEvents(limit = 3) {
  const [data,    setData]    = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('events')
      .select('id, nama_event, tipe_event, tanggal_tugas, tanggal_latihan, perayaan, warna_liturgi, status_event')
      .gte('tanggal_tugas', today)
      .in('status_event', ['Akan_Datang', 'Berlangsung'])
      .order('tanggal_tugas')
      .limit(limit)
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message);
        else setData((rows as Event[]) || []);
        setLoading(false);
      });
  }, [limit]);

  return { data, loading, error };
}
