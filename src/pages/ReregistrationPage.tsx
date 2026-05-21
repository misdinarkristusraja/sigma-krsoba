import React, { useState, useEffect } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { formatHP, PENDIDIKAN_OPTIONS } from '../lib/utils';
import { LINGKUNGAN_LIST, getWilayah } from '../lib/wilayah';
import { useSekolahSearch } from '../hooks/useSekolahSearch';
import { RefreshCw, CheckCircle, Lock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReregistrationPage() {
  const { profile, fetchProfile } = useAuth();
  const [form,      setForm]      = useState<Record<string,any>>({});
  const [loading,   setLoading]   = useState(false);
  const [sekolahQuery,   setSekolahQuery]   = useState('');
  const [showSekolah,    setShowSekolah]    = useState(false);
  const [selectedNpsn,   setSelectedNpsn]   = useState('');
  const { results: sekolahResults, loading: sekolahLoading, search: searchSekolah, clear: clearSekolah } = useSekolahSearch();
  const [submitted, setSubmitted] = useState(false);
  const [alreadyRe, setAlreadyRe] = useState(false);
  const [openDate,  setOpenDate]  = useState<Date | null>(null);
  const [closeDate, setCloseDate] = useState<Date | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [reregTahun,   setReregTahun]   = useState<number | null>(null);

  const now   = new Date();
  const isOpen = openDate && closeDate
    ? now >= openDate && now <= closeDate
    : false;

  // User yang mendaftar manual (registration_year = rereg_tahun) tidak perlu daftar ulang
  // Data lama/import punya registration_year = null → wajib rereg
  const isNewMember = reregTahun !== null && (profile as any)?.registration_year === reregTahun;

  const daysUntilOpen = (!isOpen && openDate)
    ? Math.max(0, Math.ceil((openDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  useEffect(() => {
    supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['rereg_open_date', 'rereg_close_date', 'rereg_tahun'])
      .then(({ data }: any) => {
        if (!data) return;
        const map: Record<string, string> = {};
        data.forEach((r: any) => { map[r.key] = r.value; });
        if (map.rereg_open_date)  setOpenDate(new Date(map.rereg_open_date));
        if (map.rereg_close_date) setCloseDate(new Date(map.rereg_close_date + 'T23:59:59'));
        if (map.rereg_tahun)      setReregTahun(parseInt(map.rereg_tahun));
        setConfigLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (profile) {
      setForm({
        nama_lengkap:  profile.nama_lengkap  || '',
        nama_panggilan:profile.nama_panggilan || '',
        pendidikan:    profile.pendidikan     || '',
        sekolah:       profile.sekolah        || '',
        is_tarakanita: (profile as any).is_tarakanita || false,
        lingkungan:    profile.lingkungan     || '',
        alamat:        profile.alamat         || '',
        hp_anak:       profile.hp_anak        || '',
        hp_ortu:       profile.hp_ortu        || '',
        nama_ayah:     profile.nama_ayah      || '',
        nama_ibu:      profile.nama_ibu       || '',
        alasan_masuk:  profile.alasan_masuk   || '',
        sampai_kapan:  profile.sampai_kapan   || '',
      });
      setSekolahQuery((profile as any).sekolah || '');
      // Cek apakah sudah daftar ulang tahun ini
      checkAlreadyReregistered();
    }
  }, [profile]);

  async function checkAlreadyReregistered() {
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from('reregistrations')
      .select('id')
      .eq('user_id', profile!.id)
      .eq('tahun', year)
      .maybeSingle();
    if (data) setAlreadyRe(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOpen) { toast.error('Daftar ulang belum dibuka'); return; }
    if (alreadyRe) { toast.error('Kamu sudah daftar ulang tahun ini'); return; }
    if (!form.pendidikan || !form.lingkungan) {
      toast.error('Pendidikan dan lingkungan wajib diisi'); return;
    }

    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const isTarakanita = form.is_tarakanita === true;

      // Update data profil anggota
      const { error: updateErr } = await supabase.from('users').update({
        nama_lengkap:   form.nama_lengkap,
        nama_panggilan: form.nama_panggilan,
        pendidikan:     form.pendidikan,
        sekolah:        form.sekolah,
        is_tarakanita:  isTarakanita,
        lingkungan:     form.lingkungan,
        alamat:         form.alamat,
        hp_anak:        form.hp_anak ? formatHP(form.hp_anak) : null,
        hp_ortu:        form.hp_ortu ? formatHP(form.hp_ortu) : null,
        nama_ayah:      form.nama_ayah,
        nama_ibu:       form.nama_ibu,
        alasan_masuk:   form.alasan_masuk,
        sampai_kapan:   form.sampai_kapan,
        updated_at:     new Date().toISOString(),
      }).eq('id', profile!.id);
      if (updateErr) throw updateErr;

      // Catat daftar ulang — data_snapshot bertipe JSONB, kirim object langsung
      const { error: reErr } = await supabase.from('reregistrations').insert({
        user_id:  profile!.id,
        tahun:    year,
        submitted_at: new Date().toISOString(),
        data_snapshot: form,
      });
      if (reErr) throw reErr;

      // Refresh profile
      await fetchProfile();
      setSubmitted(true);
      toast.success('Daftar ulang berhasil! Data kamu sudah diperbarui.');
    } catch (err: any) {
      toast.error('Gagal daftar ulang: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Anggota baru tahun rereg — tidak perlu daftar ulang
  if (isNewMember) {
    return (
      <div className="space-y-5">
        <h1 className="page-title">Daftar Ulang</h1>
        <div className="card text-center py-14">
          <CheckCircle size={48} className="mx-auto text-blue-400 mb-4" />
          <h2 className="font-bold text-xl text-gray-900">Kamu Tidak Perlu Daftar Ulang</h2>
          <p className="text-gray-500 text-sm mt-2">
            Anggota yang baru mendaftar pada tahun {reregTahun} tidak perlu melakukan daftar ulang.
          </p>
        </div>
      </div>
    );
  }

  // Belum dibuka
  if (!isOpen) {
    const openLabel = openDate
      ? openDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
    return (
      <div className="space-y-5">
        <h1 className="page-title">Daftar Ulang</h1>
        <div className="card text-center py-14">
          <Lock size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="font-bold text-xl text-gray-700">Daftar Ulang Belum Dibuka</h2>
          <p className="text-gray-500 text-sm mt-2">
            Daftar ulang akan dibuka pada <strong>{openLabel}</strong>.
          </p>
          {daysUntilOpen > 0 && (
            <p className="text-brand-800 font-bold text-2xl mt-4">{daysUntilOpen} hari lagi</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Pastikan kamu siap memperbarui data sekolah, nomor HP, dan informasi lainnya.
          </p>
        </div>
      </div>
    );
  }

  // Sudah daftar ulang
  if (alreadyRe || submitted) {
    return (
      <div className="space-y-5">
        <h1 className="page-title">Daftar Ulang</h1>
        <div className="card text-center py-14">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <h2 className="font-bold text-xl text-gray-900">Daftar Ulang Selesai</h2>
          <p className="text-gray-500 text-sm mt-2">
            Kamu sudah melakukan daftar ulang untuk tahun {new Date().getFullYear()}.
          </p>
          <p className="text-xs text-gray-400 mt-4">
            Jika ada perubahan data, hubungi Pengurus secara langsung.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <RefreshCw size={24} className="text-brand-800" /> Daftar Ulang
        </h1>
        <p className="page-subtitle">
          Perbarui data kamu untuk periode {openDate ? openDate.getFullYear() : new Date().getFullYear()}/{(openDate ? openDate.getFullYear() : new Date().getFullYear()) + 1}
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800">Tentang Daftar Ulang</p>
        <p className="text-xs text-blue-700 mt-1">
          Pastikan semua data sudah benar — terutama <strong>sekolah</strong>, <strong>nomor HP</strong>, dan <strong>pendidikan</strong>.
          Data ini akan digunakan untuk penjadwalan Misa Harian.
          {closeDate && (
            <> Daftar ulang ditutup pada <strong>{closeDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.</>
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
        {/* Kiri */}
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-700">Data Diri</h3>

          <div>
            <label className="label">Nama Lengkap *</label>
            <input className="input" value={form.nama_lengkap || ''} required
              onChange={e => setForm(f => ({...f, nama_lengkap: e.target.value}))} />
          </div>
          <div>
            <label className="label">Nama Panggilan *</label>
            <input className="input" value={form.nama_panggilan || ''} required
              onChange={e => setForm(f => ({...f, nama_panggilan: e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Pendidikan *</label>
              <select className="input" required value={form.pendidikan || ''}
                onChange={e => setForm(f => ({...f, pendidikan: e.target.value}))}>
                <option value="">— Pilih —</option>
                {PENDIDIKAN_OPTIONS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Lingkungan *</label>
              <select className="input" required value={form.lingkungan || ''}
                onChange={e => {
                  const ling = e.target.value;
                  setForm(f => ({ ...f, lingkungan: ling, wilayah: getWilayah(ling) }));
                }}>
                <option value="">— Pilih —</option>
                {LINGKUNGAN_LIST.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Sekolah</label>
            <div className="relative">
              <div className="relative">
                <input
                  className="input pr-8"
                  value={sekolahQuery}
                  onChange={e => {
                    const v = e.target.value;
                    setSekolahQuery(v);
                    setForm(f => ({ ...f, sekolah: v, is_tarakanita: false }));
                    setSelectedNpsn('');
                    if (v.length >= 2) { searchSekolah(v); setShowSekolah(true); }
                    else { clearSekolah(); setShowSekolah(false); }
                  }}
                  onBlur={() => setTimeout(() => setShowSekolah(false), 200)}
                  onFocus={() => sekolahResults.length > 0 && setShowSekolah(true)}
                  placeholder="Ketik nama sekolah..."
                  autoComplete="off"
                />
                {sekolahLoading && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                )}
              </div>
              {showSekolah && sekolahResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                  {sekolahResults.map(s => (
                    <button
                      key={s.npsn}
                      type="button"
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-start gap-2"
                      onMouseDown={() => {
                        setSekolahQuery(s.sekolah);
                        setSelectedNpsn(s.npsn);
                        setForm(f => ({ ...f, sekolah: s.sekolah, is_tarakanita: s.isTarakanitaSoloBaru }));
                        setShowSekolah(false);
                        clearSekolah();
                      }}
                    >
                      <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        s.bentuk === 'SD'  ? 'bg-green-100 text-green-700'  :
                        s.bentuk === 'SMP' ? 'bg-blue-100 text-blue-700'   :
                        s.bentuk === 'SMA' ? 'bg-purple-100 text-purple-700':
                                             'bg-orange-100 text-orange-700'
                      }`}>{s.bentuk}</span>
                      <span className="flex-1 min-w-0">
                        <span className="font-medium text-gray-800">{s.sekolah}</span>
                        {s.isTarakanitaSoloBaru && (
                          <span className="ml-1.5 text-[10px] bg-brand-100 text-brand-800 font-semibold px-1.5 py-0.5 rounded">Tarakanita ✓</span>
                        )}
                        <span className="block text-xs text-gray-400">{s.kabupaten_kota}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {selectedNpsn && form.is_tarakanita && (
                <p className="text-xs text-brand-800 font-semibold mt-1">Status Tarakanita otomatis ✓</p>
              )}
            </div>
          </div>
          <div>
            <label className="label">Alamat Rumah</label>
            <textarea className="input h-20 resize-none" value={form.alamat || ''}
              onChange={e => setForm(f => ({...f, alamat: e.target.value}))} />
          </div>
        </div>

        {/* Kanan */}
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-700">Kontak</h3>
            <div>
              <label className="label">No. HP Anak</label>
              <input className="input" value={form.hp_anak || ''} placeholder="08xx..."
                onChange={e => setForm(f => ({...f, hp_anak: e.target.value}))} />
            </div>
            <div>
              <label className="label">No. HP Orang Tua *</label>
              <input className="input" required value={form.hp_ortu || ''} placeholder="08xx..."
                onChange={e => setForm(f => ({...f, hp_ortu: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nama Ayah</label>
                <input className="input" value={form.nama_ayah || ''}
                  onChange={e => setForm(f => ({...f, nama_ayah: e.target.value}))} />
              </div>
              <div>
                <label className="label">Nama Ibu</label>
                <input className="input" value={form.nama_ibu || ''}
                  onChange={e => setForm(f => ({...f, nama_ibu: e.target.value}))} />
              </div>
            </div>
          </div>

          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-700">Komitmen</h3>
            <div>
              <label className="label">Rencana Sampai Kapan</label>
              <input className="input" value={form.sampai_kapan || ''}
                onChange={e => setForm(f => ({...f, sampai_kapan: e.target.value}))}
                placeholder="Contoh: Sampai lulus SMA 2027" />
            </div>
            <div>
              <label className="label">Alasan / Motivasi</label>
              <textarea className="input h-24 resize-none" value={form.alasan_masuk || ''}
                onChange={e => setForm(f => ({...f, alasan_masuk: e.target.value}))} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full btn-lg gap-2">
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
              : <><RefreshCw size={18} /> Konfirmasi Daftar Ulang</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
