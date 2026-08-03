import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../../lib/supabase';
const supabase = supabaseTyped as any;
import { HeartHandshake, PartyPopper, ClipboardCheck, Calendar, MapPin, User, Plus } from 'lucide-react';
import AcaraPage from '../AcaraPage';
import AttendancePage from '../AttendancePage';
import toast from 'react-hot-toast';

export default function JasrohPage() {
  const [tab, setTab] = useState<'proker' | 'acara' | 'presensi'>('proker');
  const [loading, setLoading] = useState(true);
  const [acaraList, setAcaraList] = useState<any[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'acara' || tabParam === 'presensi') {
      setTab(tabParam);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('acara')
        .select('*')
        .order('tanggal', { ascending: false });
      setAcaraList(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-gray-900 text-base">Divisi Jasmani &amp; Rohani (Jasroh Hub)</h2>
          <p className="text-xs text-gray-500">Pusat Manajemen Kegiatan Jasroh, Retret, Acara Khusus, dan Presensi Acara.</p>
        </div>

        {/* Sub-Tab Navigation Switcher */}
        <div className="flex gap-1.5 bg-gray-100 p-1.5 rounded-xl flex-wrap">
          <button
            onClick={() => setTab('proker')}
            className={`btn-sm gap-1.5 ${tab === 'proker' ? 'bg-white dark:bg-slate-900 text-purple-900 dark:text-purple-300 shadow-sm font-bold' : 'text-gray-600 dark:text-slate-400'}`}
          >
            <HeartHandshake size={15} /> Program Kerja &amp; Retret
          </button>
          <button
            onClick={() => setTab('acara')}
            className={`btn-sm gap-1.5 ${tab === 'acara' ? 'bg-white dark:bg-slate-900 text-purple-900 dark:text-purple-300 shadow-sm font-bold' : 'text-gray-600 dark:text-slate-400'}`}
          >
            <PartyPopper size={15} /> Manajemen Acara
          </button>
          <button
            onClick={() => setTab('presensi')}
            className={`btn-sm gap-1.5 ${tab === 'presensi' ? 'bg-white dark:bg-slate-900 text-purple-900 dark:text-purple-300 shadow-sm font-bold' : 'text-gray-600 dark:text-slate-400'}`}
          >
            <ClipboardCheck size={15} /> Presensi Acara
          </button>
        </div>
      </div>

      {tab === 'proker' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {acaraList.length === 0 ? (
            <div className="col-span-2 card text-center py-10 text-gray-400">
              <HeartHandshake size={40} className="mx-auto mb-2 opacity-30" />
              <p>Belum ada kegiatan Jasroh terdaftar.</p>
            </div>
          ) : (
            acaraList.map((a) => (
              <div key={a.id} className="card p-5 border border-gray-100 space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-gray-900 text-base">{a.nama_acara}</h3>
                  <span className="badge-purple text-xs">{a.tipe || 'Kegiatan'}</span>
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  <p className="flex items-center gap-1.5"><Calendar size={13} /> {a.tanggal}</p>
                  {a.lokasi && <p className="flex items-center gap-1.5"><MapPin size={13} /> {a.lokasi}</p>}
                  {a.pj && <p className="flex items-center gap-1.5"><User size={13} /> PJ: <strong>{a.pj}</strong></p>}
                </div>
                {a.deskripsi && (
                  <p className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded-lg italic">"{a.deskripsi}"</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'acara' && (
        <div className="space-y-4">
          <AcaraPage />
        </div>
      )}

      {tab === 'presensi' && (
        <div className="space-y-4">
          <AttendancePage />
        </div>
      )}
    </div>
  );
}
