import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../../contexts/AuthContext';
import { Video, Plus, Calendar, ExternalLink, CheckCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MultimediaPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contentList, setContentList] = useState<any[]>([]);

  // Form modal
  const [showModal, setShowModal] = useState(false);
  const [judul, setJudul] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'Draft' | 'Desain' | 'Revisi' | 'Published'>('Draft');
  const [linkPreview, setLinkPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('pengurus_multimedia_content')
        .select('*, pj:pj_id(nama_panggilan)')
        .order('target_date', { ascending: true });
      setContentList(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleAddContent(e: React.FormEvent) {
    e.preventDefault();
    if (!judul) { toast.error('Isi judul konten'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('pengurus_multimedia_content').insert({
      judul,
      platform,
      target_date: targetDate,
      status,
      link_preview: linkPreview,
      pj_id: profile?.id
    });
    setSubmitting(false);

    if (error) { toast.error(error.message); return; }
    toast.success('Konten baru berhasil dijadwalkan');
    setShowModal(false);
    setJudul(''); setLinkPreview('');
    loadData();
  }

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from('pengurus_multimedia_content')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Status konten diperbarui');
    loadData();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-gray-900 text-base">Divisi Multimedia &amp; Konten</h2>
          <p className="text-xs text-gray-500">Pipeline perencanaan desain, publikasi Instagram / TikTok / YouTube.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary btn-sm gap-1">
          <Plus size={14} /> Tambah Jadwal Konten
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contentList.length === 0 ? (
          <div className="col-span-2 card text-center py-10 text-gray-400">
            <Video size={40} className="mx-auto mb-2 opacity-30" />
            <p>Belum ada rencana konten multimedia.</p>
          </div>
        ) : (
          contentList.map((c) => (
            <div key={c.id} className="card p-5 border border-gray-100 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    {c.platform}
                  </span>
                  <h3 className="font-bold text-gray-900 text-base mt-1">{c.judul}</h3>
                </div>
                <select
                  className="input text-xs py-0.5 w-28"
                  value={c.status}
                  onChange={(e) => updateStatus(c.id, e.target.value)}
                >
                  <option value="Draft">Draft</option>
                  <option value="Desain">Desain</option>
                  <option value="Revisi">Revisi</option>
                  <option value="Published">Published</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1"><Calendar size={13} /> Target: {c.target_date}</span>
                <span>PJ: <strong>{c.pj?.nama_panggilan || 'Multimedia'}</strong></span>
              </div>

              {c.link_preview && (
                <a href={c.link_preview} target="_blank" rel="noreferrer" className="text-xs text-brand-800 hover:underline flex items-center gap-1">
                  <ExternalLink size={12} /> Pratinjau Desain / Content Drive
                </a>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleAddContent} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-gray-900">Tambah Konten Multimedia</h3>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Judul / Topic Konten</label>
              <input className="input" placeholder="misal: Highlights Misa Pekan Suci" value={judul} onChange={e => setJudul(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Platform</label>
                <select className="input" value={platform} onChange={e => setPlatform(e.target.value)}>
                  <option value="Instagram">Instagram (Feeds/Reels)</option>
                  <option value="TikTok">TikTok</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Pengumuman Paroki">Pengumuman Paroki</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Target Publish</label>
                <input type="date" className="input" value={targetDate} onChange={e => setTargetDate(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Status Awal</label>
              <select className="input" value={status} onChange={e => setStatus(e.target.value as any)}>
                <option value="Draft">Draft (Ide)</option>
                <option value="Desain">Proses Desain / Edit</option>
                <option value="Revisi">Revisi</option>
                <option value="Published">Siap Publish</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Link Preview / Drive (Opsional)</label>
              <input className="input" placeholder="https://canva.com/..." value={linkPreview} onChange={e => setLinkPreview(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Batal</button>
              <button type="submit" disabled={submitting} className="btn-primary">Jadwalkan</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
