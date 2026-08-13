import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { formatDate, buildWALink, PENDIDIKAN_OPTIONS, formatHP, STATUS_LABELS, ROLE_LABELS } from '../lib/utils';
import { LINGKUNGAN_LIST, getWilayah } from '../lib/wilayah';
import {
  ArrowLeft, CreditCard, BarChart2, Phone, Edit2, Save, X,
  ShieldAlert, ShieldCheck, KeyRound, MessageCircle, FileText, Download, ExternalLink, CalendarDays,
} from 'lucide-react';
import toast from 'react-hot-toast';
const ROLES = ['Administrator','Pengurus','Pelatih','Misdinar_Aktif','Misdinar_Retired'];

// Generate password acak 8 karakter (huruf + angka, mudah dibaca)
function genPassword(len = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // tanpa 0/o/i/l agar tidak rancu
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Salam berdasarkan jam WIB
function getSalam() {
  const h = new Date(new Date().getTime() + 7*3600*1000).getUTCHours();
  if (h >= 5  && h < 11) return 'pagi';
  if (h >= 11 && h < 15) return 'siang';
  if (h >= 15 && h < 19) return 'sore';
  return 'malam';
}

// Build WA message template
function buildWAMessage(member: any, newPassword: any) {
  const salam = getSalam();
  const isOrtu = ['Misdinar_Aktif','Misdinar_Retired'].includes(member.role);
  const sapaan = isOrtu ? 'bapak/ibu' : 'teman-teman';
  return encodeURIComponent(
`Selamat ${salam} ${sapaan} semua. Berikut adalah username dan password yang akan digunakan untuk sistem penjadwalan SIGMA V. 2.0

username: ${member.nickname}
password: ${newPassword}
link sigma: sigma-krsoba.vercel.app

Mohon login menggunakan akun tersebut, kemudian langsung mengganti password sesuai dengan password yang mudah anda ingat namun kuat. Mohon gunakan dengan bijak dan penuh tanggung jawab. Mengenai regulasi dan tutorial akan dikirimkan via PDF/Video nantinya. Terimakasih, Berkah Dalem`
  );
}

// ── Dokumen Tab ──────────────────────────────────────────────────
function DocTab({ member, isPengurus }: { member: any; isPengurus: boolean }) {
  const [loadingUrl, setLoadingUrl] = React.useState<string | null>(null);

  async function openDoc(storagePath: string, filename: string) {
    setLoadingUrl(storagePath);
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(storagePath, 60 * 5); // 5-minute signed URL
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      toast.error('Gagal membuka dokumen: ' + err.message);
    } finally {
      setLoadingUrl(null);
    }
  }

  const docs = [
    {
      key: 'surat_pernyataan_url',
      label: 'Surat Pernyataan Orang Tua',
      icon: FileText,
      color: 'text-brand-800',
      bg: 'bg-brand-50',
    },
  ];

  const hasAny = docs.some(d => !!member[d.key]);

  if (!isPengurus) {
    return (
      <div className="card text-center py-10 text-gray-400">
        <FileText size={36} className="mx-auto mb-2 opacity-30" />
        <p>Hanya Pengurus yang dapat mengakses dokumen anggota.</p>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <h3 className="font-semibold text-gray-700 flex items-center gap-2">
        <FileText size={16} className="text-brand-800" /> Dokumen Anggota
      </h3>

      {!hasAny && (
        <div className="text-center py-8 text-gray-400">
          <FileText size={40} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">Belum ada dokumen yang diunggah.</p>
        </div>
      )}

      <div className="space-y-3">
        {docs.map(doc => {
          const path: string | null = member[doc.key] ?? null;
          return (
            <div
              key={doc.key}
              className={`flex items-center gap-3 p-4 rounded-xl border ${path ? 'border-gray-200 bg-white' : 'border-dashed border-gray-200 bg-gray-50 opacity-60'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${doc.bg}`}>
                <doc.icon size={18} className={doc.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{doc.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {path ? path.split('/').pop() : 'Belum diunggah'}
                </p>
              </div>
              {path && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openDoc(path, doc.label)}
                    disabled={loadingUrl === path}
                    className="btn-outline btn-sm gap-1 text-xs"
                    title="Buka / Unduh"
                  >
                    {loadingUrl === path ? (
                      <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ExternalLink size={13} />
                    )}
                    Buka
                  </button>
                  <a
                    href="#"
                    onClick={async e => {
                      e.preventDefault();
                      setLoadingUrl(path + '_dl');
                      try {
                        const { data, error } = await supabase.storage
                          .from('documents')
                          .createSignedUrl(path, 60 * 5, { download: true });
                        if (error) throw error;
                        const a = document.createElement('a');
                        a.href = data.signedUrl;
                        a.download = doc.label;
                        a.click();
                      } catch (err: any) {
                        toast.error('Gagal unduh: ' + err.message);
                      } finally {
                        setLoadingUrl(null);
                      }
                    }}
                    className="btn-ghost btn-sm gap-1 text-xs"
                    title="Unduh"
                  >
                    <Download size={13} />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MemberDetailPage() {
  const { id } = useParams();
  const { isPengurus, isAdmin } = useAuth();
  const navigate  = useNavigate();
  const [tab,     setTab]     = useState('data');  // 'data' | 'akun' | 'dokumen'
  const [member,  setMember]  = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState<Record<string,any>>({});
  const [saving,  setSaving]  = useState(false);

  // Reset password states
  const [newPw,       setNewPw]       = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [resetting,   setResetting]   = useState(false);
  const [lastPwForWA, setLastPwForWA] = useState(''); // password terakhir yang di-reset (untuk tombol WA)

  useEffect(() => { loadMember(); }, [id]);

  async function loadMember() {
    setLoading(true);
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error) { toast.error('Anggota tidak ditemukan'); navigate('/anggota'); return; }
    setMember(data);
    setForm(data);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const isTarakanita = (form.sekolah || '').toLowerCase().includes('tarakanita');
      const { error } = await supabase.from('users').update({
        nama_lengkap:    form.nama_lengkap,
        nama_panggilan:  form.nama_panggilan,
        pendidikan:      form.pendidikan,
        sekolah:         form.sekolah,
        lingkungan:      form.lingkungan,
        wilayah:         form.wilayah,
        alamat:          form.alamat,
        hp_anak:         form.hp_anak ? formatHP(form.hp_anak) : null,
        hp_ortu:         form.hp_ortu ? formatHP(form.hp_ortu) : null,
        nama_ayah:       form.nama_ayah,
        nama_ibu:        form.nama_ibu,
        alasan_masuk:    form.alasan_masuk,
        sampai_kapan:    form.sampai_kapan,
        nomor_data_umat: form.nomor_data_umat || null,
        is_tarakanita:   isTarakanita,
        ...(isAdmin && { role: form.role, status: form.status }),
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      toast.success('Data berhasil diperbarui!');
      setEditing(false);
      loadMember();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleSuspend() {
    const newVal = !member.is_suspended;
    const until  = newVal ? new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0] : null;
    const { error } = await supabase.from('users')
      .update({ is_suspended: newVal, suspended_until: until }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(newVal ? 'Disuspend 30 hari' : 'Suspend dicabut');
    loadMember();
  }

  // ── Reset password via Supabase Admin API ─────────────────
  async function handleResetPassword() {
    if (!newPw || newPw.length < 6) { toast.error('Password minimal 6 karakter'); return; }
    if (!confirm(`Reset password ${member.nama_panggilan} ke password baru?`)) return;
    setResetting(true);
    try {
      // Gunakan RPC admin_reset_password (SECURITY DEFINER — bypass anon key restriction)
      const { data, error } = await supabase.rpc('admin_reset_password', {
        p_user_id:      id,
        p_new_password: newPw,
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error);

      setLastPwForWA(newPw);
      toast.success(`Password ${member.nama_panggilan} berhasil direset!`);
      setShowPw(false);
      setNewPw('');
      loadMember();
    } catch (err: any) {
      toast.error('Gagal reset: ' + err.message);
    } finally {
      setResetting(false);
    }
  }

// ── Top-level FormField component (Prevents focus loss on typing/re-render) ──
function FormField({
  label,
  name,
  type = 'text',
  options,
  textarea,
  disabled: dis,
  editing,
  form,
  setForm,
}: {
  label: string;
  name: string;
  type?: string;
  options?: readonly string[] | string[];
  textarea?: boolean;
  disabled?: boolean;
  editing: boolean;
  form: Record<string, any>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}) {
  return (
    <div>
      <label className="label text-xs">{label}</label>
      {!editing || dis ? (
        <p className="text-sm text-gray-800 dark:text-slate-200 py-1">{form[name] || '—'}</p>
      ) : textarea ? (
        <textarea
          className="input h-20 resize-none text-sm"
          value={form[name] || ''}
          onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        />
      ) : options ? (
        <select
          className="input text-sm"
          value={form[name] || ''}
          onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        >
          <option value="">— Pilih —</option>
          {options.map((o: any) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          className="input text-sm"
          value={form[name] || ''}
          onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        />
      )}
    </div>
  );
}

function openWA(hp: any, pw: any, member: any) {
  const phone = (hp || '').replace(/\D/g, '');
  if (!phone) {
    toast.error('Nomor HP tidak ada');
    return;
  }
  const msg = buildWAMessage(member, pw);
  window.open(`https://wa.me/${phone.startsWith('0') ? '62' + phone.slice(1) : phone}?text=${msg}`, '_blank');
}

  if (loading) return (
    <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="skeleton h-24 rounded-xl"/>)}</div>
  );
  if (!member) return null;

  const hp = member.hp_anak || member.hp_ortu || '';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/anggota" className="btn-ghost p-2"><ArrowLeft size={20}/></Link>
        <div className="flex-1">
          <h1 className="page-title">{member.nama_panggilan}</h1>
          <p className="page-subtitle">@{member.nickname} · {member.lingkungan}</p>
        </div>
        {isPengurus && (
          <div className="flex gap-2">
            {tab === 'data' && !editing && (
              <button onClick={() => setEditing(true)} className="btn-outline gap-2">
                <Edit2 size={15}/> Edit
              </button>
            )}
            {tab === 'data' && editing && (
              <>
                <button onClick={() => { setEditing(false); setForm(member); }} className="btn-secondary gap-2">
                  <X size={15}/> Batal
                </button>
                <button onClick={handleSave} disabled={saving} className="btn-primary gap-2">
                  <Save size={15}/> {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex gap-2 flex-wrap">
        <span className={`badge ${member.status === 'Active' ? 'badge-green' : member.status === 'Pending' ? 'badge-yellow' : 'badge-gray'}`}>
          {STATUS_LABELS[member.status] || member.status}
        </span>
        <span className="badge-blue">{ROLE_LABELS[member.role] || member.role}</span>
        {member.is_tarakanita && <span className="badge-blue">🏫 Tarakanita</span>}
        {member.is_suspended && <span className="badge-red">⛔ Suspended s/d {member.suspended_until}</span>}
        {member.must_change_password && <span className="badge-yellow">🔑 Wajib Ganti Password</span>}
        <span className="badge-gray text-xs font-mono">MyID: {member.myid}</span>
        {(member as any).nomor_data_umat && (
          <span className="badge-gray text-xs font-mono">No. Data Umat: {(member as any).nomor_data_umat}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="nav-tab-wrapper">
        {[
          { key: 'data',    label: '👤 Data Diri' },
          { key: 'akun',    label: '🔑 Akun & WA' },
          { key: 'dokumen', label: '📄 Dokumen' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.key?'nav-tab-active':'nav-tab-inactive'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB DATA DIRI ─── */}
      {tab === 'data' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-700 dark:text-slate-200">Data Diri</h3>
            <FormField label="Nama Lengkap" name="nama_lengkap" editing={editing} form={form} setForm={setForm} />
            <FormField label="Nama Panggilan" name="nama_panggilan" editing={editing} form={form} setForm={setForm} />
            <FormField label="Tanggal Lahir" name="tanggal_lahir" type="date" disabled editing={editing} form={form} setForm={setForm} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Pendidikan" name="pendidikan" options={PENDIDIKAN_OPTIONS} editing={editing} form={form} setForm={setForm} />
              <div>
                <label className="label text-xs">Lingkungan</label>
                {!editing ? (
                  <p className="text-sm text-gray-800 dark:text-slate-200 py-1">{form.lingkungan || '—'}</p>
                ) : (
                  <select className="input text-sm" value={form.lingkungan || ''}
                    onChange={e => {
                      const ling = e.target.value;
                      setForm(f => ({ ...f, lingkungan: ling, wilayah: getWilayah(ling) }));
                    }}>
                    <option value="">— Pilih —</option>
                    {LINGKUNGAN_LIST.map((o: any) => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
              </div>
            </div>
            <FormField label="Sekolah" name="sekolah" editing={editing} form={form} setForm={setForm} />
            <FormField label="Wilayah" name="wilayah" editing={editing} form={form} setForm={setForm} />
            <FormField label="Alamat" name="alamat" textarea editing={editing} form={form} setForm={setForm} />
            <FormField label="No. Data Umat" name="nomor_data_umat" editing={editing} form={form} setForm={setForm} />
          </div>

          <div className="space-y-4">
            <div className="card space-y-3">
              <h3 className="font-semibold text-gray-700 dark:text-slate-200">Kontak</h3>
              <FormField label="HP Anak" name="hp_anak" editing={editing} form={form} setForm={setForm} />
              <FormField label="HP Orang Tua" name="hp_ortu" editing={editing} form={form} setForm={setForm} />
              <FormField label="Nama Ayah" name="nama_ayah" editing={editing} form={form} setForm={setForm} />
              <FormField label="Nama Ibu" name="nama_ibu" editing={editing} form={form} setForm={setForm} />
            </div>
            <div className="card space-y-3">
              <h3 className="font-semibold text-gray-700 dark:text-slate-200">Motivasi</h3>
              <FormField label="Alasan Masuk" name="alasan_masuk" textarea editing={editing} form={form} setForm={setForm} />
              <FormField label="Sampai Kapan" name="sampai_kapan" editing={editing} form={form} setForm={setForm} />
            </div>
            {isAdmin && (
              <div className="card space-y-3 border-brand-100 dark:border-slate-800">
                <h3 className="font-semibold text-brand-800 dark:text-amber-400 text-sm">⚙️ Admin</h3>
                <FormField label="Role" name="role" options={ROLES} editing={editing} form={form} setForm={setForm} />
                <FormField label="Status" name="status" options={['Active','Pending','Retired']} editing={editing} form={form} setForm={setForm} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB AKUN & WA ─── */}
      {tab === 'akun' && isAdmin && (
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Reset Password */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-2">
              <KeyRound size={16} className="text-brand-800 dark:text-amber-400"/> Reset Password
            </h3>
            <div className="bg-yellow-50 dark:bg-amber-950/40 border border-yellow-200 dark:border-amber-800/50 rounded-xl p-3 text-xs text-yellow-800 dark:text-amber-300">
              Admin tidak dapat melihat password sekarang. Setelah reset, anggota diwajibkan mengganti password saat login berikutnya.
            </div>

            <div>
              <label className="label text-xs">Password Baru</label>
              <div className="flex gap-2">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input flex-1"
                  value={newPw}
                  placeholder="Min. 6 karakter"
                  onChange={e => setNewPw(e.target.value)}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="btn-ghost px-3 text-xs">{showPw ? 'Sembunyikan' : 'Lihat'}</button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setNewPw(genPassword())}
                className="btn-outline btn-sm gap-1 text-xs flex-1">
                🎲 Generate Otomatis
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetting || !newPw}
                className="btn-primary btn-sm gap-1 flex-1">
                {resetting ? 'Mereset...' : '🔑 Reset'}
              </button>
            </div>

            {newPw && (
              <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 font-mono text-sm text-center border border-dashed border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100">
                Password baru: <strong>{newPw}</strong>
              </div>
            )}
          </div>

          {/* Pengaturan Jadwal — hanya tampil untuk Pengurus/Admin */}
          {['Administrator','Pengurus'].includes(member.role) && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-2">
                <CalendarDays size={16} className="text-brand-800 dark:text-amber-400"/> Pengaturan Jadwal
              </h3>
              <label className="flex items-center justify-between gap-4 cursor-pointer select-none p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200">Dapat jadi PIC Misa Harian</p>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">Jika dimatikan, tidak akan masuk pool PIC saat generate jadwal</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const newVal = !(member as any).dapat_pic_harian;
                    const { error } = await (supabase as any).from('users').update({ dapat_pic_harian: newVal }).eq('id', member.id);
                    if (error) { toast.error(error.message); return; }
                    setMember((m: any) => ({ ...m, dapat_pic_harian: newVal }));
                    toast.success(newVal ? 'PIC Misa Harian diaktifkan' : 'PIC Misa Harian dinonaktifkan');
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${(member as any).dapat_pic_harian !== false ? 'bg-brand-800 dark:bg-amber-500' : 'bg-gray-300 dark:bg-slate-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${(member as any).dapat_pic_harian !== false ? 'translate-x-5' : 'translate-x-0'}`}/>
                </button>
              </label>
            </div>
          )}

          {/* WA Kredensial */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-2">
              <MessageCircle size={16} className="text-green-600 dark:text-green-400"/> Kirim Kredensial via WA
            </h3>

            <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3 text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
              <p className="font-semibold text-gray-800 dark:text-slate-200 mb-1">Preview pesan yang akan dikirim:</p>
              <p className="italic whitespace-pre-line text-gray-500 dark:text-slate-400 text-[11px]">{
`Selamat ${getSalam()} bapak/ibu semua. Berikut adalah username dan password yang akan digunakan untuk sistem penjadwalan SIGMA V. 2.0

username: ${member.nickname}
password: [password yang di-reset]
link sigma: sigma-krsoba.vercel.app

Mohon login... (dst)`
              }</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-slate-400">Kirim ke nomor:</p>
              {member.hp_ortu && (
                <button
                  onClick={() => {
                    const pw = lastPwForWA || newPw;
                    if (!pw) { toast.error('Reset password dulu sebelum kirim WA'); return; }
                    openWA(member.hp_ortu, pw, member);
                  }}
                  className="btn-outline w-full gap-2 text-sm justify-start">
                  <MessageCircle size={15} className="text-green-600 dark:text-green-400"/>
                  WA Orang Tua: {member.hp_ortu}
                </button>
              )}
              {member.hp_anak && (
                <button
                  onClick={() => {
                    const pw = lastPwForWA || newPw;
                    if (!pw) { toast.error('Reset password dulu sebelum kirim WA'); return; }
                    openWA(member.hp_anak, pw, member);
                  }}
                  className="btn-outline w-full gap-2 text-sm justify-start">
                  <MessageCircle size={15} className="text-green-600 dark:text-green-400"/>
                  WA Anak: {member.hp_anak}
                </button>
              )}
              {!member.hp_ortu && !member.hp_anak && (
                <p className="text-xs text-orange-500 dark:text-orange-400">⚠️ Tidak ada nomor HP yang terdaftar. Edit data diri dulu.</p>
              )}
            </div>

            {!lastPwForWA && !newPw && (
              <p className="text-xs text-gray-400 dark:text-slate-400 italic">
                💡 Reset password dulu (tab kiri), lalu tombol WA akan berisi password baru secara otomatis.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'akun' && !isAdmin && (
        <div className="card text-center py-10 text-gray-400 dark:text-slate-500">
          <KeyRound size={36} className="mx-auto mb-2 opacity-30"/>
          <p>Hanya Administrator yang dapat mengakses tab ini.</p>
        </div>
      )}

      {/* ─── TAB DOKUMEN ─── */}
      {tab === 'dokumen' && (
        <DocTab member={member} isPengurus={isPengurus} />
      )}

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        <Link to={`/kartu?user=${member.id}`} className="btn-primary gap-2">
          <CreditCard size={16}/> Kartu QR
        </Link>
        <Link to={`/rekap?user=${member.id}`} className="btn-outline gap-2">
          <BarChart2 size={16}/> Rekap Poin
        </Link>
        {isPengurus && hp && (
          <a href={buildWALink(hp, '')} target="_blank" rel="noopener noreferrer" className="btn-outline gap-2">
            <Phone size={16}/> WA
          </a>
        )}
        {isAdmin && (
          <button onClick={toggleSuspend}
            className={`gap-2 flex items-center ${member.is_suspended ? 'btn-secondary' : 'btn-danger'}`}>
            {member.is_suspended
              ? <><ShieldCheck size={16}/> Cabut Suspend</>
              : <><ShieldAlert size={16}/> Suspend 30 Hari</>
            }
          </button>
        )}
      </div>
    </div>
  );
}
