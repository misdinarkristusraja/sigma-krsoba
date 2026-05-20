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
        id, nama_event, tipe_event, tanggal_tugas, tanggal_latihan,
        perayaan, warna_liturgi, jumlah_misa, status_event, is_draft,
        published_at, draft_note, is_misa_besar,
        pic_slot_1a, pic_hp_slot_1a, pic_slot_1b, pic_hp_slot_1b,
        pelatih_slot_1, pelatih_slot_2, pelatih_slot_3,
        pic_slot_2a, pic_hp_slot_2a, pic_slot_2b, pic_hp_slot_2b,
        pic_slot_3a, pic_hp_slot_3a, pic_slot_3b, pic_hp_slot_3b,
        pic_slot_4a, pic_hp_slot_4a, pic_slot_4b, pic_hp_slot_4b,
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
