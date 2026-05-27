import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLiturgiMinggu as getStaticLiturgi, getLiturgiByMonth } from '@/lib/liturgiData2026';
import { getWeekends } from '@/lib/utils';
import toast from 'react-hot-toast';

const PETUGAS_PER_SLOT = 8;

export function useWeeklySchedule() {
  const [events, setEvents] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const padM = String(month).padStart(2, '0');
    const start = `${year}-${padM}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${padM}-${String(lastDay).padStart(2, '0')}`;
    
    const { data, error } = await supabase
      .from('events')
      .select(`
        id, nama_event, tipe_event, tanggal_tugas, tanggal_latihan, latihan_hari_alt,
        perayaan, warna_liturgi, jumlah_misa, jumlah_petugas, tanpa_latihan,
        status_event, is_draft, published_at, draft_note, is_misa_besar, latihan_times,
        event_pics(id, slot, nama, hp, urutan),
        event_pelatih(id, nama, urutan),
        event_latihan(id, tanggal, jam, lokasi, catatan),
        assignments(id, slot_number, position, user_id,
          users(nickname, nama_panggilan, nama_lengkap, pendidikan, lingkungan))
      `)
      .gte('tanggal_tugas', start)
      .lte('tanggal_tugas', end)
      .not('tipe_event', 'eq', 'Misa_Harian')
      .order('tanggal_tugas');

    if (error) toast.error('Gagal load: ' + error.message);
    setEvents(data || []);
    setLoading(false);
  }, [month, year]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  return {
    events, month, setMonth, year, setYear, loading, generating, loadEvents, setGenerating
  };
}
