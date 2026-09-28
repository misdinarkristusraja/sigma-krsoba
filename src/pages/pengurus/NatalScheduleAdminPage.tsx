import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { NatalAnnouncement, NatalReleaseStatus, Profile } from '../../types';
import {
  Calendar, Clock, Users, Plus, Trash2, Save, Sparkles, AlertCircle,
  CheckCircle2, RefreshCw, Eye, ShieldAlert, Sliders, ChevronDown, Check,
  Search, X, UserCheck, Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

// ── 4 Misa Natal Resmi (Sesuai Arahan Revisi) ────────────────────────
export interface FixedNatalMisa {
  id: string;
  name: string;
  tanggal: string;
  jam: string;
  badgeClass: string;
}

export const FIXED_NATAL_MISAS: FixedNatalMisa[] = [
  {
    id: 'malam-natal-1',
    name: 'Misa Malam Natal I (17.00)',
    tanggal: '2026-12-24',
    jam: '17:00',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'malam-natal-2',
    name: 'Misa Malam Natal II (20.00)',
    tanggal: '2026-12-24',
    jam: '20:00',
    badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30',
  },
  {
    id: 'natal-lansia',
    name: 'Misa Natal Lansia (06.00)',
    tanggal: '2026-12-25',
    jam: '06:00',
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  },
  {
    id: 'natal-anak',
    name: 'Misa Natal Anak (09.00)',
    tanggal: '2026-12-25',
    jam: '09:00',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
];

export default function NatalScheduleAdminPage() {
  const { isPengurus } = useAuth();

  // Config States
  const [releaseStatus, setReleaseStatus] = useState<NatalReleaseStatus>('disabled');
  const [targetTime, setTargetTime] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('Pengumuman Penjadwalan Tugas Natal');
  const [allowSearchOthers, setAllowSearchOthers] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Data States
  const [announcements, setAnnouncements] = useState<NatalAnnouncement[]>([]);
  const [membersPool, setMembersPool] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Misa Slot in the Weekly-Style Editor
  const [activeMisaId, setActiveMisaId] = useState<string>(FIXED_NATAL_MISAS[0].id);

  // Filter & Search Table
  const [selectedMisaFilter, setSelectedMisaFilter] = useState('ALL');
  const [searchTableQuery, setSearchTableQuery] = useState('');

  // Weekly-style member search & drawer state for the active slot
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Per-misa training & notes state
  const [misaLatihanMap, setMisaLatihanMap] = useState<Record<string, string>>({
    'malam-natal-1': 'Minggu, 20 Des 2026 - Pk 10.00 WIB',
    'malam-natal-2': 'Minggu, 20 Des 2026 - Pk 12.00 WIB',
    'natal-lansia': 'Senin, 21 Des 2026 - Pk 17.00 WIB',
    'natal-anak': 'Senin, 21 Des 2026 - Pk 18.30 WIB',
  });
  const [misaNotesMap, setMisaNotesMap] = useState<Record<string, string>>({
    'malam-natal-1': 'Hadir 30 menit sebelum misa dengan seragam jubah lengkap dan rapi.',
    'malam-natal-2': 'Hadir 30 menit sebelum misa dengan seragam jubah lengkap dan rapi.',
    'natal-lansia': 'Hadir 30 menit sebelum misa dengan seragam jubah lengkap dan rapi.',
    'natal-anak': 'Hadir 30 menit sebelum misa dengan seragam jubah lengkap dan rapi.',
  });

  // Manual entry modal state (for rare non-member additions)
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualNamaLengkap, setManualNamaLengkap] = useState('');
  const [manualNamaPanggilan, setManualNamaPanggilan] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  // Load Data from Supabase
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Config
      const { data: cfgRows } = await supabase
        .from('system_config')
        .select('key, value')
        .in('key', [
          'natal_announcement_status',
          'natal_announcement_target_time',
          'natal_announcement_title',
          'natal_announcement_allow_search_others',
        ]);

      if (cfgRows) {
        const cfg: Record<string, string> = {};
        cfgRows.forEach((r: any) => { cfg[r.key] = r.value; });

        setReleaseStatus((cfg['natal_announcement_status'] as NatalReleaseStatus) || 'disabled');
        setAnnouncementTitle(cfg['natal_announcement_title'] || 'Pengumuman Penjadwalan Tugas Natal');
        setAllowSearchOthers(cfg['natal_announcement_allow_search_others'] === 'true');

        if (cfg['natal_announcement_target_time']) {
          const d = new Date(cfg['natal_announcement_target_time']);
          const tzOffset = d.getTimezoneOffset() * 60000;
          const localISO = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
          setTargetTime(localISO);
        } else {
          const defaultDate = new Date(Date.now() + 7 * 24 * 3600 * 1000);
          setTargetTime(defaultDate.toISOString().slice(0, 16));
        }
      }

      // 2. Fetch Announcements
      const { data: annRows } = await supabase
        .from('natal_announcements')
        .select('*')
        .order('created_at', { ascending: true });

      if (annRows) {
        setAnnouncements(annRows as NatalAnnouncement[]);

        // Extract any existing rehearsal notes per misa
        const newLatihanMap: Record<string, string> = { ...misaLatihanMap };
        const newNotesMap: Record<string, string> = { ...misaNotesMap };

        const rows = annRows as any[];
        FIXED_NATAL_MISAS.forEach(fm => {
          const found = rows.find(a => a.misa_name === fm.name && a.jadwal_latihan);
          if (found && found.jadwal_latihan) newLatihanMap[fm.id] = found.jadwal_latihan;
          if (found && found.catatan_khusus) newNotesMap[fm.id] = found.catatan_khusus;
        });

        setMisaLatihanMap(newLatihanMap);
        setMisaNotesMap(newNotesMap);
      }

      // 3. Fetch Active Members for Picker
      const { data: userRows } = await supabase
        .from('users')
        .select('id, nama_lengkap, nama_panggilan, nickname, lingkungan, pendidikan, role, status')
        .eq('status', 'Active')
        .order('nama_panggilan', { ascending: true });

      if (userRows) {
        setMembersPool(userRows as Profile[]);
      }
    } catch {
      toast.error('Gagal memuat data penjadwalan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Active Misa definition
  const currentMisa = useMemo(() => {
    return FIXED_NATAL_MISAS.find(m => m.id === activeMisaId) || FIXED_NATAL_MISAS[0];
  }, [activeMisaId]);

  // Assigned members for the active misa slot
  const currentMisaAssigned = useMemo(() => {
    return announcements.filter(
      a => a.status_tugas === 'assigned' && a.misa_name === currentMisa.name
    );
  }, [announcements, currentMisa.name]);

  // Save Release Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const isoTarget = targetTime ? new Date(targetTime).toISOString() : new Date().toISOString();

      const updates = [
        { key: 'natal_announcement_status', value: releaseStatus },
        { key: 'natal_announcement_target_time', value: isoTarget },
        { key: 'natal_announcement_title', value: announcementTitle },
        { key: 'natal_announcement_allow_search_others', value: String(allowSearchOthers) },
      ];

      for (const item of updates) {
        await (supabase as any).from('system_config').upsert(item, { onConflict: 'key' });
      }

      toast.success('Pengaturan rilis pengumuman berhasil disimpan!');
    } catch {
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSavingConfig(false);
    }
  };

  // Toggle Member in the active Misa (Weekly Schedule Manual Style)
  const toggleMemberInActiveMisa = async (member: Profile) => {
    const existing = currentMisaAssigned.find(
      a => (a.user_id && a.user_id === member.id) ||
           a.nama_lengkap.toLowerCase() === (member.nama_lengkap || '').toLowerCase()
    );

    if (existing) {
      // Remove from this misa
      try {
        const { error } = await supabase
          .from('natal_announcements')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;

        setAnnouncements(prev => prev.filter(a => a.id !== existing.id));
        toast.success(`${member.nama_panggilan || member.nickname} dihapus dari ${currentMisa.name}`);
      } catch {
        toast.error('Gagal menghapus penugasan');
      }
    } else {
      // Add to this misa
      try {
        const payload: Partial<NatalAnnouncement> = {
          user_id: member.id,
          nama_lengkap: member.nama_lengkap || member.nama_panggilan || 'Anggota',
          nama_panggilan: member.nama_panggilan || member.nickname || 'Anggota',
          status_tugas: 'assigned',
          misa_name: currentMisa.name,
          tanggal_tugas: currentMisa.tanggal,
          jam_tugas: currentMisa.jam,
          jadwal_latihan: misaLatihanMap[currentMisa.id] || null,
          catatan_khusus: misaNotesMap[currentMisa.id] || null,
          tahun: new Date().getFullYear(),
        };

        const { data, error } = await (supabase as any)
          .from('natal_announcements')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        setAnnouncements(prev => [...prev, data as NatalAnnouncement]);
        toast.success(`${member.nama_panggilan || member.nickname} ditugaskan di ${currentMisa.name}`);
      } catch (err: any) {
        toast.error(err.message || 'Gagal menambahkan tugas');
      }
    }
  };

  // Remove by announcement ID directly
  const handleRemoveAssignment = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('natal_announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast.success(`${name} dihapus dari penugasan`);
    } catch {
      toast.error('Gagal menghapus');
    }
  };

  // Save Misa Training & Notes for all existing records of this misa
  const handleSaveMisaNotes = async () => {
    const latihan = misaLatihanMap[currentMisa.id] || '';
    const catatan = misaNotesMap[currentMisa.id] || '';

    try {
      const { error } = await (supabase as any)
        .from('natal_announcements')
        .update({
          jadwal_latihan: latihan,
          catatan_khusus: catatan,
        })
        .eq('misa_name', currentMisa.name);

      if (error) throw error;

      setAnnouncements(prev =>
        prev.map(a => a.misa_name === currentMisa.name ? { ...a, jadwal_latihan: latihan, catatan_khusus: catatan } : a)
      );

      toast.success(`Jadwal latihan & catatan untuk ${currentMisa.name} tersimpan!`);
    } catch {
      toast.error('Gagal menyimpan jadwal latihan');
    }
  };

  // Add Manual Guest/Non-DB Member
  const handleAddManualMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNamaLengkap.trim()) {
      toast.error('Nama lengkap wajib diisi');
      return;
    }

    setSavingManual(true);
    try {
      const payload: Partial<NatalAnnouncement> = {
        user_id: null,
        nama_lengkap: manualNamaLengkap.trim(),
        nama_panggilan: manualNamaPanggilan.trim() || manualNamaLengkap.trim().split(' ')[0],
        status_tugas: 'assigned',
        misa_name: currentMisa.name,
        tanggal_tugas: currentMisa.tanggal,
        jam_tugas: currentMisa.jam,
        jadwal_latihan: misaLatihanMap[currentMisa.id] || null,
        catatan_khusus: misaNotesMap[currentMisa.id] || null,
        tahun: new Date().getFullYear(),
      };

      const { data, error } = await (supabase as any)
        .from('natal_announcements')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      setAnnouncements(prev => [...prev, data as NatalAnnouncement]);
      toast.success(`${manualNamaLengkap} berhasil ditambahkan ke ${currentMisa.name}`);
      setShowManualModal(false);
      setManualNamaLengkap('');
      setManualNamaPanggilan('');
    } catch {
      toast.error('Gagal menambahkan manual');
    } finally {
      setSavingManual(false);
    }
  };

  // Batch Tool: Generate Unassigned ("Tetap Semangat") for members without duties
  const handleGenerateUnassigned = async () => {
    if (!window.confirm('Buat entri status "Belum Bertugas (Tetap Semangat)" otomatis untuk semua anggota aktif yang belum terdaftar di misa manapun?')) {
      return;
    }

    const assignedUserIds = new Set(
      announcements
        .filter(a => a.status_tugas === 'assigned' && a.user_id)
        .map(a => a.user_id)
    );

    const unassignedMembers = membersPool.filter(m => !assignedUserIds.has(m.id));

    if (unassignedMembers.length === 0) {
      toast.success('Semua anggota aktif sudah terjadwal!');
      return;
    }

    try {
      const currentYear = new Date().getFullYear();
      // Delete existing unassigned rows to prevent duplicates
      await supabase
        .from('natal_announcements')
        .delete()
        .eq('status_tugas', 'unassigned');

      const records = unassignedMembers.map(m => ({
        user_id: m.id,
        nama_lengkap: m.nama_lengkap || m.nama_panggilan || 'Anggota',
        nama_panggilan: m.nama_panggilan || m.nickname || 'Anggota',
        status_tugas: 'unassigned',
        tahun: currentYear,
      }));

      const { error } = await (supabase as any)
        .from('natal_announcements')
        .insert(records);

      if (error) throw error;

      toast.success(`Berhasil membuat ${records.length} entri "Tetap Semangat"!`);
      loadData();
    } catch {
      toast.error('Gagal membuat data unassigned');
    }
  };

  // Filtered members in weekly-style drawer
  const filteredDrawerMembers = useMemo(() => {
    const q = memberSearchQuery.toLowerCase().trim();
    if (!q) return membersPool;
    return membersPool.filter(m =>
      (m.nama_panggilan || '').toLowerCase().includes(q) ||
      (m.nama_lengkap || '').toLowerCase().includes(q) ||
      (m.nickname || '').toLowerCase().includes(q) ||
      (m.lingkungan || '').toLowerCase().includes(q) ||
      (m.pendidikan || '').toLowerCase().includes(q)
    );
  }, [membersPool, memberSearchQuery]);

  // Filtered Table Announcements
  const filteredTableList = useMemo(() => {
    return announcements.filter(a => {
      const matchMisa = selectedMisaFilter === 'ALL' || a.misa_name === selectedMisaFilter;
      const matchQuery = !searchTableQuery ||
        a.nama_lengkap.toLowerCase().includes(searchTableQuery.toLowerCase()) ||
        a.nama_panggilan.toLowerCase().includes(searchTableQuery.toLowerCase());
      return matchMisa && matchQuery;
    });
  }, [announcements, selectedMisaFilter, searchTableQuery]);

  // Counters
  const countAssigned = announcements.filter(a => a.status_tugas === 'assigned').length;
  const countUnassigned = announcements.filter(a => a.status_tugas === 'unassigned').length;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>PENGURUS SUITE — PENJADWALAN MISA NATAL</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Penjadwalan Misa Natal
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
            Input tugas per misa layaknya jadwal mingguan manual, atur latihan khusus, dan konfigurasi rilis SNBP.
          </p>
        </div>

        <Link
          to="/pengumuman-natal"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-gray-800 dark:text-slate-200 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Eye className="w-4 h-4 text-brand-500" />
          <span>Lihat Tampilan Anggota</span>
        </Link>
      </div>

      {/* Section 1: Release Configuration Card */}
      <div className="card border-2 border-brand-500/20 shadow-md">
        <div className="flex items-center gap-2 text-brand-700 dark:text-amber-400 font-bold text-sm mb-4">
          <Sliders className="w-4 h-4" />
          <span>Pengaturan Status & Waktu Countdown Rilis</span>
        </div>

        <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
              Status Akses Portal
            </label>
            <select
              value={releaseStatus}
              onChange={(e) => setReleaseStatus(e.target.value as NatalReleaseStatus)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-brand-500"
            >
              <option value="disabled">🚫 Nonaktif (Sembunyikan Total)</option>
              <option value="trial">🧪 Uji Coba (Pengurus & Admin Saja)</option>
              <option value="published">🌐 Publik (Buka untuk Semua Anggota)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
              Target Waktu Selesai Countdown
            </label>
            <input
              type="datetime-local"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
              Judul Pengumuman
            </label>
            <input
              type="text"
              value={announcementTitle}
              onChange={(e) => setAnnouncementTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={allowSearchOthers}
                onChange={(e) => setAllowSearchOthers(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                Boleh Cari Nama Teman
              </span>
            </label>

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full py-2 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              {savingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: Weekly-Style Manual Assignment Editor */}
      <div className="card shadow-lg border border-gray-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-amber-400 font-bold text-base">
              <UserCheck className="w-5 h-5" />
              <span>Input & Edit Petugas Misa Natal (Ala Jadwal Mingguan)</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Pilih perayaan misa di bawah, lalu klik untuk menambah/menghapus petugas secara instan.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-300"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Nama Manual / Tamu</span>
          </button>
        </div>

        {/* 4 Misa Selection Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4">
          {FIXED_NATAL_MISAS.map((misa) => {
            const isSelected = activeMisaId === misa.id;
            const count = announcements.filter(a => a.status_tugas === 'assigned' && a.misa_name === misa.name).length;

            return (
              <button
                key={misa.id}
                type="button"
                onClick={() => {
                  setActiveMisaId(misa.id);
                  setIsDrawerOpen(false);
                }}
                className={`p-3 rounded-2xl text-left border transition-all ${
                  isSelected
                    ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-950/40 shadow-sm ring-2 ring-brand-500/20'
                    : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 bg-white dark:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${misa.badgeClass}`}>
                    {misa.jam} WIB
                  </span>
                  <span className="text-[11px] font-extrabold text-brand-700 dark:text-amber-400">
                    {count} org
                  </span>
                </div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {misa.name}
                </h4>
                <p className="text-[10px] text-gray-500 dark:text-slate-400">
                  {misa.tanggal}
                </p>
              </button>
            );
          })}
        </div>

        {/* Active Misa Workspace Card */}
        <div className="mt-6 p-4 sm:p-6 rounded-2xl bg-gray-50/70 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700/80 space-y-5">
          {/* Header of Active Misa */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200 dark:border-slate-700">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-600 text-white">
                  {currentMisa.jam} WIB
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">
                  {currentMisa.name}
                </h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Tanggal: <strong>{currentMisa.tanggal}</strong> • Terisi: <strong>{currentMisaAssigned.length} misdinar</strong>
              </p>
            </div>
          </div>

          {/* Assigned Members Pill Badges (Weekly Schedule Style) */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300">
                Daftar Petugas Terpilih ({currentMisaAssigned.length})
              </label>
              <span className="text-[11px] text-gray-400">
                Klik [ × ] pada badge untuk menghapus tugas (posisi dibagikan saat latihan)
              </span>
            </div>

            {currentMisaAssigned.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 text-center text-xs text-gray-400">
                Belum ada petugas yang ditugaskan di misa ini. Klik tombol "Pilih & Tambah Petugas ▾" di bawah.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentMisaAssigned.map((a, idx) => (
                  <div
                    key={a.id}
                    className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-500/40 text-gray-900 dark:text-slate-100 shadow-sm text-xs font-semibold"
                  >
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-black text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {a.nama_panggilan || a.nama_lengkap}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveAssignment(a.id, a.nama_lengkap)}
                      className="ml-1 p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="Hapus dari misa ini"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Open Drawer / Accordion Button */}
          <div>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-between border transition-all ${
                isDrawerOpen
                  ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                  : 'bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 border-gray-300 dark:border-slate-700 hover:border-brand-500'
              }`}
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span>Pilih & Tambah Petugas dari Database ({membersPool.length} Anggota Aktif)</span>
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isDrawerOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Member Picker Drawer (Weekly Schedule Style) */}
            {isDrawerOpen && (
              <div className="mt-2 p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl space-y-3 z-10 relative">
                {/* Search box inside drawer */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    autoFocus
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Cari nama panggilan, nama lengkap, lingkungan..."
                    className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Member checklist */}
                <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800 border border-gray-100 dark:border-slate-800 rounded-xl">
                  {filteredDrawerMembers.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">
                      Tidak ditemukan anggota yang sesuai pencarian
                    </p>
                  ) : (
                    filteredDrawerMembers.map((member) => {
                      const isAssignedToThisMisa = currentMisaAssigned.some(
                        a => (a.user_id && a.user_id === member.id) ||
                             a.nama_lengkap.toLowerCase() === (member.nama_lengkap || '').toLowerCase()
                      );

                      // Check if already assigned to other misa
                      const otherAssignment = announcements.find(
                        a => a.status_tugas === 'assigned' &&
                             a.misa_name !== currentMisa.name &&
                             ((a.user_id && a.user_id === member.id) ||
                              a.nama_lengkap.toLowerCase() === (member.nama_lengkap || '').toLowerCase())
                      );

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleMemberInActiveMisa(member)}
                          className={`w-full flex items-center justify-between p-2.5 text-left transition-colors ${
                            isAssignedToThisMisa
                              ? 'bg-emerald-50 dark:bg-emerald-950/40'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                              isAssignedToThisMisa
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-gray-300 dark:border-slate-600'
                            }`}>
                              {isAssignedToThisMisa && <Check className="w-3.5 h-3.5" />}
                            </span>

                            <div>
                              <p className="text-xs font-bold text-gray-900 dark:text-white">
                                {member.nama_panggilan || member.nickname}
                                <span className="font-normal text-gray-500 dark:text-slate-400 ml-1.5">
                                  ({member.nama_lengkap})
                                </span>
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {member.pendidikan} • {member.lingkungan}
                              </p>
                            </div>
                          </div>

                          {otherAssignment && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              Sudah di: {otherAssignment.misa_name}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="px-4 py-1.5 text-xs font-bold rounded-lg bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 text-gray-700 dark:text-slate-200"
                  >
                    Tutup Daftar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Rehearsal & Special Notes Editor for this Misa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-200 dark:border-slate-700">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Jadwal Latihan Misa Ini
              </label>
              <input
                type="text"
                value={misaLatihanMap[currentMisa.id] || ''}
                onChange={(e) => setMisaLatihanMap(prev => ({ ...prev, [currentMisa.id]: e.target.value }))}
                placeholder="Contoh: Minggu, 20 Des 2026 - Pk 10.00 WIB"
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Catatan Khusus / Dresscode Misa Ini
              </label>
              <input
                type="text"
                value={misaNotesMap[currentMisa.id] || ''}
                onChange={(e) => setMisaNotesMap(prev => ({ ...prev, [currentMisa.id]: e.target.value }))}
                placeholder="Contoh: Hadir 30 menit sebelum misa..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveMisaNotes}
              className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Latihan & Catatan {currentMisa.name}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 3: Summary Bar & Batch Tools */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Total Bertugas: <strong>{countAssigned}</strong></span>
          </span>
          {FIXED_NATAL_MISAS.map(m => {
            const c = announcements.filter(a => a.status_tugas === 'assigned' && a.misa_name === m.name).length;
            return (
              <span key={m.id} className="text-gray-600 dark:text-slate-400">
                {m.name.split('(')[0].trim()}: <strong>{c}</strong>
              </span>
            );
          })}
          <span className="flex items-center gap-1 text-red-500">
            <AlertCircle className="w-4 h-4" />
            <span>Belum Bertugas: <strong>{countUnassigned}</strong></span>
          </span>
        </div>

        <button
          type="button"
          onClick={handleGenerateUnassigned}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-md transition-all shrink-0"
        >
          ⚡ Generate Status "Tetap Semangat" untuk Anggota Lain
        </button>
      </div>

      {/* Section 4: Recap Table (Synchronized with 4 Fixed Misas) */}
      <div className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-gray-500">Filter Perayaan:</span>
            <select
              value={selectedMisaFilter}
              onChange={(e) => setSelectedMisaFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              <option value="ALL">Semua Perayaan Misa ({announcements.length})</option>
              {FIXED_NATAL_MISAS.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTableQuery}
              onChange={(e) => setSearchTableQuery(e.target.value)}
              placeholder="Cari nama di tabel..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-600 dark:text-slate-400 uppercase tracking-wider font-bold border-b border-gray-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Panggilan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Misa & Jam</th>
                <th className="py-3 px-4">Jadwal Latihan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800 dark:text-slate-200 font-medium">
              {filteredTableList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Belum ada data penugasan natal yang cocok.
                  </td>
                </tr>
              ) : (
                filteredTableList.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                      {row.nama_lengkap}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-slate-300">
                      {row.nama_panggilan}
                    </td>
                    <td className="py-3 px-4">
                      {row.status_tugas === 'assigned' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Bertugas
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                          Belum Bertugas
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {row.misa_name ? (
                        <div>
                          <span className="font-semibold block">{row.misa_name}</span>
                          <span className="text-[10px] text-gray-400">{row.jam_tugas} WIB</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {row.jadwal_latihan || '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveAssignment(row.id, row.nama_lengkap)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Hapus Penugasan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Add Modal (Optional fallback for non-member entries) */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Tambah Nama Petugas Manual / Tamu
              </h3>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualMember} className="space-y-4">
              <div>
                <span className="text-xs text-brand-600 dark:text-amber-400 font-bold block mb-2">
                  Ditugaskan ke: {currentMisa.name}
                </span>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={manualNamaLengkap}
                  onChange={(e) => setManualNamaLengkap(e.target.value)}
                  placeholder="Contoh: Maria Margaretha"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Nama Panggilan
                </label>
                <input
                  type="text"
                  value={manualNamaPanggilan}
                  onChange={(e) => setManualNamaPanggilan(e.target.value)}
                  placeholder="Contoh: Maria"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingManual}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition-colors"
                >
                  {savingManual ? 'Menyimpan...' : 'Simpan Petugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
