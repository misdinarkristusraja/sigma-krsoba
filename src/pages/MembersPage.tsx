import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { truncate, ROLE_LABELS, STATUS_LABELS, formatDate, buildWALink, generateMyID } from '../lib/utils';
import {
  Search, CheckCircle, XCircle, Eye,
  Download, RefreshCw, AlertTriangle, Users,
  ShieldAlert, ShieldCheck, ChevronDown, Edit2, MessageCircle,
  KeyRound, Copy, Share2,
} from 'lucide-react';

const VIDEO_TUTORIAL_LINK = 'https://youtu.be/zVN7jL6fUqQ';
import toast from 'react-hot-toast';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/ui/Pagination';

const TABS = [
  { key: 'all',     label: 'Semua' },      // ← default ke Semua dulu
  { key: 'active',  label: 'Aktif' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'retired', label: 'Alumni' },
];

export default function MembersPage() {
  const { isPengurus, isAdmin } = useAuth();
  const [tab,      setTab]     = useState('all');   // default Semua
  const [members,  setMembers] = useState<any[]>([]);
  const [regs,     setRegs]    = useState<any[]>([]);
  const [search,   setSearch]  = useState('');
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState('');
  const [total,    setTotal]   = useState(0);
  const [filter,   setFilter]  = useState({ pendidikan: '' });
  const [quickEdit, setQuickEdit] = useState<any>(null); // { id, field } — baris yang sedang diedit
  const [resettingId,      setResettingId]      = useState<string | null>(null);
  const [resetResult,      setResetResult]      = useState<{ nickname: string; password: string } | null>(null);
  const [sendPasswordMode, setSendPasswordMode] = useState(false);
  const [reregSet,         setReregSet]         = useState<Set<string>>(new Set());
  const [filterRereg,      setFilterRereg]      = useState('');  // '' | 'done' | 'not_done'

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (tab === 'pending') {
        const { data, error: e } = await supabase
          .from('registrations')
          .select('*')
          .eq('status', 'Pending')
          .order('created_at', { ascending: false });
        if (e) throw e;
        setRegs(data || []);
        setMembers([]);
      } else {
        let q = supabase
          .from('users')
          .select('id, nickname, myid, nama_lengkap, nama_panggilan, pendidikan, sekolah, lingkungan, wilayah, role, status, is_tarakanita, is_suspended, created_at, hp_ortu, hp_anak', { count: 'exact' })
          .order('nama_panggilan', { nullsFirst: false })
          .order('nickname');

        if (tab === 'active')  q = q.eq('status', 'Active');
        if (tab === 'retired') q = q.eq('status', 'Retired');
        if (filter.pendidikan) q = q.eq('pendidikan', filter.pendidikan);

        const [{ data, error: e, count }, { data: cfgData }, ] = await Promise.all([
          q,
          supabase.from('system_config').select('key, value').eq('key', 'rereg_tahun').maybeSingle(),
        ]);

        if (e) throw e;
        setMembers(data || []);
        setTotal(count || 0);
        setRegs([]);

        // Fetch reregistrations for current rereg year
        const tahun = parseInt((cfgData as any)?.value || String(new Date().getFullYear()));
        const { data: reregData } = await supabase
          .from('reregistrations')
          .select('user_id')
          .eq('tahun', tahun);
        setReregSet(new Set((reregData || []).map((r: any) => r.user_id)));
      }
    } catch (err: any) {
      console.error('loadData error:', err);
      setError(err.message || 'Gagal memuat data');
      toast.error('Gagal memuat anggota: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [tab, filter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter client-side
  const filtered = members.filter(m => {
    if (search) {
      const q = search.toLowerCase();
      if (![m.nama_panggilan, m.nickname, m.nama_lengkap, m.lingkungan, m.sekolah, m.myid]
            .some(v => v?.toLowerCase().includes(q))) return false;
    }
    if (filterRereg === 'done'     && !reregSet.has(m.id)) return false;
    if (filterRereg === 'not_done' &&  reregSet.has(m.id)) return false;
    return true;
  });

  const pg = usePagination(filtered, 10);

  // ── Quick inline change status/role ───────────────────────
  const ALLOWED_QUICK_FIELDS = ['status', 'role'] as const;
  async function quickChange(memberId: string, field: typeof ALLOWED_QUICK_FIELDS[number], value: string) {
    if (!(ALLOWED_QUICK_FIELDS as readonly string[]).includes(field)) { toast.error('Field tidak valid'); return; }
    const { error } = await supabase
      .from('users')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', memberId);
    if (error) { toast.error('Gagal: ' + error.message); return; }
    toast.success(`${field === 'status' ? 'Status' : 'Role'} diperbarui`);
    setQuickEdit(null);
    loadData();
  }

  // ── Quick suspend / unsuspend ──────────────────────────────
  async function toggleSuspend(member: any) {
    const newVal    = !member.is_suspended;
    const until     = newVal
      ? new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]
      : null;
    const { error } = await supabase.from('users')
      .update({ is_suspended: newVal, suspended_until: until, updated_at: new Date().toISOString() })
      .eq('id', member.id);
    if (error) { toast.error(error.message); return; }
    toast.success(newVal ? `${member.nama_panggilan} disuspend 30 hari` : 'Suspend dicabut');
    loadData();
  }

  // ── Approve Registrasi (via RPC supabase_auth_admin) ───────
  async function approveRegistration(reg: any) {
    try {
      const myid     = await generateMyID(reg.nickname, reg.tanggal_lahir || '2000-01-01');
      const tempPass = `sigma${myid.slice(0,6)}`;

      const { data, error } = await supabase.rpc('admin_approve_registration', {
        p_registration_id: reg.id,
        p_myid:            myid,
        p_temp_password:   tempPass,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || data?.error || 'Unknown error');

      toast.success(`✅ ${reg.nickname} disetujui! MyID: ${myid} | Password: ${tempPass}`);
      loadData();
    } catch (err: any) {
      toast.error('Gagal approve: ' + err.message);
    }
  }

  async function rejectRegistration(reg: any) {
    if (!confirm(`Tolak pendaftaran ${reg.nickname}?`)) return;
    const { error } = await supabase.from('registrations')
      .update({ status: 'Rejected', rejected_at: new Date().toISOString() })
      .eq('id', reg.id);
    if (error) { toast.error('Gagal: ' + error.message); return; }
    toast.success('Pendaftaran ditolak');
    loadData();
  }

  // Reset password satu user
  async function resetSinglePassword(member: any) {
    if (!confirm(`Reset password ${member.nama_panggilan || member.nickname}?\nPassword baru akan ditampilkan setelah proses selesai.`)) return;
    setResettingId(member.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ mode: 'reset_single', target_id: member.id }),
        }
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || 'Reset gagal');
      setResetResult({ nickname: member.nama_panggilan || member.nickname, password: json.password });
    } catch (err: any) {
      toast.error('Reset gagal: ' + err.message);
    } finally {
      setResettingId(null);
    }
  }

  // Build WA link dengan template onboarding password
  function buildPasswordWALink(member: any, hp: string): string {
    const phone = hp.replace(/\D/g, '');
    const normalized = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
    const nama     = member.nama_panggilan || member.nickname;
    const username = member.nickname;
    const videoLink = VIDEO_TUTORIAL_LINK || '[link video]';
    const text = `Halo ${nama}! \n\nKabar gembira! Saat ini, Sigma-Kr v.2 sudah resmi dirilis dan siap untuk kamu gunakan. \n\nSebelum mulai menjelajah, ada beberapa langkah penting yang wajib kamu perhatikan terlebih dahulu:\n\n- Login Awal: Dimohon untuk segera melakukan login setelah akun dibagikan.\n\n- Ganti Password: Setelah berhasil masuk, segera ganti password default kamu dengan password baru yang aman dan mudah diingat.\n\n- Re-Login: Silakan keluar lalu login kembali menggunakan password baru tersebut.\n\n- Daftar Ulang: Begitu masuk ke halaman dashboard, mohon segera lakukan daftar ulang SEBELUM 11 Juli 2026.\n\n- Validasi Data: Pastikan seluruh data yang kamu masukkan sudah sesuai. Jika menemui kesulitan atau kendala dalam pengisian, wajib segera melaporkannya ke pengurus.\n\n- Selesai: Jika langkah di atas sudah terpenuhi, akun dan aplikasi kamu sudah siap digunakan sepenuhnya!\n\n Detail Akun Kamu:\n\nUsername: ${username}\n\nPassword: [password]\n\nLink Aplikasi: https://sigma-kr.vercel.app/\n\n- Butuh Panduan Visual?\nUntuk alur yang lebih jelas, kamu bisa langsung menonton video tutorialnya di sini: ${videoLink}\n\nTerima kasih atas perhatiannya. Selamat mencoba Sigma-Kr v.2!`;
    return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
  }

  // Export CSV
  function exportCSV() {
    const rows = filtered.map(m => [
      m.nickname, m.nama_lengkap, m.nama_panggilan, m.pendidikan,
      m.sekolah, m.lingkungan, m.wilayah, m.myid, m.role, m.status
    ]);
    const header = ['Nickname','Nama Lengkap','Nama Panggilan','Pendidikan','Sekolah','Lingkungan','Wilayah','MyID','Role','Status'];
    const csv = [header, ...rows].map(r => r.map(v => `"${v||''}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv'}));
    a.download = `anggota-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  const pendingCount = tab === 'pending' ? regs.length : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Manajemen Anggota</h1>
          <p className="page-subtitle">
            {tab === 'all' ? `${total} total anggota` : `${filtered.length} anggota`}
          </p>
        </div>
        <div className="flex gap-2">
          {isPengurus && (
            <button
              onClick={() => setSendPasswordMode(v => !v)}
              className={`btn-sm gap-2 ${sendPasswordMode ? 'btn-primary' : 'btn-outline'}`}
              title="Mode kirim pesan onboarding + password ke anggota via WA">
              <Share2 size={14}/> {sendPasswordMode ? 'Mode Kirim: ON' : 'Kirim Password'}
            </button>
          )}
          <button onClick={exportCSV} disabled={filtered.length === 0}
            className="btn-outline gap-2 btn-sm">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={loadData} className="btn-ghost p-2" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-brand-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {t.key === 'pending' && regs.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                {regs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={loadData} className="ml-auto text-xs text-red-600 underline">Coba lagi</button>
        </div>
      )}

      {/* Pending registrations */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {loading ? (
            <div className="skeleton h-24 rounded-xl" />
          ) : regs.length === 0 ? (
            <div className="card text-center py-10">
              <CheckCircle size={40} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-400">Tidak ada pendaftaran baru</p>
            </div>
          ) : regs.map(reg => (
            <div key={reg.id} className="card border-l-4 border-yellow-400">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-gray-900">{reg.nama_lengkap}</span>
                    <span className="badge-yellow">Pending</span>
                    {reg.is_tarakanita && <span className="badge-blue">Tarakanita</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500">
                    <span>@{reg.nickname}</span>
                    <span>📚 {reg.pendidikan} · {reg.sekolah}</span>
                    <span>⛪ {reg.lingkungan}</span>
                    <span>📅 {formatDate(reg.tanggal_lahir, 'dd MMM yyyy')}</span>
                    {isPengurus && <span>📞 {reg.hp_ortu}</span>}
                    {reg.alasan_masuk && <span className="col-span-2">💬 {truncate(reg.alasan_masuk, 50)}</span>}
                  </div>
                </div>
                {isPengurus && (
                  <div className="flex gap-2">
                    <button onClick={() => approveRegistration(reg)}
                      className="btn-primary btn-sm gap-1">
                      <CheckCircle size={13} /> Setuju
                    </button>
                    <button onClick={() => rejectRegistration(reg)}
                      className="btn-danger btn-sm gap-1">
                      <XCircle size={13} /> Tolak
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Members list */}
      {/* Reset password result modal */}
      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <KeyRound size={22} className="text-green-600"/>
              </div>
              <h3 className="font-bold text-gray-900">Password Berhasil Direset</h3>
              <p className="text-sm text-gray-500 mt-1">
                Password baru untuk <strong>{resetResult.nickname}</strong>:
              </p>
            </div>
            <div className="bg-gray-100 rounded-xl p-3 flex items-center justify-between gap-2">
              <code className="font-mono text-lg font-bold text-gray-800 tracking-wider">
                {resetResult.password}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(resetResult!.password); toast.success('Disalin!'); }}
                className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors" title="Salin">
                <Copy size={15} className="text-gray-500"/>
              </button>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
              Pengguna sudah di-logout otomatis dan akan diminta membuat password baru saat login kembali.
            </p>
            <button onClick={() => setResetResult(null)} className="btn-primary w-full">Tutup</button>
          </div>
        </div>
      )}

      {tab !== 'pending' && (
        <>
          {/* Search & filter */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" placeholder="Cari nama, nickname, lingkungan, MyID..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input w-auto"
              value={filter.pendidikan}
              onChange={e => setFilter(f => ({...f, pendidikan: e.target.value}))}>
              <option value="">Semua Pendidikan</option>
              {['SD','SMP','SMA','SMK','Lulus'].map(p => <option key={p}>{p}</option>)}
            </select>
            <select className="input w-auto"
              value={filterRereg}
              onChange={e => setFilterRereg(e.target.value)}>
              <option value="">Semua Daftar Ulang</option>
              <option value="done">✅ Sudah Daftar Ulang</option>
              <option value="not_done">❌ Belum Daftar Ulang</option>
            </select>
          </div>

          {/* Count info */}
          {!loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users size={15} />
              <span>
                <strong className="text-gray-800">{filtered.length}</strong> anggota
                {search && ` (filter: "${search}")`}
              </span>
            </div>
          )}

          {/* Table */}
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>MyID / Checksum</th>
                    <th>Pendidikan</th>
                    <th>Lingkungan</th>
                    <th>Daftar Ulang</th>
                    <th>Status &amp; Role</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(8)].map((_, j) => (
                          <td key={j}><div className="skeleton h-4 rounded w-full" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10">
                        <Users size={40} className="mx-auto text-gray-200 mb-2" />
                        <p className="text-gray-400 text-sm">
                          {search ? `Tidak ada hasil untuk "${search}"` : 'Belum ada anggota'}
                        </p>
                        {!search && tab === 'active' && (
                          <p className="text-xs text-gray-400 mt-1">
                            Coba tab <button onClick={() => setTab('all')}
                              className="text-brand-800 underline">Semua</button> untuk lihat semua data
                          </p>
                        )}
                      </td>
                    </tr>
                  ) : pg.paged.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center text-brand-800 font-bold text-xs flex-shrink-0">
                            {(m.nama_panggilan || m.nickname || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">
                              {m.nama_panggilan || m.nickname}
                            </div>
                            <div className="text-xs text-gray-400">@{m.nickname}</div>
                          </div>
                          {m.is_tarakanita && (
                            <span className="badge-blue text-[10px]">T</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">
                          {m.myid || '—'}
                        </code>
                      </td>
                      <td>
                        <span className="badge-gray">{m.pendidikan || '—'}</span>
                      </td>
                      <td className="text-gray-600 text-sm">{m.lingkungan || '—'}</td>
                      <td className="text-center">
                        {reregSet.has(m.id)
                          ? <span className="badge-green text-xs">✅ Sudah</span>
                          : <span className="badge-red text-xs">❌ Belum</span>
                        }
                      </td>
                      {/* Status + Role — satu kolom, dua inline edit */}
                      <td>
                        <div className="flex flex-col gap-1">
                          {/* Status */}
                          {isPengurus && quickEdit?.id === m.id && quickEdit?.field === 'status' ? (
                            <select className="input text-xs py-0.5 w-28" autoFocus
                              defaultValue={m.status}
                              onChange={e => quickChange(m.id, 'status', e.target.value)}
                              onBlur={() => setQuickEdit(null)}>
                              <option value="Active">Aktif</option>
                              <option value="Pending">Pending</option>
                              <option value="Retired">Alumni</option>
                            </select>
                          ) : (
                            <button
                              onClick={() => isPengurus && setQuickEdit({ id: m.id, field: 'status' })}
                              className={`badge flex items-center gap-1 w-fit ${
                                m.is_suspended ? 'badge-red' :
                                m.status === 'Active'  ? 'badge-green' :
                                m.status === 'Pending' ? 'badge-yellow' :
                                'badge-gray'
                              } ${isPengurus ? 'cursor-pointer hover:opacity-80' : ''}`}
                              title={isPengurus ? 'Klik untuk ubah status' : ''}>
                              {m.is_suspended ? '⛔ Suspended' : (STATUS_LABELS[m.status] || m.status)}
                              {isPengurus && <ChevronDown size={10}/>}
                            </button>
                          )}
                          {/* Role */}
                          {isAdmin && quickEdit?.id === m.id && quickEdit?.field === 'role' ? (
                            <select className="input text-xs py-0.5 w-36" autoFocus
                              defaultValue={m.role}
                              onChange={e => quickChange(m.id, 'role', e.target.value)}
                              onBlur={() => setQuickEdit(null)}>
                              {['Administrator','Pengurus','Pendamping','Pelatih','Misdinar_Aktif','Misdinar_Retired'].map(r => (
                                <option key={r} value={r}>{ROLE_LABELS[r]||r}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => isAdmin && setQuickEdit({ id: m.id, field: 'role' })}
                              className={`text-xs text-gray-500 flex items-center gap-1 w-fit ${isAdmin ? 'cursor-pointer hover:text-brand-800' : ''}`}
                              title={isAdmin ? 'Klik untuk ubah role' : ''}>
                              {ROLE_LABELS[m.role] || m.role}
                              {isAdmin && <ChevronDown size={10} className="opacity-50"/>}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="flex items-center gap-0.5 flex-wrap">
                          <Link to={`/anggota/${m.id}`} className="btn-ghost p-1.5" title="Lihat detail">
                            <Eye size={14}/>
                          </Link>
                          {isPengurus && !sendPasswordMode && (m.hp_ortu || m.hp_anak) && (
                            <button
                              title={`WA Orang Tua ${m.nama_panggilan}`}
                              onClick={() => {
                                const hp = (m.hp_ortu || m.hp_anak || '').replace(/\D/g,'');
                                const phone = hp.startsWith('0') ? '62'+hp.slice(1) : hp;
                                window.open(`https://wa.me/${phone}`, '_blank');
                              }}
                              className="btn-ghost p-1.5 text-green-600 hover:bg-green-50">
                              <MessageCircle size={14}/>
                            </button>
                          )}
                          {isPengurus && sendPasswordMode && m.hp_ortu && (
                            <a href={buildPasswordWALink(m, m.hp_ortu)} target="_blank" rel="noopener noreferrer"
                              className="btn-ghost p-1.5 text-blue-600 hover:bg-blue-50"
                              title={`Kirim onboarding ke Ortu (${m.hp_ortu})`}>
                              <Share2 size={14}/>
                            </a>
                          )}
                          {isPengurus && sendPasswordMode && m.hp_anak && (
                            <a href={buildPasswordWALink(m, m.hp_anak)} target="_blank" rel="noopener noreferrer"
                              className="btn-ghost p-1.5 text-violet-600 hover:bg-violet-50"
                              title={`Kirim onboarding ke Anak (${m.hp_anak})`}>
                              <Share2 size={14}/>
                            </a>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => resetSinglePassword(m)}
                              disabled={resettingId === m.id}
                              className="btn-ghost p-1.5 text-yellow-600 hover:bg-yellow-50"
                              title="Reset password">
                              {resettingId === m.id
                                ? <div className="w-3.5 h-3.5 border-2 border-yellow-400/40 border-t-yellow-500 rounded-full animate-spin"/>
                                : <KeyRound size={14}/>
                              }
                            </button>
                          )}
                          {isPengurus && (
                            <button
                              onClick={() => toggleSuspend(m)}
                              className={`btn-ghost p-1.5 ${m.is_suspended ? 'text-green-600 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'}`}
                              title={m.is_suspended ? 'Cabut suspend' : 'Suspend 30 hari'}>
                              {m.is_suspended
                                ? <ShieldCheck size={14}/>
                                : <ShieldAlert size={14}/>
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && filtered.length > 0 && (
              <div className="px-4">
                <Pagination {...pg} onPage={pg.goTo} label="anggota" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
