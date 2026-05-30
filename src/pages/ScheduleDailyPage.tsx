import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { formatDate, getLiturgyClass, LITURGY_COLORS } from '../lib/utils';
import { getLiturgiByDate, getLiturgiByMonth, HARI_RAYA_NO_HARIAN, getFirstFriday } from '../lib/liturgiData2026';
import { LiturgyBadge } from '../components/ui/LiturgyBadge';
import { toPng } from 'html-to-image';
import {
  CalendarDays, Download, Zap, ChevronLeft, ChevronRight,
  Bell, CheckCircle, XCircle, Clock, RefreshCw, Users,
  AlertTriangle, FileEdit, Globe, Check, X, Edit2, Search, Church,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/ui/Pagination';

const WARNA_OPTIONS = ['Hijau','Merah','Putih','Ungu','MerahMuda','Hitam'];
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// ── Liturgical season color (falls back to explicit feast day data) ──
function getLiturgicalSeasonColor(dateStr: string): string {
  const explicit = getLiturgiByDate(dateStr);
  if (explicit?.color) return explicit.color;
  if (dateStr >= '2026-01-01' && dateStr <= '2026-01-11') return 'Putih';   // Natal — Pembaptisan Tuhan
  if (dateStr >= '2026-02-18' && dateStr <= '2026-04-01') return 'Ungu';    // Prapaskah
  if (dateStr >= '2026-04-04' && dateStr <= '2026-05-23') return 'Putih';   // Masa Paskah
  if (dateStr >= '2026-11-29' && dateStr <= '2026-12-24') return 'Ungu';    // Adven
  if (dateStr >= '2026-12-25')                            return 'Putih';   // Natal
  return 'Hijau';
}

function getLiturgicalLabel(dateStr: string, namaHari: string): string {
  const explicit = getLiturgiByDate(dateStr);
  if (explicit?.name) return `${namaHari} — ${explicit.name}`;
  if (dateStr >= '2026-02-18' && dateStr <= '2026-04-01') return `${namaHari} Pekan Prapaskah`;
  if (dateStr >= '2026-04-04' && dateStr <= '2026-05-23') return `${namaHari} Pekan Paskah`;
  if (dateStr >= '2026-11-29' && dateStr <= '2026-12-24') return `${namaHari} Pekan Adven`;
  if (dateStr >= '2026-12-25')                            return `${namaHari} Masa Natal`;
  return namaHari;
}
const HARI   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

function lastDayOfMonth(year: any, month: any) { return new Date(year, month, 0).getDate(); }
function toLocalISO(date: any) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function getWeekdays(year: any, month: any) {
  const days = [];
  const total = lastDayOfMonth(year, month);
  for (let d = 1; d <= total; d++) {
    const date = new Date(year, month - 1, d);
    const dow  = date.getDay();
    if (dow >= 1 && dow <= 5) days.push({ date: toLocalISO(date), dow });
  }
  return days;
}

const OPTIN_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  Bisa:       { label: 'Bisa',       color: 'badge-green',  icon: '✅' },
  Tidak_Bisa: { label: 'Tidak Bisa', color: 'badge-red',    icon: '❌' },
  Pas_Libur:  { label: 'Pas Libur',  color: 'badge-yellow', icon: '🏖️' },
};

// ═══════════════════════════════════════════════════════════════
export function ScheduleDailyPage() {
  const { profile, isPengurus } = useAuth();

  const [tab,      setTab]      = useState('jadwal');
  const [month,    setMonth]    = useState(new Date().getMonth() + 1);
  const [year,     setYear]     = useState(new Date().getFullYear());
  const [events,   setEvents]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [generating, setGen]    = useState(false);

  // Opt-in
  const [myOptin,      setMyOptin]    = useState<any>(null);
  const [optinList,    setOptinList]  = useState<any[]>([]);
  const [loadingOpt,   setLoadingOpt] = useState(false);
  const [editOptinId,  setEditOptinId]= useState<any>(null);  // user_id yang sedang diedit pengurus
  const [searchOptin,  setSearchOptin]= useState('');

  const tableRef = useRef(null);
  const [editModal,    setEditModal]    = useState<{ ev: any; assignments: any[]; pic: any | null } | null>(null);
  const [editFields,   setEditFields]   = useState({ perayaan: '', warna_liturgi: 'Hijau' });
  const [allUsers,     setAllUsers]     = useState<any[]>([]);
  const [picUsers,     setPicUsers]     = useState<any[]>([]);
  const [addUserId,    setAddUserId]    = useState('');
  const [editPicId,    setEditPicId]    = useState('');
  const [savingEdit,   setSavingEdit]   = useState(false);

  // Target bulan opt-in = bulan berikutnya dari bulan yang dipilih
  const nextMonth = month === 12 ? 1  : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;
  const thisDay   = new Date().getDate();
  const isOptinWindow = thisDay >= 10 && thisDay <= 20;

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const padM    = String(month).padStart(2,'0');
    const start   = `${year}-${padM}-01`;
    const lastDay = lastDayOfMonth(year, month);
    const end     = `${year}-${padM}-${String(lastDay).padStart(2,'0')}`;
    const { data, error } = await supabase
      .from('events')
      .select(`*, assignments(user_id, users(nama_lengkap, nama_panggilan, lingkungan, pendidikan)), event_pics(id, slot, nama, hp, urutan)`)
      .eq('tipe_event', 'Misa_Harian')
      .gte('tanggal_tugas', start)
      .lte('tanggal_tugas', end)
      .order('tanggal_tugas');
    if (error) toast.error('Gagal load: ' + error.message);
    setEvents(data || []);
    setLoading(false);
  }, [month, year]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { if (tab === 'optin') loadOptinList(); }, [tab, month, year]);
  useEffect(() => {
    if (!profile) return;
    supabase.from('misa_harian_availability')
      .select('status, tanggal_tidak_bisa')
      .eq('user_id', profile.id)
      .eq('tahun', nextYear).eq('bulan', nextMonth)
      .maybeSingle()
      .then(({ data }: any) => setMyOptin(data));
  }, [profile, nextMonth, nextYear]);

  async function loadOptinList() {
    setLoadingOpt(true);
    const { data: users } = await supabase
      .from('users')
      .select('id, nickname, nama_panggilan, lingkungan, pendidikan, is_tarakanita')
      .eq('status', 'Active').order('nama_panggilan');
    const { data: optins } = await supabase
      .from('misa_harian_availability')
      .select('user_id, status, tanggal_tidak_bisa')
      .eq('tahun', nextYear).eq('bulan', nextMonth);
    const optinMap: Record<string,any> = {};
    (optins || []).forEach((o: any) => { optinMap[o.user_id] = o; });
    setOptinList((users || []).map((u: any) => ({ ...u, optin: optinMap[u.id] || null })));
    setLoadingOpt(false);
  }

  // ── Simpan opt-in (user sendiri) ────────────────────────
  async function saveOptin(status: any) {
    if (!profile) return;
    const { error } = await supabase.from('misa_harian_availability').upsert({
      user_id: profile.id, tahun: nextYear, bulan: nextMonth, status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,tahun,bulan' });
    if (error) { toast.error(error.message); return; }
    setMyOptin({ status });
    toast.success(`Opt-in: ${OPTIN_LABELS[status]?.label}`);
  }

  // ── Edit opt-in oleh Pengurus/Admin untuk user lain ─────
  async function saveOptinForUser(userId: any, status: any) {
    const { error } = await supabase.from('misa_harian_availability').upsert({
      user_id: userId, tahun: nextYear, bulan: nextMonth, status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,tahun,bulan' });
    if (error) { toast.error(error.message); return; }
    // Update local state
    setOptinList((list: any) => list.map((u: any) =>
      u.id === userId ? { ...u, optin: { ...u.optin, status } } : u
    ));
    setEditOptinId(null);
    toast.success('Status opt-in diperbarui');
  }

  // ── Bulk set: set semua yang belum isi ──────────────────
  async function bulkSetOptin(status: any) {
    const belumIsi = optinList.filter((u: any) => !u.optin && !u.is_tarakanita);
    if (!belumIsi.length) { toast('Semua sudah mengisi opt-in'); return; }
    if (!confirm(`Set ${belumIsi.length} anggota yang belum isi ke "${OPTIN_LABELS[status]?.label}"?`)) return;

    const upserts = belumIsi.map((u: any) => ({
      user_id: u.id, tahun: nextYear, bulan: nextMonth, status,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('misa_harian_availability').upsert(upserts, { onConflict: 'user_id,tahun,bulan' });
    if (error) { toast.error(error.message); return; }
    toast.success(`${belumIsi.length} anggota di-set ke ${OPTIN_LABELS[status]?.label}`);
    loadOptinList();
  }

  // ── Edit event (perayaan, warna, petugas, PIC) ──────────
  async function openEdit(ev: any) {
    setEditFields({ perayaan: ev.perayaan || '', warna_liturgi: ev.warna_liturgi || 'Hijau' });
    const pic = (ev.event_pics || []).find((p: any) => p.slot === 1) || null;
    setEditModal({ ev, assignments: ev.assignments || [], pic });
    setEditPicId('');
    const [usersRes, pengurusRes] = await Promise.all([
      allUsers.length ? Promise.resolve({ data: allUsers }) :
        supabase.from('users').select('id, nama_panggilan, nickname, lingkungan').eq('status', 'Active').order('nama_panggilan'),
      picUsers.length ? Promise.resolve({ data: picUsers }) :
        supabase.from('users').select('id, nama_panggilan, hp_anak, hp_ortu').in('role', ['Administrator','Pengurus']).eq('status', 'Active').order('nama_panggilan'),
    ]);
    if (!allUsers.length && usersRes.data) setAllUsers(usersRes.data as any[]);
    if (!picUsers.length && pengurusRes.data) setPicUsers(pengurusRes.data as any[]);
  }

  async function saveEdit() {
    if (!editModal) return;
    setSavingEdit(true);
    const { error } = await supabase.from('events').update({
      perayaan:      editFields.perayaan,
      warna_liturgi: editFields.warna_liturgi,
    }).eq('id', editModal.ev.id);
    setSavingEdit(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Event diperbarui');
    setEditModal(null);
    loadEvents();
  }

  async function removeAssignment(userId: string) {
    if (!editModal) return;
    await supabase.from('assignments').delete()
      .eq('event_id', editModal.ev.id).eq('user_id', userId);
    setEditModal(m => m ? { ...m, assignments: m.assignments.filter((a: any) => a.user_id !== userId) } : null);
  }

  async function addAssignment() {
    if (!editModal || !addUserId) return;
    const pos = editModal.assignments.length + 1;
    const { error } = await supabase.from('assignments').insert({
      event_id: editModal.ev.id, user_id: addUserId, slot_number: 1, position: pos,
    });
    if (error) { toast.error(error.message); return; }
    const user = allUsers.find(u => u.id === addUserId);
    setEditModal(m => m ? { ...m, assignments: [...m.assignments, { user_id: addUserId, users: user }] } : null);
    setAddUserId('');
  }

  // ── Individual publish / unpublish ──────────────────────
  async function togglePublish(ev: any) {
    const goPublish = ev.is_draft;
    const { error } = await supabase.from('events').update({
      is_draft: !goPublish,
      ...(goPublish ? { published_at: new Date().toISOString() } : {}),
    }).eq('id', ev.id);
    if (error) { toast.error(error.message); return; }
    toast.success(goPublish ? 'Published ✅' : 'Dikembalikan ke Draft');
    loadEvents();
  }

  // ── Fix liturgi: force-recalculate warna + perayaan ────
  async function fixLiturgi() {
    if (!events.length) return;
    if (!confirm(`Recalculate warna liturgi & perayaan untuk semua ${events.length} event ${MONTHS[month-1]} ${year}?`)) return;
    const tid = 'fix-liturgi';
    toast.loading(`Memperbarui 0 / ${events.length}...`, { id: tid });
    let updated = 0, failed = 0;
    for (let i = 0; i < events.length; i++) {
      const ev          = events[i];
      const d           = new Date(ev.tanggal_tugas + 'T00:00:00');
      const namaHari    = HARI[d.getDay()];
      const newWarna    = getLiturgicalSeasonColor(ev.tanggal_tugas);
      const newPerayaan = getLiturgicalLabel(ev.tanggal_tugas, namaHari);
      const { error }   = await supabase.from('events')
        .update({ warna_liturgi: newWarna, perayaan: newPerayaan })
        .eq('id', ev.id);
      if (error) { failed++; console.error('fixLiturgi', ev.tanggal_tugas, error.message); }
      else updated++;
      toast.loading(`Memperbarui ${i + 1} / ${events.length}...`, { id: tid });
    }
    if (failed) toast.error(`${failed} gagal (cek console). ${updated} berhasil.`, { id: tid, duration: 5000 });
    else toast.success(`${updated} event diperbarui ✅`, { id: tid, duration: 4000 });
    loadEvents();
  }

  // ── Hapus semua Misa Harian bulan ini ───────────────────
  async function deleteAllHarian() {
    if (!events.length) { toast('Tidak ada event untuk dihapus'); return; }
    if (!confirm(`⚠️ HAPUS SEMUA ${events.length} event Misa Harian ${MONTHS[month-1]} ${year}?\nTermasuk semua petugas & PIC. Tidak bisa dibatalkan!`)) return;
    const ids = events.map((e: any) => e.id);
    await supabase.from('assignments').delete().in('event_id', ids);
    await supabase.from('event_pics').delete().in('event_id', ids);
    const { error } = await supabase.from('events').delete().in('id', ids);
    if (error) { toast.error('Gagal hapus: ' + error.message); return; }
    toast.success(`${ids.length} event dihapus`);
    loadEvents();
  }

  // ── Set / remove PIC via modal ───────────────────────────
  async function savePIC() {
    if (!editModal || !editPicId) return;
    const user = picUsers.find((u: any) => u.id === editPicId);
    if (!user) return;
    await supabase.from('event_pics').delete().eq('event_id', editModal.ev.id).eq('slot', 1);
    const { error } = await supabase.from('event_pics').insert({
      event_id: editModal.ev.id, slot: 1,
      nama:     user.nama_panggilan,
      hp:       user.hp_anak || user.hp_ortu || null,
      urutan:   1,
    });
    if (error) { toast.error(error.message); return; }
    setEditModal(m => m ? { ...m, pic: { slot: 1, nama: user.nama_panggilan, hp: user.hp_anak || user.hp_ortu || null } } : null);
    setEditPicId('');
    toast.success('PIC diperbarui');
  }

  async function removePIC() {
    if (!editModal) return;
    await supabase.from('event_pics').delete().eq('event_id', editModal.ev.id).eq('slot', 1);
    setEditModal(m => m ? { ...m, pic: null } : null);
    toast.success('PIC dihapus');
  }

  // ── Export Excel ────────────────────────────────────────
  function exportExcel() {
    const rows = events.map(ev => {
      const d       = new Date(ev.tanggal_tugas + 'T00:00:00');
      const petugas = (ev.assignments || []).map((a: any) => a.users?.nama_panggilan).filter(Boolean).join(', ');
      const pic     = (ev.event_pics || []).find((p: any) => p.slot === 1);
      return {
        Tanggal:        ev.tanggal_tugas,
        Hari:           HARI[d.getDay()],
        'Nama Perayaan': ev.perayaan || '',
        'Warna Liturgi': ev.warna_liturgi || '',
        PIC:            pic?.nama || '',
        Petugas:        petugas || '(kosong)',
        Status:         ev.is_draft ? 'Draft' : 'Published',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 40 }, { wch: 14 }, { wch: 30 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jadwal Harian');
    XLSX.writeFile(wb, `jadwal-harian-${MONTHS[month-1]}-${year}.xlsx`);
    toast.success('Excel berhasil diunduh!');
  }

  // ── Generate Jadwal Harian ───────────────────────────────
  async function generateHarian() {
    setGen(true);
    const tid = 'gen-harian';
    try {
      toast.loading('Mengambil pool peserta...', { id: tid });
      const [{ data: optins }, { data: tarakanita }, { data: pengurusPool }] = await Promise.all([
        supabase.from('misa_harian_availability')
          .select('user_id, status, tanggal_tidak_bisa')
          .eq('tahun', year).eq('bulan', month)
          .in('status', ['Bisa', 'Pas_Libur']),
        supabase.from('users')
          .select('id, nickname, nama_panggilan, lingkungan, pendidikan')
          .eq('is_tarakanita', true).eq('status', 'Active').eq('is_suspended', false)
          .in('role', ['Misdinar_Aktif','Misdinar_Retired']),
        supabase.from('users')
          .select('id, nama_panggilan, hp_anak, hp_ortu')
          .in('role', ['Administrator','Pengurus'])
          .eq('status', 'Active').order('nama_panggilan'),
      ]);
      const { data: optinUsers } = optins?.length
        ? await supabase.from('users')
            .select('id, nickname, nama_panggilan, lingkungan, pendidikan')
            .in('id', optins.map((o: any) => o.user_id))
            .eq('status', 'Active').eq('is_suspended', false)
        : { data: [] };

      const poolMap: Record<string,any> = {};
      [...(tarakanita||[]), ...(optinUsers||[])].forEach((u: any) => { poolMap[u.id] = u; });
      const pool = Object.values(poolMap);
      if (!pool.length) {
        toast.error('Pool kosong! Tidak ada yang opt-in atau Tarakanita.', { id: tid }); return;
      }
      const tidakBisaMap: Record<string,any> = {};
      (optins||[]).forEach((o: any) => { if (o.tanggal_tidak_bisa) tidakBisaMap[o.user_id] = o.tanggal_tidak_bisa; });

      const weekdays = getWeekdays(year, month);
      toast.loading(`Generate ${weekdays.length} hari (${pool.length} petugas, ${pengurusPool?.length || 0} PIC)...`, { id: tid });
      const firstFriday = getFirstFriday(year, month);
      let poolIdx = 0, picIdx = 0, created = 0, skipped = 0;

      for (const { date, dow } of weekdays) {
        if (HARI_RAYA_NO_HARIAN.includes(date)) { skipped++; continue; }
        if (date === firstFriday) { skipped++; continue; } // Jumat Pertama → masuk mingguan
        const { data: existing } = await supabase.from('events')
          .select('id').eq('tipe_event','Misa_Harian').eq('tanggal_tugas', date).maybeSingle();
        if (existing) continue;

        const namaHari = HARI[dow];
        const perayaan = getLiturgicalLabel(date, namaHari);
        const warna    = getLiturgicalSeasonColor(date);

        const { data: ev, error: evErr } = await supabase.from('events').insert({
          nama_event:     perayaan.toUpperCase(),
          tipe_event:     'Misa_Harian',
          tanggal_tugas:  date,
          hari:           namaHari,
          perayaan,
          warna_liturgi:  warna,
          jumlah_misa:    1,
          status_event:   'Akan_Datang',
          is_draft:       true,
          gcatholic_fetched: true,
        }).select().single();
        if (evErr) { console.error(evErr.message); continue; }

        const available = pool.filter(u => !(tidakBisaMap[u.id]||[]).includes(date));
        const count     = Math.min(2, available.length);
        const assigns   = [];
        for (let i = 0; i < count; i++) {
          const u = available[poolIdx % available.length];
          poolIdx++;
          assigns.push({ event_id: ev.id, user_id: u.id, slot_number: 1, position: i+1 });
        }
        if (assigns.length) await supabase.from('assignments').insert(assigns);

        // Assign PIC from Pengurus pool (rotating)
        if (pengurusPool?.length) {
          const pic = pengurusPool[picIdx % pengurusPool.length];
          picIdx++;
          await supabase.from('event_pics').insert({
            event_id: ev.id, slot: 1,
            nama:     pic.nama_panggilan,
            hp:       pic.hp_anak || pic.hp_ortu || null,
            urutan:   1,
          });
        }
        created++;
      }

      toast.success(
        `✅ ${created} event dibuat${skipped ? `, ${skipped} hari raya diskip` : ''}!`,
        { id: tid, duration: 5000 }
      );
      loadEvents();
    } catch (err: any) {
      toast.error('Gagal: ' + (err as any).message, { id: tid });
    } finally { setGen(false); }
  }

  async function publishAllHarian() {
    const drafts = events.filter(e => e.is_draft);
    if (!drafts.length) { toast('Tidak ada draft'); return; }
    if (!confirm(`Publish ${drafts.length} event Misa Harian?`)) return;
    const { error } = await supabase.from('events')
      .update({ is_draft: false, published_at: new Date().toISOString() })
      .in('id', drafts.map(e => e.id));
    if (error) { toast.error(error.message); return; }
    toast.success(`${drafts.length} jadwal dipublish! ✅`);
    loadEvents();
  }

  async function exportPNG() {
    if (!tableRef.current) return;
    try {
      const png = await toPng(tableRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.href = png; a.download = `jadwal-harian-${MONTHS[month-1]}-${year}.png`; a.click();
      toast.success('PNG berhasil diunduh!');
    } catch (e: any) { toast.error('Gagal export'); }
  }

  const draftCount = events.filter(e => e.is_draft).length;
  const pubCount   = events.filter(e => !e.is_draft).length;

  const optinStats = {
    bisa:      optinList.filter((u: any) => u.optin?.status === 'Bisa').length,
    tidakBisa: optinList.filter((u: any) => u.optin?.status === 'Tidak_Bisa').length,
    pasLibur:  optinList.filter((u: any) => u.optin?.status === 'Pas_Libur').length,
    belumIsi:  optinList.filter((u: any) => !u.optin && !u.is_tarakanita).length,
    tarakanita:optinList.filter((u: any) => u.is_tarakanita).length,
  };

  const filteredOptin = optinList.filter((u: any) =>
    !searchOptin ||
    u.nama_panggilan?.toLowerCase().includes(searchOptin.toLowerCase()) ||
    u.nickname?.toLowerCase().includes(searchOptin.toLowerCase()) ||
    u.lingkungan?.toLowerCase().includes(searchOptin.toLowerCase())
  );
  const pgOptin = usePagination(filteredOptin, 20);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Misa Harian</h1>
          <p className="page-subtitle">Senin–Jumat · Opt-in · Generate Manual</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button onClick={() => { if(month===1){setMonth(12);setYear(y=>y-1);}else setMonth(m=>m-1); }} className="btn-ghost p-2"><ChevronLeft size={18}/></button>
          <span className="font-semibold text-gray-700 w-36 text-center">{MONTHS[month-1]} {year}</span>
          <button onClick={() => { if(month===12){setMonth(1);setYear(y=>y+1);}else setMonth(m=>m+1); }} className="btn-ghost p-2"><ChevronRight size={18}/></button>
          {isPengurus && (
            <>
              <button onClick={loadEvents} className="btn-ghost p-2" title="Refresh"><RefreshCw size={16}/></button>
              <button onClick={generateHarian} disabled={generating} className="btn-primary gap-2">
                <Zap size={16}/> {generating ? 'Generating...' : 'Generate Harian'}
              </button>
              {events.length > 0 && (
                <button onClick={fixLiturgi} className="btn-outline gap-2" title="Recalculate warna liturgi & perayaan">
                  <RefreshCw size={15}/> Fix Liturgi
                </button>
              )}
              {events.length > 0 && (
                <button onClick={deleteAllHarian} className="btn-danger gap-2">
                  <X size={15}/> Hapus Semua
                </button>
              )}
              {draftCount > 0 && (
                <button onClick={publishAllHarian} className="btn-outline gap-2">
                  <Globe size={16}/> Publish ({draftCount})
                </button>
              )}
              {events.length > 0 && (
                <div className="flex gap-1">
                  <button onClick={exportPNG} className="btn-outline gap-1 text-xs px-3"><Download size={14}/> PNG</button>
                  <button onClick={exportExcel} className="btn-outline gap-1 text-xs px-3"><Download size={14}/> Excel</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'jadwal', label: '📅 Jadwal' },
          { key: 'optin',  label: `👥 Opt-in ${MONTHS[nextMonth-1]}` +
            (optinStats.belumIsi > 0 ? ` (${optinStats.belumIsi} belum)` : '') },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.key?'bg-white text-brand-800 shadow-sm':'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB JADWAL ─── */}
      {tab === 'jadwal' && (
        <>
          {events.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              {draftCount > 0 && <div className="badge-yellow flex items-center gap-1.5 px-3 py-1.5"><FileEdit size={13}/>{draftCount} draft</div>}
              {pubCount > 0  && <div className="badge-green flex items-center gap-1.5 px-3 py-1.5"><Globe size={13}/>{pubCount} published</div>}
            </div>
          )}
          {!isPengurus && isOptinWindow && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
              <Bell size={18} className="text-blue-600 flex-shrink-0"/>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800">Isi Opt-in {MONTHS[nextMonth-1]} {nextYear}</p>
                <p className="text-xs text-blue-600">
                  Status: {myOptin ? <strong>{OPTIN_LABELS[myOptin.status]?.label}</strong> : <strong className="text-red-500">Belum diisi</strong>}
                </p>
              </div>
              <div className="flex gap-2">
                {['Bisa','Tidak_Bisa','Pas_Libur'].map(s => (
                  <button key={s} onClick={() => saveOptin(s)}
                    className={`btn-sm ${myOptin?.status===s ? 'btn-primary' : 'btn-outline'}`}>
                    {OPTIN_LABELS[s]?.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {profile?.is_tarakanita && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-blue-600"/>
              <p className="text-sm text-blue-700">Kamu Tarakanita — otomatis masuk pool Misa Harian.</p>
            </div>
          )}

          <div className="card overflow-hidden p-0" ref={tableRef}>
            <div className="px-4 py-3 bg-brand-800 text-white">
              <p className="font-bold text-center text-lg tracking-wide">JADWAL MISA HARIAN — {MONTHS[month-1].toUpperCase()} {year}</p>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-400">Memuat...</div>
              ) : events.length === 0 ? (
                <div className="p-10 text-center">
                  <CalendarDays size={40} className="mx-auto text-gray-300 mb-3"/>
                  <p className="text-gray-500">Belum ada jadwal Misa Harian {MONTHS[month-1]} {year}</p>
                  {isPengurus && (
                    <button onClick={generateHarian} disabled={generating} className="btn-primary mt-4 gap-2">
                      <Zap size={16}/> Generate Sekarang
                    </button>
                  )}
                </div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Tgl</th><th>Hari</th><th>Warna</th>
                      <th>Perayaan</th><th>PIC</th><th>Petugas</th><th>Lingkungan</th><th>Status</th>
                      {isPengurus && <th>Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(ev => {
                      const lc    = getLiturgyClass(ev.warna_liturgi);
                      const asgns = ev.assignments || [];
                      const d     = new Date(ev.tanggal_tugas + 'T00:00:00');
                      const rs    = Math.max(asgns.length, 1);
                      const statusBadge = ev.is_draft
                        ? <span className="badge-yellow text-xs">Draft</span>
                        : <span className="badge-green text-xs">Published</span>;
                      const actionCell = isPengurus && (
                        <td rowSpan={rs} className="whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => openEdit(ev)}
                              className="btn-ghost btn-sm gap-1 text-xs py-1"
                              title="Edit">
                              <Edit2 size={12}/> Edit
                            </button>
                            <button
                              onClick={() => togglePublish(ev)}
                              className={`btn-sm gap-1 text-xs py-1 ${ev.is_draft ? 'btn-outline' : 'btn-ghost text-gray-400'}`}
                              title={ev.is_draft ? 'Publish' : 'Kembalikan ke Draft'}>
                              {ev.is_draft ? <><Globe size={12}/> Publish</> : <><FileEdit size={12}/> Draft</>}
                            </button>
                          </div>
                        </td>
                      );

                      const pic = (ev.event_pics || []).find((p: any) => p.slot === 1);
                      const picCell = (
                        <td rowSpan={rs} className="text-xs">
                          {pic ? (
                            pic.hp
                              ? <a href={`https://wa.me/${pic.hp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                                  className="text-green-700 hover:underline font-medium">{pic.nama}</a>
                              : <span className="font-medium text-gray-700">{pic.nama}</span>
                          ) : <span className="text-gray-300 italic">—</span>}
                        </td>
                      );

                      if (!asgns.length) return (
                        <tr key={ev.id} className={lc.bg}>
                          <td className={`font-bold ${lc.text}`}>{formatDate(ev.tanggal_tugas,'dd')}</td>
                          <td>{HARI[d.getDay()]}</td>
                          <td><div className="flex items-center gap-1"><div className={`w-3 h-3 rounded-full ${lc.dot}`}/><span className="text-xs">{ev.warna_liturgi}</span></div></td>
                          <td className="text-xs">{ev.perayaan||'—'}</td>
                          {picCell}
                          <td className="text-orange-400 text-xs italic">Kosong</td>
                          <td>—</td>
                          <td>{statusBadge}</td>
                          {actionCell}
                        </tr>
                      );
                      return asgns.map((a: any, i: any) => (
                        <tr key={`${ev.id}-${i}`} className={lc.bg}>
                          {i===0 && <>
                            <td rowSpan={rs} className={`font-bold ${lc.text}`}>{formatDate(ev.tanggal_tugas,'dd')}</td>
                            <td rowSpan={rs}>{HARI[d.getDay()]}</td>
                            <td rowSpan={rs}><div className="flex items-center gap-1"><div className={`w-3 h-3 rounded-full ${lc.dot}`}/><span className="text-xs">{ev.warna_liturgi}</span></div></td>
                            <td rowSpan={rs} className="text-xs">{ev.perayaan||'—'}</td>
                            {picCell}
                          </>}
                          <td className="font-medium text-sm">{a.users?.nama_panggilan||'—'}</td>
                          <td className="text-xs text-gray-500">{a.users?.lingkungan||'—'}</td>
                          {i===0 && <td rowSpan={rs}>{statusBadge}</td>}
                          {i===0 && actionCell}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── Edit Modal ─── */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">Edit Misa Harian</h3>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(editModal.ev.tanggal_tugas, 'EEEE, dd MMMM yyyy')}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Perayaan */}
              <div>
                <label className="label">Nama Perayaan</label>
                <input
                  className="input"
                  value={editFields.perayaan}
                  onChange={e => setEditFields(f => ({ ...f, perayaan: e.target.value }))}
                  placeholder="cth. Senin Pekan Prapaskah II"
                />
              </div>
              {/* Warna Liturgi */}
              <div>
                <label className="label">Warna Liturgi</label>
                <div className="grid grid-cols-3 gap-2">
                  {WARNA_OPTIONS.map(w => {
                    const cls = LITURGY_COLORS[w];
                    return (
                      <button
                        key={w}
                        onClick={() => setEditFields(f => ({ ...f, warna_liturgi: w }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                          editFields.warna_liturgi === w
                            ? 'border-brand-800 bg-brand-50 font-semibold'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${cls?.dot}`}/>
                        <span>{cls?.label || w}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Petugas */}
              <div>
                <label className="label">Petugas ({editModal.assignments.length})</label>
                <div className="space-y-1.5 mb-3">
                  {editModal.assignments.length === 0 && (
                    <p className="text-sm text-gray-400 italic">Belum ada petugas</p>
                  )}
                  {editModal.assignments.map((a: any) => (
                    <div key={a.user_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-sm font-medium">{a.users?.nama_panggilan || a.user_id}</span>
                        {a.users?.lingkungan && <span className="text-xs text-gray-400 ml-2">· {a.users.lingkungan}</span>}
                      </div>
                      <button onClick={() => removeAssignment(a.user_id)} className="p-1 text-red-400 hover:text-red-600 rounded">
                        <X size={14}/>
                      </button>
                    </div>
                  ))}
                </div>
                {/* Add user */}
                <div className="flex gap-2">
                  <select
                    className="input flex-1 text-sm"
                    value={addUserId}
                    onChange={e => setAddUserId(e.target.value)}
                  >
                    <option value="">Tambah petugas...</option>
                    {allUsers
                      .filter(u => !editModal.assignments.some((a: any) => a.user_id === u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.nama_panggilan} — {u.lingkungan}</option>
                      ))
                    }
                  </select>
                  <button onClick={addAssignment} disabled={!addUserId} className="btn-primary btn-sm px-4">
                    Tambah
                  </button>
                </div>
              </div>
              {/* PIC Pengurus */}
              <div>
                <label className="label">PIC Pengurus</label>
                {editModal.pic ? (
                  <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2 mb-2">
                    <div>
                      <span className="text-sm font-medium text-blue-800">{editModal.pic.nama}</span>
                      {editModal.pic.hp && <span className="text-xs text-blue-500 ml-2">· {editModal.pic.hp}</span>}
                    </div>
                    <button onClick={removePIC} className="p-1 text-red-400 hover:text-red-600 rounded">
                      <X size={14}/>
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic mb-2">Belum ada PIC</p>
                )}
                <div className="flex gap-2">
                  <select
                    className="input flex-1 text-sm"
                    value={editPicId}
                    onChange={e => setEditPicId(e.target.value)}
                  >
                    <option value="">{editModal.pic ? 'Ganti PIC...' : 'Set PIC...'}</option>
                    {picUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.nama_panggilan}</option>
                    ))}
                  </select>
                  <button onClick={savePIC} disabled={!editPicId} className="btn-primary btn-sm px-4">
                    Set
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setEditModal(null)} className="btn-outline flex-1">Batal</button>
              <button onClick={saveEdit} disabled={savingEdit} className="btn-primary flex-1">
                {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB OPT-IN ─── */}
      {tab === 'optin' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Rekap Opt-in Misa Harian — {MONTHS[nextMonth-1]} {nextYear}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                {isOptinWindow ? '🟢 Window opt-in SEDANG BUKA (tgl 10–20).' : '🔴 Window opt-in sedang tutup.'}
                {isPengurus && ' Admin/Penjadwalan dapat mengubah status secara manual.'}
              </p>
            </div>
            <button onClick={loadOptinList} className="btn-ghost p-1.5 flex-shrink-0"><RefreshCw size={14}/></button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: 'Total Aktif',  value: optinList.length,        color: 'bg-gray-50',   text: 'text-gray-700' },
              { label: 'Bisa',         value: optinStats.bisa,         color: 'bg-green-50',  text: 'text-green-700' },
              { label: 'Tidak Bisa',   value: optinStats.tidakBisa,    color: 'bg-red-50',    text: 'text-red-700' },
              { label: 'Pas Libur',    value: optinStats.pasLibur,     color: 'bg-yellow-50', text: 'text-yellow-700' },
              { label: 'Belum Isi',    value: optinStats.belumIsi,     color: 'bg-orange-50', text: 'text-orange-700' },
              { label: 'Tarakanita',   value: optinStats.tarakanita,   color: 'bg-blue-50',   text: 'text-blue-700' },
            ].map(s => (
              <div key={s.label} className={`card ${s.color} border-0 text-center p-3`}>
                <div className={`text-2xl font-black ${s.text}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Opt-in sendiri (non-pengurus) */}
          {!isPengurus && (
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-3">Status Opt-in Kamu — {MONTHS[nextMonth-1]} {nextYear}</h3>
              <div className="flex gap-3 flex-wrap">
                {['Bisa','Tidak_Bisa','Pas_Libur'].map(s => (
                  <button key={s} onClick={() => saveOptin(s)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${myOptin?.status===s ? 'border-brand-800 bg-brand-50 font-bold' : 'border-gray-200 hover:border-brand-400'}`}>
                    <span>{OPTIN_LABELS[s]?.icon}</span>
                    <span className="text-sm">{OPTIN_LABELS[s]?.label}</span>
                    {myOptin?.status===s && <Check size={14} className="text-brand-800"/>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tabel rekap + edit (pengurus) */}
          {isPengurus && (
            <div className="card overflow-hidden p-0">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    <Users size={16} className="text-brand-800"/>
                    Daftar Opt-in Anggota
                    <span className="text-xs text-gray-400 font-normal">— klik status untuk ubah</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    {/* Bulk set untuk yang belum isi */}
                    {optinStats.belumIsi > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">{optinStats.belumIsi} belum isi, set ke:</span>
                        {['Bisa','Tidak_Bisa'].map(s => (
                          <button key={s} onClick={() => bulkSetOptin(s)}
                            className="btn-outline btn-sm text-xs">
                            {OPTIN_LABELS[s]?.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                      <input className="input pl-8 text-sm w-44" placeholder="Cari nama..."
                        value={searchOptin} onChange={e => setSearchOptin(e.target.value)}/>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                {loadingOpt ? (
                  <div className="p-8 text-center text-gray-400">Memuat...</div>
                ) : (
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Nama</th><th>Lingkungan</th><th>Pendidikan</th>
                        <th>Status Opt-in</th><th>Ubah Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pgOptin.paged.map((u: any) => {
                        const optin = u.optin;
                        const isEditing = editOptinId === u.id;
                        return (
                          <tr key={u.id}>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{u.nama_panggilan}</span>
                                {u.is_tarakanita && <span className="badge-blue text-[10px]">T</span>}
                              </div>
                              <div className="text-xs text-gray-400">@{u.nickname}</div>
                            </td>
                            <td className="text-sm text-gray-600">{u.lingkungan}</td>
                            <td><span className="badge-gray">{u.pendidikan||'—'}</span></td>
                            <td>
                              {u.is_tarakanita ? (
                                <span className="badge-blue flex items-center gap-1 w-fit text-xs">
                                  <CheckCircle size={11}/> Otomatis
                                </span>
                              ) : optin ? (
                                <span className={`badge ${OPTIN_LABELS[optin.status]?.color} text-xs`}>
                                  {OPTIN_LABELS[optin.status]?.icon} {OPTIN_LABELS[optin.status]?.label}
                                </span>
                              ) : (
                                <span className="text-xs text-orange-500 flex items-center gap-1">
                                  <AlertTriangle size={11}/> Belum isi
                                </span>
                              )}
                            </td>
                            <td>
                              {u.is_tarakanita ? (
                                <span className="text-xs text-gray-400">—</span>
                              ) : !isEditing ? (
                                <button onClick={() => setEditOptinId(u.id)}
                                  className="btn-ghost btn-sm gap-1 text-xs">
                                  <Edit2 size={12}/> Ubah
                                </button>
                              ) : (
                                <div className="flex gap-1 items-center flex-wrap">
                                  {['Bisa','Tidak_Bisa','Pas_Libur'].map(s => (
                                    <button key={s}
                                      onClick={() => saveOptinForUser(u.id, s)}
                                      className={`btn-sm text-xs px-2 py-1 rounded-lg border transition-all ${optin?.status===s ? 'bg-brand-800 text-white border-brand-800' : 'border-gray-300 hover:border-brand-800'}`}>
                                      {OPTIN_LABELS[s]?.label}
                                    </button>
                                  ))}
                                  <button onClick={() => setEditOptinId(null)} className="btn-ghost p-1">
                                    <X size={12}/>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              {!loadingOpt && filteredOptin.length > 0 && (
                <div className="px-4">
                  <Pagination {...pgOptin} onPage={pgOptin.goTo} label="anggota" />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Public Schedule ────────────────────────────────────────
const SLOT_INFO_PUB: Record<number, { label: string; jam: string }> = {
  1: { label: 'Sabtu Sore',     jam: '17.30' },
  2: { label: 'Minggu Pagi I',  jam: '06.00' },
  3: { label: 'Minggu Pagi II', jam: '08.00' },
  4: { label: 'Minggu Sore',    jam: '17.30' },
};
const LITURGY_BORDER: Record<string, string> = {
  Hijau:     'border-green-500',
  Merah:     'border-red-600',
  Putih:     'border-amber-400',
  Ungu:      'border-purple-500',
  MerahMuda: 'border-pink-400',
  Hitam:     'border-gray-600',
};

function parseSlotSchedPub(draftNote: string | null, fallback: string) {
  if (!draftNote) return [];
  return draftNote.split('|').map(part => {
    const m = part.trim().match(/Slot\s+(\d+):\s*([\d.]+)(?:\|(\d{4}-\d{2}-\d{2}))?/i);
    if (!m) return null;
    return { slot: Number(m[1]), jam: m[2] || '07.00', tanggal: m[3] || fallback };
  }).filter(Boolean) as { slot: number; jam: string; tanggal: string }[];
}

export function PublicSchedulePage({ internal = false }: { internal?: boolean }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoad]  = useState(true);

  useEffect(() => {
    // Use SECURITY DEFINER RPC so member names show for unauthenticated (mobile) visitors
    supabase.rpc('get_public_schedule')
      .then(({ data, error }: any) => {
        if (!error && Array.isArray(data)) setEvents(data);
        else if (!error && data) setEvents(data as any[]);
        setLoad(false);
      });
  }, []);

  const HARI_PUB = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

  function renderEventCard(ev: any) {
    const lc           = getLiturgyClass(ev.warna_liturgi);
    const isMK         = ev.tipe_event === 'Misa_Khusus';
    const nSlots       = isMK ? (ev.jumlah_misa || 1) : 4;
    const asgn         = ev.assignments || [];
    const pics         = ev.event_pics  || [];
    const borderCls    = LITURGY_BORDER[ev.warna_liturgi] || 'border-green-500';
    const slotSched    = isMK ? parseSlotSchedPub(ev.draft_note, ev.tanggal_tugas) : [];
    const pelatihNicks = (ev.event_pelatih || [])
      .sort((a: any, b: any) => a.urutan - b.urutan)
      .map((p: any) => p.nama).filter(Boolean);
    const latihanJam  = ev.latihan_times?.length ? ev.latihan_times[0] : (ev.latihan_notes?.trim() || '');
    const latihanHari = ev.tanggal_latihan
      ? HARI_PUB[new Date(ev.tanggal_latihan + 'T00:00:00').getDay()]
      : 'Sabtu';

    const gridCls = nSlots <= 2 ? 'grid-cols-2'
                  : nSlots === 3 ? 'grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-4';

    return (
      <div key={ev.id} className={`${internal ? 'card' : 'bg-white rounded-2xl shadow-sm p-5'} border-l-4 ${borderCls}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${lc.dot}`}/>
              <h3 className="font-bold text-gray-900 text-base">{ev.perayaan || ev.nama_event}</h3>
            </div>
            <p className="text-sm text-gray-500 mt-0.5 ml-[18px]">
              {ev.tanggal_latihan
                ? `${formatDate(ev.tanggal_latihan, 'dd MMM')} – ${formatDate(ev.tanggal_tugas, 'dd MMM yyyy')}`
                : formatDate(ev.tanggal_tugas, 'EEEE, dd MMMM yyyy')}
            </p>
            {ev.tanggal_latihan && !ev.tanpa_latihan && (
              <p className="text-xs text-teal-600 mt-0.5 ml-[18px]">
                🏃 Latihan: {latihanHari}{latihanJam ? ` (${latihanJam})` : ''}
              </p>
            )}
          </div>
          <LiturgyBadge warna={ev.warna_liturgi} className="flex-shrink-0"/>
        </div>

        {/* Slot columns grid */}
        <div className={`grid gap-3 ${gridCls}`}>
          {Array.from({ length: nSlots }, (_, i) => i + 1).map(slot => {
            const people   = asgn.filter((a: any) => a.slot_number === slot);
            const slotPics = pics.filter((p: any) => p.slot === slot).sort((a: any, b: any) => a.urutan - b.urutan);
            const picNames = slotPics.map((p: any) => p.nama).join(' & ') || null;
            const hpA      = slotPics[0]?.hp || null;

            let jamLabel: string;
            let tglLabel: string;
            if (isMK) {
              const sc = slotSched.find(s => s.slot === slot);
              jamLabel = `Misa ${slot} · ${sc?.jam || '07.00'}`;
              tglLabel = sc?.tanggal ? formatDate(sc.tanggal, 'EEEE, dd MMM') : '';
            } else {
              jamLabel = SLOT_INFO_PUB[slot]?.label || `Slot ${slot}`;
              tglLabel = slot === 1 && ev.tanggal_latihan
                ? formatDate(ev.tanggal_latihan, 'EEEE, dd MMM')
                : formatDate(ev.tanggal_tugas, 'EEEE, dd MMM');
            }

            return (
              <div key={slot} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="pb-2 border-b border-gray-200/70">
                  <p className="text-xs font-bold text-gray-700">{jamLabel}</p>
                  <p className="text-[10px] text-gray-500">{tglLabel}</p>
                  {picNames ? (
                    <div className="mt-1">
                      <p className="text-[11px] text-brand-700 flex items-center gap-1">
                        👤 PIC: {picNames}
                      </p>
                      {hpA && (
                        <p className="text-[10px] text-gray-400 ml-3.5">
                          📱 <a href={`https://wa.me/${hpA.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">{hpA}</a>
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-0.5">
                  {people.length === 0
                    ? <p className="text-xs text-gray-400 italic">Belum ada petugas</p>
                    : people.map((a: any, i: number) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-[10px] text-gray-400 w-4 text-right shrink-0 mt-0.5">{i + 1}.</span>
                        <div>
                          <p className="text-xs font-medium text-gray-800 leading-none">{a.users?.nama_panggilan || '—'}</p>
                          {a.users?.lingkungan && <p className="text-[10px] text-gray-400 mt-0.5">· {a.users.lingkungan}</p>}
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            );
          })}
        </div>

        {/* Pelatih piket */}
        {pelatihNicks.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-semibold">Pelatih Piket:</span>
            {pelatihNicks.map((nick: string) => (
              <span key={nick} className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium">{nick}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  const cards = loading
    ? [1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl bg-gray-200 animate-pulse"/>)
    : events.length === 0
      ? (
        <div className="text-center py-14">
          <CalendarDays size={40} className="mx-auto text-gray-300 mb-3"/>
          <p className="text-gray-500">Belum ada jadwal mendatang</p>
        </div>
      )
      : events.map(ev => renderEventCard(ev));

  if (internal) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="page-title">Jadwal Misa</h1>
          <p className="page-subtitle">Jadwal mendatang yang sudah dipublish</p>
        </div>
        <div className="space-y-4">{cards}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-brand-800 text-white py-8 px-4 text-center">
        <h1 className="text-2xl font-black">SIGMA</h1>
        <p className="text-brand-200 text-sm">Jadwal Misdinar Paroki Kristus Raja Solo Baru</p>
        <p className="text-brand-300 text-xs italic mt-1">Serve the Lord with Gladness</p>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="space-y-5">{cards}</div>
        <div className="text-center pt-6">
          <a href="/login" className="btn-primary">Login ke SIGMA</a>
          <p className="text-xs text-gray-400 mt-3">
            Daftar? <a href="/daftar" className="text-brand-800 underline">Klik di sini</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export function InternalSchedulePage() {
  return <PublicSchedulePage internal />;
}

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-brand-800 flex items-center justify-center text-white text-center p-6">
      <div>
        <Church size={48} className="mx-auto mb-4 text-brand-200"/>
        <h1 className="text-6xl font-black mb-2">404</h1>
        <p className="text-brand-200 text-lg mb-6">Halaman tidak ditemukan</p>
        <a href="/dashboard" className="bg-white text-brand-800 font-bold px-6 py-3 rounded-xl">Kembali</a>
      </div>
    </div>
);
}

export default ScheduleDailyPage;
