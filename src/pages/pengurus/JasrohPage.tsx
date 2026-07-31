import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../../lib/supabase';
const supabase = supabaseTyped as any;
import { HeartHandshake, Plus, Calendar, MapPin, User, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export default function JasrohPage() {
  const [loading, setLoading] = useState(true);
  const [acaraList, setAcaraList] = useState<any[]>([]);

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-gray-900 text-base">Divisi Jasmani &amp; Rohani (Jasroh)</h2>
          <p className="text-xs text-gray-500">Perencanaan acara keakraban, retret, rekoleksi, dan kegiatan spiritual.</p>
        </div>
      </div>

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
    </div>
  );
}
