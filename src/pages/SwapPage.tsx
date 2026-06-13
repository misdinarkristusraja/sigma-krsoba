import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { formatDate, buildWALink } from '../lib/utils';
import {
  ArrowLeftRight, MessageCircle, Clock, CheckCircle, XCircle,
  Plus, AlertTriangle, Send, Copy, RefreshCw, Shield, Globe, MessageSquare,
  Pencil, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/ui/Pagination';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  Pending:          { label: 'Menunggu PIC',        color: 'badge-yellow' },
  Approved_PIC:     { label: 'Disetujui PIC',        color: 'badge-blue'   },
  Rejected_PIC:     { label: 'Ditolak PIC',          color: 'badge-red'    },
  Replaced:         { label: 'Tergantikan',           color: 'badge-green'  },
  Offered:          { label: 'Di Papan Penawaran',    color: 'badge-purple' },
  Expired:          { label: 'Kadaluarsa',            color: 'badge-gray'   },
  Tidak_Terganti:   { label: 'Tidak Terganti',        color: 'badge-red'    },
};

// Offered item yang sudah lewat tanggal tugas = "Tidak Terganti"
const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
function getEffectiveStatus(req: any) {
  if (req.status === 'Offered') {
    const tgl = req.assignment?.events?.tanggal_tugas?.slice(0, 10);
    if (tgl && tgl < todayStr()) return 'Tidak_Terganti';
  }
  return req.status;
}

const SLOT_LABELS: Record<number, string> = { 1:'Sabtu 17:30', 2:'Minggu 06:00', 3:'Minggu 08:00', 4:'Minggu 17:30' };

// Fase 2 — Misa Harian tidak punya struktur slot Sabtu/Minggu. Slot apapun ditulis "Misa N".
// Misa akhir-pekan (Mingguan/Jumper/Sabtu_Imam) tetap pakai SLOT_LABELS.
function slotLabel(slot: number | null | undefined, tipeEvent?: string | null): string {
  if (tipeEvent === 'Misa_Harian') return `Misa ${slot || 1}`;
  return SLOT_LABELS[slot as number] || `Misa ${slot || 1}`;
}

// Fase 3 — Misa Mingguan menyimpan SATU tanggal_tugas = hari Minggu, tapi slot 1 adalah
// Misa antisipasi Sabtu (H-1). Nama perayaan tetap nama Minggu, tapi TANGGAL yang
// ditampilkan harus ikut hari pelaksanaan: slot 1 = Sabtu (tanggal_tugas−1), slot 2-4 = Minggu.
// Misa Harian / Misa Khusus = satu hari, tidak ada pergeseran.
function effectiveDate(
  tanggalTugas: string | null | undefined,
  slot: number | null | undefined,
  tipeEvent?: string | null,
): string | null | undefined {
  if (!tanggalTugas) return tanggalTugas;
  const isWeekend = tipeEvent !== 'Misa_Harian' && tipeEvent !== 'Misa_Khusus';
  if (isWeekend && slot === 1) {
    const d = new Date(tanggalTugas.slice(0, 10) + 'T00:00:00'); // parse lokal, hindari UTC shift
    d.setDate(d.getDate() - 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return tanggalTugas;
}

export default function SwapPage() {
  const { profile, isPengurus } = useAuth();

  const [tab,       setTab]      = useState('my');
  const [myReqs,    setMyReqs]   = useState<any[]>([]);
  const [board,     setBoard]    = useState<any[]>([]);
  const [allReqs,   setAllReqs]  = useState<any[]>([]);  // untuk admin
  const [mySched,   setMySched]  = useState<any[]>([]);
  const [loading,   setLoading]  = useState(true);

  // Form: request sendiri
  const [showForm,  setShowForm] = useState(false);
  const [formData,  setForm]     = useState({ assignment_id: '', alasan: '' });

  // Form: admin add request untuk orang lain
  const [showAdminForm,  setShowAdminForm]  = useState(false);
  const [editingId,      setEditingId]      = useState<string | null>(null); // null = mode tambah, else mode edit
  const [adminForm,      setAdminForm]      = useState({
    requester_id: '', assignment_id: '', alasan: '', pengganti_id: '', status: 'Replaced',
  });
  const [allMembers,     setAllMembers]     = useState<any[]>([]);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);

  // WA template grup
  const [showWA,  setShowWA]  = useState(false);
  const [waText,  setWaText]  = useState('');
  const [grupWA,  setGrupWA]  = useState('https://chat.whatsapp.com/KATPS0AwNT2FlMxKqHeG1T');

  const pgMy  = usePagination(myReqs,  10);
  const pgBoard = usePagination(board, 10);
  const pgAll = usePagination(allReqs, 10);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    await Promise.all([
      loadMyRequests(),
      loadBoard(),
      loadMySchedule(),
      isPengurus && loadAllRequests(),
    ].filter(Boolean));
    setLoading(false);
  }, [profile, isPengurus]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load daftar anggota & assignment untuk admin form
  useEffect(() => {
    if (!isPengurus) return;
    const today = new Date().toISOString().split('T')[0];
    supabase.from('users').select('id, nickname, nama_panggilan, lingkungan')
      .eq('status','Active').order('nama_panggilan')
      .then(({ data }: any) => setAllMembers(data||[]));

    // Admin form: ambil semua event (termasuk lama) agar bisa catat manual retroaktif.
    // Tidak filter is_draft — admin mungkin perlu catat event draft juga.
    // Tidak filter tanggal — admin butuh akses semua jadwal untuk rekap historis.
    (async () => {
      const { data: evData } = await supabase.from('events')
        .select('id, nama_event, perayaan, tanggal_tugas, tipe_event')
        .order('tanggal_tugas', { ascending: false })
        .limit(120);
      if (!evData?.length) { setAllAssignments([]); return; }
      const eventIds = evData.map((e: any) => e.id);
      // PENTING: include event_id di select agar merge bisa match
      const { data: asgnData } = await supabase.from('assignments')
        .select('id, slot_number, user_id, event_id, users(nama_panggilan)')
        .in('event_id', eventIds)
        .order('event_id');
      const evMap: Record<string, any> = {};
      evData.forEach((e: any) => { evMap[e.id] = e; });
      const merged = (asgnData || []).map((a: any) => ({
        ...a,
        events: evMap[a.event_id] || null,
      })).filter((a: any) => a.events);
      setAllAssignments(merged);
    })();
  }, [isPengurus]);

  async function loadMyRequests() {
    const { data } = await supabase
      .from('swap_requests')
      .select(`*,
        assignment:assignment_id(slot_number, events(nama_event, tanggal_tugas, perayaan, tipe_event)),
        pic:pic_user_id(nama_panggilan, hp_anak, hp_ortu),
        pengganti:pengganti_id(nama_panggilan)`)
      .eq('requester_id', profile!.id)
      .order('created_at', { ascending: false }).limit(30);
    setMyReqs(data||[]);
  }

  async function loadBoard() {
    const today = todayStr(); // local date — consistent with getEffectiveStatus()
    const { data } = await supabase
      .from('swap_requests')
      .select(`*,
        requester:requester_id(nama_panggilan, lingkungan),
        assignment:assignment_id(slot_number, events(nama_event, tanggal_tugas, perayaan, tipe_event))`)
      .eq('is_penawaran', true).eq('status','Offered')
      .neq('requester_id', profile?.id)
      .order('created_at', { ascending: false }).limit(50);
    // Exclude items where event date already passed — those are "Tidak Terganti" virtually,
    // but still have status='Offered' in DB. Filtering here keeps board and admin table in sync.
    setBoard((data || []).filter((req: any) => {
      const tgl = req.assignment?.events?.tanggal_tugas?.slice(0, 10);
      return !tgl || tgl >= today;
    }));
  }

  async function loadMySchedule() {
    const today = new Date().toISOString().split('T')[0];
    // Query events mendatang user ini dulu, lalu ambil assignments-nya.
    // Filter .gte('events.tanggal_tugas') di embedded relation tidak reliable di PostgREST.
    const { data: evData } = await supabase
      .from('events')
      .select('id, nama_event, tanggal_tugas, perayaan, tipe_event, event_pics(slot, nama, hp, urutan)')
      .gte('tanggal_tugas', today)
      .eq('is_draft', false)
      .order('tanggal_tugas')
      .limit(20);
    if (!evData?.length) { setMySched([]); return; }
    const eventIds = evData.map((e: any) => e.id);
    const { data: asgnData } = await supabase
      .from('assignments')
      .select('id, slot_number, event_id')
      .eq('user_id', profile!.id)
      .in('event_id', eventIds);
    const evMap: Record<string, any> = {};
    evData.forEach((e: any) => { evMap[e.id] = e; });
    const merged = (asgnData || [])
      .map((a: any) => ({ ...a, events: evMap[a.event_id] || null }))
      .filter((a: any) => a.events)
      .sort((a: any, b: any) => a.events.tanggal_tugas.localeCompare(b.events.tanggal_tugas));
    setMySched(merged);
  }

  async function loadAllRequests() {
    const { data } = await supabase
      .from('swap_requests')
      .select(`*,
        requester:requester_id(nama_panggilan, lingkungan, nickname),
        pengganti:pengganti_id(nama_panggilan),
        assignment:assignment_id(slot_number, events(nama_event, tanggal_tugas, perayaan, tipe_event)),
        pic:pic_user_id(nama_panggilan)`)
      .order('created_at', { ascending: false }).limit(100);
    setAllReqs(data||[]);
  }

  // ── Submit request sendiri ─────────────────────────────────
  async function submitRequest() {
    if (!formData.assignment_id || !formData.alasan) {
      toast.error('Pilih jadwal dan isi alasan'); return;
    }
    const asgn = mySched.find(s => s.id === formData.assignment_id);
    if (!asgn) return;

    const ev    = asgn.events;
    const slot  = asgn.slot_number;
    const slotPics = ((ev.event_pics || []) as any[])
      .filter((p: any) => p.slot === slot)
      .sort((a: any, b: any) => a.urutan - b.urutan);
    const picNick = slotPics[0]?.nama || null;
    let picUserId = null, picWaLink = '';

    if (picNick) {
      const { data: picUser } = await supabase.from('users')
        .select('id, hp_anak, hp_ortu').eq('nickname', picNick).maybeSingle();
      if (picUser) {
        picUserId = picUser.id;
        const hp  = picUser.hp_anak || picUser.hp_ortu || '';
        picWaLink = buildWALink(hp,
          `Halo ${picNick}, saya ${profile!.nama_panggilan} ingin tukar jadwal ` +
          `${ev.perayaan||ev.nama_event} (${formatDate(ev.tanggal_tugas,'dd MMM')}) ` +
          `Misa ${slot}. Alasan: ${formData.alasan}. Mohon konfirmasi ya 🙏`
        );
      }
    }

    const { error } = await supabase.from('swap_requests').insert({
      requester_id:  profile!.id,
      assignment_id: formData.assignment_id,
      alasan:        formData.alasan,
      pic_user_id:   picUserId,
      pic_wa_link:   picWaLink,
      status:        'Pending',
      expires_at:    new Date(Date.now() + 24*60*60*1000).toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Request terkirim!');
    setShowForm(false);
    setForm({ assignment_id: '', alasan: '' });
    loadData();
    if (picWaLink) setTimeout(() => {
      if (confirm('Buka WhatsApp untuk hubungi PIC?')) window.open(picWaLink,'_blank');
    }, 400);
  }

  // ── Admin: add swap manual ─────────────────────────────────
  async function submitAdminSwap() {
    const f = adminForm;
    if (!f.requester_id || !f.assignment_id) {
      toast.error('Pilih anggota dan jadwal'); return;
    }
    if (f.status === 'Replaced' && !f.pengganti_id) {
      toast.error('Status "Tergantikan" membutuhkan pengganti — pilih anggota pengganti'); return;
    }

    const isTerminal = f.status === 'Replaced';
    const isOffered  = f.status === 'Offered';

    // Hitung expires_at: terminal = sekarang (sudah selesai), offered = sampai tanggal event,
    // lainnya = 24 jam dari sekarang (PIC approval window).
    const asgn      = allAssignments.find((a: any) => a.id === f.assignment_id);
    const eventDate = asgn?.events?.tanggal_tugas;
    const expiresAt = isTerminal
      ? new Date().toISOString()
      : isOffered && eventDate
        ? new Date(eventDate + 'T23:59:59+07:00').toISOString()   // sampai hari H
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    try {
      // Payload sama untuk insert & update. is_penawaran wajib TRUE saat Offered
      // agar lolos RLS swap_select_board + query loadBoard.
      const payload = {
        requester_id:  f.requester_id,
        assignment_id: f.assignment_id,
        alasan:        f.alasan || 'Dicatat oleh penjadwalan',
        status:        f.status,
        is_penawaran:  isOffered,
        pengganti_id:  f.pengganti_id || null,
        pic_approved_at: (isTerminal || isOffered) ? new Date().toISOString() : null,
        expires_at:    expiresAt,
      };

      // Step 1: UPDATE (mode edit) atau INSERT (mode tambah).
      // Plain write tanpa .select().single() — hindari RLS-on-returning edge-case
      // yang bisa menghasilkan error palsu + modal stuck.
      if (editingId) {
        const { error: updErr } = await supabase.from('swap_requests')
          .update(payload).eq('id', editingId);
        if (updErr) throw new Error(updErr.message);
      } else {
        const { error: insertErr } = await supabase.from('swap_requests')
          .insert({ ...payload, pic_user_id: null, pic_wa_link: '' });
        if (insertErr) throw new Error(insertErr.message);
      }

      // Step 2: Jika Replaced, update assignment ke pengganti
      if (isTerminal && f.pengganti_id) {
        const { error: aErr } = await supabase.from('assignments')
          .update({ user_id: f.pengganti_id })
          .eq('id', f.assignment_id);
        if (aErr) throw new Error('Swap dicatat tapi jadwal gagal diupdate: ' + aErr.message);
      }

      // Step 3: Check-and-balance — verifikasi via SELECT terpisah (tidak blocking UI)
      // Jika SELECT gagal, tetap lanjut (data mungkin ada, hanya timing); board akan refresh.
      if (isOffered) {
        const { data: verify } = await supabase
          .from('swap_requests')
          .select('id, is_penawaran, status')
          .eq('requester_id', f.requester_id)
          .eq('assignment_id', f.assignment_id)
          .eq('status', 'Offered')
          .eq('is_penawaran', true)
          .limit(1)
          .maybeSingle();
        if (!verify) {
          // Data mungkin tersimpan tapi tidak terlihat — refresh dan beri warning.
          // Jangan block UI (modal tetap ditutup di bawah).
          toast('⚠️ Data disimpan, cek papan penawaran untuk konfirmasi', { icon: '⚠️' });
        } else {
          toast.success(editingId ? 'Penawaran diperbarui & muncul di papan!' : 'Tukar jadwal berhasil dicatat & muncul di papan!');
        }
      } else {
        toast.success(editingId ? 'Catatan tukar jadwal diperbarui!' : 'Tukar jadwal berhasil dicatat!');
      }

      // SUCCESS PATH — selalu tutup modal di sini
      closeAdminForm();
      loadData();

    } catch (err: any) {
      // ERROR PATH — tampilkan pesan, modal TETAP OPEN agar user bisa retry atau tekan Batal.
      // Modal yang terbuka = user tahu ada masalah; tidak ada overlay tak kasat mata.
      toast.error(err.message || 'Gagal menyimpan tukar jadwal');
    }
  }

  // Tutup + reset form admin (dipakai success path, tombol Batal, dan tombol Catat Manual).
  function closeAdminForm() {
    setShowAdminForm(false);
    setEditingId(null);
    setAdminForm({ requester_id:'', assignment_id:'', alasan:'', pengganti_id:'', status:'Replaced' });
  }

  // ── Admin: edit penawaran/catatan tukar (reaktif, lewat DB → loadData) ──────
  function editPenawaran(req: any) {
    setEditingId(req.id);
    setAdminForm({
      requester_id:  req.requester_id || '',
      assignment_id: req.assignment_id || '',
      alasan:        req.alasan || '',
      pengganti_id:  req.pengganti_id || '',
      status:        req.status || 'Replaced',
    });
    setShowAdminForm(true);
  }

  // ── Admin: hapus catatan tukar (DELETE → loadData, UI refresh real-time) ────
  async function hapusPenawaran(req: any) {
    if (!confirm(`Hapus catatan tukar jadwal milik ${req.requester?.nama_panggilan || 'anggota ini'}? Tindakan ini permanen.`)) return;
    const { error } = await supabase.from('swap_requests').delete().eq('id', req.id);
    if (error) { toast.error('Gagal hapus: ' + error.message); return; }
    toast.success('Catatan tukar jadwal dihapus');
    loadData();
  }

  // ── Approve / Reject (pengurus) ────────────────────────────
  async function approveRequest(req: any) {
    await supabase.from('swap_requests').update({
      status: 'Approved_PIC', pic_approved_at: new Date().toISOString(),
    }).eq('id', req.id);
    toast.success('Request disetujui');
    loadData();
  }

  async function rejectRequest(req: any) {
    await supabase.from('swap_requests').update({ status: 'Rejected_PIC' }).eq('id', req.id);
    toast.success('Request ditolak');
    loadData();
  }

  async function offerToBoard(req: any) {
    const { data, error } = await supabase.rpc('offer_to_board', { p_request_id: req.id });
    if (error) { toast.error('Gagal: ' + error.message); return; }
    if (!data?.ok) { toast.error(data?.error || 'Gagal menawarkan ke papan'); return; }
    toast.success('Ditawarkan ke papan');
    loadData();
  }

  async function claimFromBoard(req: any) {
    if (!confirm(`Konfirmasi: kamu bersedia menggantikan ${req.requester?.nama_panggilan} untuk tugas ini?`)) return;
    const { data, error } = await supabase.rpc('claim_swap_request', { p_request_id: req.id });
    if (error) { toast.error('Gagal: ' + error.message); return; }
    if (!data?.ok) { toast.error(data?.error || 'Gagal mengklaim tugas'); return; }
    toast.success('Berhasil! Jadwal sudah dipindahkan ke kamu.');
    loadData();
  }

  // ── WA Template untuk grup ─────────────────────────────────
  function getCurrentWeekRange(): { start: string; end: string; label: string } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    // Week: Mon–Sun. If today is Sunday, it's the END of this week.
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysFromMonday);
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + daysUntilSunday);
    const pad = (n: number) => String(n).padStart(2, '0');
    // Use local date parts to avoid UTC offset shifting the date string
    const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const fmtShort = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
    const fmtFull  = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
    return {
      start: toLocal(monday),
      end:   toLocal(sunday),
      label: `${fmtShort(monday)} – ${fmtFull(sunday)}`,
    };
  }

  function buildWATemplate(reqs: any, weekEvents: any[] = [], offeredItems: any[] = []) {
    const { start, end, label } = getCurrentWeekRange();
    const today = todayStr();
    const inWeek = (r: any) => {
      const tgl = r.assignment?.events?.tanggal_tugas?.slice(0, 10);
      return tgl >= start && tgl <= end;
    };
    const replaced = reqs.filter((r: any) => r.status === 'Replaced' && inWeek(r));
    // Offered: semua yang aktif di papan, tanggal_tugas >= hari ini (belum lewat)
    const offered  = offeredItems.filter((r: any) => {
      const tgl = r.assignment?.events?.tanggal_tugas?.slice(0, 10);
      return !tgl || tgl >= today;
    });
    if (!replaced.length && !offered.length && !weekEvents.length) {
      return `🤝 *INFO TUKAR JADWAL*\nMinggu ${label}\n\nTidak ada pertukaran & penawaran aktif saat ini. Sampai jumbo minggu depan! 🙏`;
    }
    const lines = ['🤝 *INFO TUKAR JADWAL*', `Minggu ${label}`, ''];
    if (replaced.length) {
      lines.push('✅ *SUDAH ADA YANG BANTU (terima kasih!)*');
      replaced.forEach((r: any) => {
        const ev   = r.assignment?.events;
        const slot = r.assignment?.slot_number;
        lines.push(`• ${r.requester?.nama_panggilan} dibantu oleh ${r.pengganti?.nama_panggilan||'?'} — ${ev?.perayaan||ev?.nama_event||'?'} (${slotLabel(slot, ev?.tipe_event)}, ${formatDate(effectiveDate(ev?.tanggal_tugas, slot, ev?.tipe_event),'dd MMM')})`);
      });
      lines.push('');
    }
    if (offered.length) {
      lines.push('🙏 *BUTUH BANTUAN — siapa bisa gantikan?*');
      offered.forEach((r: any) => {
        const ev   = r.assignment?.events;
        const slot = r.assignment?.slot_number;
        lines.push(`• ${r.requester?.nama_panggilan} — ${ev?.perayaan||ev?.nama_event||'?'} (${slotLabel(slot, ev?.tipe_event)}, ${formatDate(effectiveDate(ev?.tanggal_tugas, slot, ev?.tipe_event),'dd MMM')})`);
      });
      lines.push('_Kalau bisa bantu, hubungi PIC atau langsung ambil lewat aplikasi. Terima kasih! 😊_');
      lines.push('');
    }
    // PIC per misa dalam range minggu ini
    const picLines: string[] = [];
    weekEvents.forEach((ev: any) => {
      const evName = ev.perayaan || ev.nama_event || '?';
      const pics: any[] = ev.event_pics || [];
      ([1, 2, 3, 4] as const).forEach(slotNum => {
        const slotPics = pics
          .filter((p: any) => p.slot === slotNum)
          .sort((a: any, b: any) => a.urutan - b.urutan);
        if (slotPics.length) {
          const pic = slotPics[0];
          const hp = pic.hp ? ` - ${pic.hp}` : '';
          picLines.push(`• ${evName} (${SLOT_LABELS[slotNum]||'Slot '+slotNum}): ${pic.nama}${hp}`);
        }
      });
    });
    if (picLines.length) {
      lines.push('📞 *HUBUNGI PIC MISA INI*');
      lines.push(...picLines);
    }
    return lines.join('\n');
  }

  const tabs = [
    { key: 'my',    label: 'Request Saya' },
    { key: 'board', label: `Papan Penawaran${board.length ? ` (${board.length})` : ''}` },
    ...(isPengurus ? [{ key: 'all', label: `Semua Request${allReqs.length ? ` (${allReqs.length})` : ''}` }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Tukar Jadwal</h1>
          <p className="page-subtitle">Request · Papan Penawaran · Rekap</p>
        </div>
        <div className="flex gap-2">
          {mySched.length > 0 && (
            <button onClick={() => setShowForm(true)} className="btn-primary gap-2">
              <Plus size={16}/> Request Tukar
            </button>
          )}
          {isPengurus && (
            <>
              <button onClick={() => { closeAdminForm(); setShowAdminForm(true); }} className="btn-outline gap-2">
                <Shield size={16}/> Catat Manual
              </button>
              <button onClick={async () => {
                const { start, end } = getCurrentWeekRange();
                const [{ data: weekEvents }, { data: offeredData }] = await Promise.all([
                  supabase.from('events')
                    .select('id, nama_event, perayaan, tanggal_tugas, event_pics(slot, nama, hp, urutan)')
                    .gte('tanggal_tugas', start)
                    .lte('tanggal_tugas', end)
                    .not('is_draft', 'eq', true)
                    .neq('tipe_event', 'Misa_Harian')
                    .order('tanggal_tugas'),
                  supabase.from('swap_requests')
                    .select(`id, status, is_penawaran,
                      requester:requester_id(nama_panggilan),
                      pengganti:pengganti_id(nama_panggilan),
                      assignment:assignment_id(slot_number, events(nama_event, tanggal_tugas, perayaan, tipe_event))`)
                    .eq('status', 'Offered')
                    .eq('is_penawaran', true),
                ]);
                setWaText(buildWATemplate(allReqs, weekEvents || [], offeredData || []));
                setShowWA(true);
              }} className="btn-outline gap-2">
                <Send size={16}/> WA Rekap
              </button>
            </>
          )}
          <button onClick={loadData} className="btn-ghost p-2"><RefreshCw size={16}/></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.key?'bg-white text-brand-800 shadow-sm':'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB MY REQUESTS ── */}
      {tab === 'my' && (
        <div className="space-y-3">
          {loading ? <div className="skeleton h-24 rounded-xl"/> :
           myReqs.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <ArrowLeftRight size={40} className="mx-auto mb-2 opacity-30"/>
              <p>Belum ada request tukar jadwal</p>
            </div>
          ) : pgMy.paged.map((req: any) => {
            const effStatus = getEffectiveStatus(req);
            const sc = STATUS_CONFIG[effStatus] || {};
            const ev = req.assignment?.events;
            return (
              <div key={req.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`badge ${sc.color}`}>{sc.label}</span>
                      {req.status === 'Pending' && (
                        <span className="text-xs text-orange-500 flex items-center gap-1">
                          <Clock size={11}/> Exp: {formatDate(req.expires_at,'dd MMM HH:mm')}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{ev?.perayaan||ev?.nama_event||'—'}</p>
                    <p className="text-sm text-gray-500">{formatDate(effectiveDate(ev?.tanggal_tugas, req.assignment?.slot_number, ev?.tipe_event),'dd MMM yyyy')} · {slotLabel(req.assignment?.slot_number, ev?.tipe_event)}</p>
                    <p className="text-xs text-gray-400 italic mt-1">"{req.alasan}"</p>
                    {req.pengganti?.nama_panggilan && (
                      <p className="text-xs text-green-600 mt-1">✅ Digantikan: {req.pengganti.nama_panggilan}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {req.status === 'Pending' && req.pic_wa_link && (
                      <a href={req.pic_wa_link} target="_blank" rel="noopener noreferrer"
                        className="btn-primary btn-sm gap-1">
                        <MessageCircle size={13}/> WA PIC
                      </a>
                    )}
                    {req.status === 'Approved_PIC' && (
                      <button onClick={() => offerToBoard(req)} className="btn-outline btn-sm gap-1">
                        <Globe size={13}/> Tawarkan
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {myReqs.length > 0 && <Pagination {...pgMy} onPage={pgMy.goTo} label="request" />}
        </div>
      )}

      {/* ── TAB BOARD ── */}
      {tab === 'board' && (
        <div className="space-y-3">
          {board.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <CheckCircle size={40} className="mx-auto mb-2 opacity-30"/>
              <p>Tidak ada penawaran saat ini</p>
            </div>
          ) : pgBoard.paged.map((req: any) => {
            const ev = req.assignment?.events;
            return (
              <div key={req.id} className="card border-l-4 border-purple-400">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{ev?.perayaan||ev?.nama_event}</p>
                    <p className="text-sm text-gray-500">{formatDate(effectiveDate(ev?.tanggal_tugas, req.assignment?.slot_number, ev?.tipe_event),'EEEE, dd MMM yyyy')} · {slotLabel(req.assignment?.slot_number, ev?.tipe_event)}</p>
                    <p className="text-xs text-gray-400 mt-1">Dari: <strong>{req.requester?.nama_panggilan}</strong> ({req.requester?.lingkungan})</p>
                    <p className="text-xs text-gray-400 italic">"{req.alasan}"</p>
                  </div>
                  <button onClick={() => claimFromBoard(req)} className="btn-primary btn-sm gap-1 flex-shrink-0">
                    <CheckCircle size={13}/> Saya Bersedia
                  </button>
                </div>
              </div>
            );
          })}
          {board.length > 0 && <Pagination {...pgBoard} onPage={pgBoard.goTo} label="penawaran" />}
        </div>
      )}

      {/* ── TAB ALL (PENGURUS) ── */}
      {tab === 'all' && isPengurus && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Anggota</th><th>Jadwal</th><th>Misa</th>
                  <th>Alasan</th><th>Status</th><th>Pengganti</th><th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">Memuat...</td></tr>
                ) : allReqs.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">Belum ada data</td></tr>
                ) : pgAll.paged.map((req: any) => {
                  const effStatus = getEffectiveStatus(req);
                  const sc = STATUS_CONFIG[effStatus] || {};
                  const ev = req.assignment?.events;
                  return (
                    <tr key={req.id}>
                      <td>
                        <div className="font-semibold text-sm">{req.requester?.nama_panggilan}</div>
                        <div className="text-xs text-gray-400">{req.requester?.lingkungan}</div>
                      </td>
                      <td className="text-xs">{ev?.perayaan||ev?.nama_event}<br/>{formatDate(effectiveDate(ev?.tanggal_tugas, req.assignment?.slot_number, ev?.tipe_event),'dd MMM')}</td>
                      <td className="text-xs">{slotLabel(req.assignment?.slot_number, ev?.tipe_event)}</td>
                      <td className="text-xs text-gray-500 max-w-32 truncate">{req.alasan}</td>
                      <td><span className={`badge ${sc.color} text-xs`}>{sc.label}</span></td>
                      <td className="text-xs">{req.pengganti?.nama_panggilan||'—'}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {req.status === 'Pending' && (
                            <>
                              <button onClick={() => approveRequest(req)} className="btn-primary btn-sm text-xs">✓ Approve</button>
                              <button onClick={() => rejectRequest(req)} className="btn-danger btn-sm text-xs">✗ Tolak</button>
                            </>
                          )}
                          {req.status === 'Approved_PIC' && (
                            <button onClick={() => offerToBoard(req)} className="btn-outline btn-sm text-xs">Tawarkan</button>
                          )}
                          <button onClick={() => editPenawaran(req)} title="Edit catatan"
                            className="btn-ghost btn-sm text-xs p-1.5"><Pencil size={13}/></button>
                          <button onClick={() => hapusPenawaran(req)} title="Hapus catatan"
                            className="btn-ghost btn-sm text-xs p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {allReqs.length > 0 && (
            <div className="px-4">
              <Pagination {...pgAll} onPage={pgAll.goTo} label="request" />
            </div>
          )}
        </div>
      )}

      {/* ── FORM: Request sendiri ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="font-bold text-lg mb-4">Request Tukar Jadwal</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Pilih Jadwal yang Ingin Ditukar *</label>
                <select className="input" value={formData.assignment_id}
                  onChange={e => setForm(f => ({...f, assignment_id: e.target.value}))}>
                  <option value="">— Pilih jadwal —</option>
                  {mySched.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.events?.perayaan||s.events?.nama_event} · {slotLabel(s.slot_number, s.events?.tipe_event)} · {formatDate(effectiveDate(s.events?.tanggal_tugas, s.slot_number, s.events?.tipe_event),'dd MMM')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Alasan *</label>
                <textarea className="input h-24 resize-none" value={formData.alasan}
                  onChange={e => setForm(f => ({...f, alasan: e.target.value}))}
                  placeholder="Contoh: ada acara keluarga, sakit, dll."/>
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 mt-4 text-xs text-blue-700">
              Setelah submit → tombol WA PIC muncul → hubungi PIC → setelah deal, tawarkan ke papan jika belum ada pengganti.
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={submitRequest} className="btn-primary flex-1">Submit</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORM: Admin catat manual ── */}
      {showAdminForm && isPengurus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Shield size={18} className="text-brand-800"/> {editingId ? 'Edit Catatan Tukar Jadwal' : 'Catat Tukar Jadwal Manual'}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Anggota yang Minta Tukar *</label>
                  <select className="input" value={adminForm.requester_id}
                    onChange={e => setAdminForm(f=>({...f, requester_id:e.target.value, assignment_id:''}))}>
                    <option value="">— Pilih anggota —</option>
                    {allMembers.map(m => <option key={m.id} value={m.id}>{m.nama_panggilan} (@{m.nickname})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status Akhir *</label>
                  <select className="input" value={adminForm.status}
                    onChange={e => setAdminForm(f=>({...f, status:e.target.value}))}>
                    <option value="Replaced">Tergantikan (sudah ada pengganti)</option>
                    <option value="Offered">Ditawarkan ke papan</option>
                    <option value="Approved_PIC">Disetujui PIC, cari pengganti</option>
                    <option value="Pending">Pending (menunggu PIC)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Jadwal yang Ditukar *</label>
                <select className="input" value={adminForm.assignment_id}
                  onChange={e => setAdminForm(f=>({...f, assignment_id:e.target.value}))}>
                  <option value="">— Pilih jadwal —</option>
                  {allAssignments
                    .filter(a => !adminForm.requester_id || a.user_id === adminForm.requester_id)
                    .map(a => {
                      const isPast = a.events?.tanggal_tugas < new Date().toISOString().split('T')[0];
                      return (
                        <option key={a.id} value={a.id}>
                          {isPast ? '↩ ' : ''}{a.events?.perayaan||a.events?.nama_event} · {slotLabel(a.slot_number, a.events?.tipe_event)} · {formatDate(effectiveDate(a.events?.tanggal_tugas, a.slot_number, a.events?.tipe_event),'dd MMM yyyy')}
                        </option>
                      );
                    })
                  }
                </select>
                {adminForm.requester_id && allAssignments.filter(a => a.user_id === adminForm.requester_id).length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">Anggota ini tidak punya jadwal (coba refresh halaman)</p>
                )}
              </div>

              {adminForm.status === 'Replaced' && (
                <div>
                  <label className="label">Pengganti</label>
                  <select className="input" value={adminForm.pengganti_id}
                    onChange={e => setAdminForm(f=>({...f, pengganti_id:e.target.value}))}>
                    <option value="">— Pilih pengganti —</option>
                    {allMembers.filter((m: any) => m.id !== adminForm.requester_id).map((m: any) => (
                      <option key={m.id} value={m.id}>{m.nama_panggilan} (@{m.nickname})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label">Alasan / Keterangan</label>
                <textarea className="input h-20 resize-none" value={adminForm.alasan}
                  onChange={e => setAdminForm(f=>({...f, alasan:e.target.value}))}
                  placeholder="Contoh: Koordinasi via WA sudah deal"/>
              </div>
            </div>

            {adminForm.status === 'Replaced' && adminForm.requester_id && adminForm.pengganti_id && adminForm.assignment_id && (() => {
              const req = allMembers.find(m => m.id === adminForm.requester_id);
              const peng = allMembers.find(m => m.id === adminForm.pengganti_id);
              const asgn = allAssignments.find(a => a.id === adminForm.assignment_id);
              return (
                <div className="mt-4 p-3 bg-green-50 rounded-xl text-xs text-green-700">
                  Preview: <strong>{req?.nama_panggilan}</strong> tukar dengan <strong>{peng?.nama_panggilan}</strong>
                  {' '}untuk {asgn?.events?.perayaan||asgn?.events?.nama_event} ({slotLabel(asgn?.slot_number, asgn?.events?.tipe_event)})
                </div>
              );
            })()}

            <div className="flex gap-2 mt-5">
              <button onClick={submitAdminSwap} className="btn-primary flex-1 gap-2">
                <Shield size={16}/> {editingId ? 'Simpan Perubahan' : 'Simpan'}
              </button>
              <button onClick={closeAdminForm} className="btn-secondary">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* ── WA Template Grup ── */}
      {showWA && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Template WA Rekap Tukar Jadwal</h3>
              <button onClick={() => setShowWA(false)}><XCircle size={20}/></button>
            </div>
            <textarea
              className="w-full h-80 font-mono text-xs p-3 border border-gray-200 rounded-xl bg-gray-50 resize-none"
              value={waText}
              onChange={e => setWaText(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Teks bisa diedit sebelum dikirim</p>
            {/* Grup WA link */}
            <div className="mt-3 space-y-2">
              <label className="text-xs font-semibold text-gray-600">
                Link Grup WhatsApp (opsional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input text-sm flex-1"
                  placeholder="https://chat.whatsapp.com/XXXXX..."
                  value={grupWA}
                  onChange={e => setGrupWA(e.target.value)}
                />
                <button
                  onClick={() => {
                    if (!grupWA) { toast.error('Masukkan link grup WA dulu'); return; }
                    const link = grupWA.startsWith('http') ? grupWA : ('https://chat.whatsapp.com/' + grupWA);
                    window.open(link, '_blank');
                    setTimeout(() => {
                      navigator.clipboard.writeText(waText);
                      toast.success('Link dibuka & teks disalin ke clipboard!');
                    }, 500);
                  }}
                  className="btn-primary gap-2 whitespace-nowrap transition-all hover:scale-105 active:scale-95">
                  <MessageSquare size={14}/> Kirim ke Grup
                </button>
              </div>
              <p className="text-[10px] text-gray-400">
                💡 Klik "Kirim ke Grup" → grup terbuka di WhatsApp + teks otomatis disalin.
                Paste (tempel) teks di grup WhatsApp. Link grup bisa didapat dari WhatsApp: 
                Grup → Info Grup → Tautan Undangan.
              </p>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => { navigator.clipboard.writeText(waText); toast.success('Disalin!'); }}
                className="btn-outline flex-1 gap-2"><Copy size={15}/> Salin Teks</button>
              <button onClick={() => setShowWA(false)} className="btn-secondary">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
