import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { NatalAnnouncement, NatalReleaseStatus, Profile } from '../../types';
import {
  Calendar, Clock, Users, Plus, Trash2, Save, Sparkles, AlertCircle,
  CheckCircle2, RefreshCw, Eye, ShieldAlert, Sliders, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const MISA_PRESETS = [
  'Malam Natal I (17.00)',
  'Malam Natal II (20.00)',
  'Misa Natal Fajar (06.00)',
  'Misa Natal Pagi (08.00)',
  'Misa Natal Anak & Keluarga (10.00)',
  'Misa Natal Sore (17.00)',
  'Misa Hari Raya St. Stefanus',
  'Misa Hari Raya St. Yohanes',
  'Misa Tutup Tahun (31 Des)',
  'Misa Hari Raya Santa Maria Bunda Allah (1 Jan)',
];

const POSISI_PRESETS = [
  'Salib',
  'Lentera 1',
  'Lentera 2',
  'Dupa (Turibulum)',
  'Navikula (Kapal Dupa)',
  'Lilin Altar 1',
  'Lilin Altar 2',
  'Evangeliarium',
  'Pembawa Persembahan',
  'Lonceng / Bel',
  'Cadangan (Standby)',
];

export default function NatalScheduleAdminPage() {
  const { profile, isPengurus } = useAuth();

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

  // Filter & Form States
  const [selectedMisaFilter, setSelectedMisaFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form input state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [manualNamaLengkap, setManualNamaLengkap] = useState('');
  const [manualNamaPanggilan, setManualNamaPanggilan] = useState('');
  const [misaName, setMisaName] = useState(MISA_PRESETS[0]);
  const [tanggalTugas, setTanggalTugas] = useState('2026-12-24');
  const [jamTugas, setJamTugas] = useState('17:00');
  const [posisiTugas, setPosisiTugas] = useState(POSISI_PRESETS[0]);
  const [jadwalLatihan, setJadwalLatihan] = useState('');
  const [catatanKhusus, setCatatanKhusus] = useState('Hadir 30 menit sebelum misa dengan jubah lengkap dan rapi.');
  const [submittingDuty, setSubmittingDuty] = useState(false);

  // Load Config & Announcements
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
          // Format for datetime-local input (YYYY-MM-DDTHH:mm)
          const d = new Date(cfg['natal_announcement_target_time']);
          const tzOffset = d.getTimezoneOffset() * 60000;
          const localISO = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
          setTargetTime(localISO);
        } else {
          // Default 1 week ahead
          const defaultDate = new Date(Date.now() + 7 * 24 * 3600 * 1000);
          setTargetTime(defaultDate.toISOString().slice(0, 16));
        }
      }

      // 2. Fetch Announcements
      const { data: annRows } = await supabase
        .from('natal_announcements')
        .select('*')
        .order('misa_name', { ascending: true })
        .order('nama_lengkap', { ascending: true });

      if (annRows) {
        setAnnouncements(annRows as NatalAnnouncement[]);
      }

      // 3. Fetch Active Members for Autocomplete
      const { data: userRows } = await supabase
        .from('users')
        .select('id, nama_lengkap, nama_panggilan, nickname, role, status')
        .eq('status', 'Active')
        .order('nama_lengkap', { ascending: true });

      if (userRows) {
        setMembersPool(userRows as Profile[]);
      }
    } catch {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When a user is selected from dropdown, fill name fields
  const handleSelectMember = (userId: string) => {
    setSelectedUserId(userId);
    const m = membersPool.find(u => u.id === userId);
    if (m) {
      setManualNamaLengkap(m.nama_lengkap || '');
      setManualNamaPanggilan(m.nama_panggilan || m.nickname || '');
    }
  };

  // Save System Config
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

      toast.success('Pengaturan rilis berhasil disimpan!');
    } catch {
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSavingConfig(false);
    }
  };

  // Add Single Duty Assignment
  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNamaLengkap.trim()) {
      toast.error('Nama lengkap wajib diisi');
      return;
    }

    setSubmittingDuty(true);
    try {
      const payload: Partial<NatalAnnouncement> = {
        user_id: selectedUserId || null,
        nama_lengkap: manualNamaLengkap.trim(),
        nama_panggilan: manualNamaPanggilan.trim() || manualNamaLengkap.trim().split(' ')[0],
        status_tugas: 'assigned',
        misa_name: misaName,
        tanggal_tugas: tanggalTugas,
        jam_tugas: jamTugas,
        posisi_tugas: posisiTugas,
        jadwal_latihan: jadwalLatihan || null,
        catatan_khusus: catatanKhusus || null,
        tahun: new Date().getFullYear(),
      };

      const { data, error } = await (supabase as any)
        .from('natal_announcements')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      setAnnouncements(prev => [data as NatalAnnouncement, ...prev]);
      toast.success(`Tugas untuk ${manualNamaLengkap} berhasil ditambahkan!`);

      // Reset form fields
      setSelectedUserId('');
      setManualNamaLengkap('');
      setManualNamaPanggilan('');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menambahkan tugas');
    } finally {
      setSubmittingDuty(false);
    }
  };

  // Delete Assignment
  const handleDeleteAssignment = async (id: string, name: string) => {
    if (!window.confirm(`Hapus data penugasan untuk ${name}?`)) return;

    try {
      const { error } = await supabase
        .from('natal_announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast.success('Data tugas berhasil dihapus');
    } catch {
      toast.error('Gagal menghapus');
    }
  };

  // Batch Tool: Generate Unassigned ("Tetap Semangat") for members without duties
  const handleGenerateUnassigned = async () => {
    if (!window.confirm('Buat entri status "Belum Bertugas (Tetap Semangat)" otomatis untuk semua anggota aktif yang belum ada jadwal?')) {
      return;
    }

    const assignedUserIds = new Set(
      announcements
        .filter(a => a.user_id)
        .map(a => a.user_id)
    );

    const unassignedMembers = membersPool.filter(m => !assignedUserIds.has(m.id));

    if (unassignedMembers.length === 0) {
      toast.success('Semua anggota aktif sudah terdaftar!');
      return;
    }

    try {
      const currentYear = new Date().getFullYear();
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

  // Filtered List
  const filteredList = announcements.filter(a => {
    const matchMisa = selectedMisaFilter === 'ALL' || a.misa_name === selectedMisaFilter;
    const matchQuery = !searchQuery ||
      a.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.nama_panggilan.toLowerCase().includes(searchQuery.toLowerCase());
    return matchMisa && matchQuery;
  });

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
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>PENGURUS SUITE — PENJADWALAN MISA NATAL</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Portal Manajemen Pengumuman Natal
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
            Kelola hitungan mundur rilis, input petugas misa natal, dan atur uji coba pengumuman ala SNBP.
          </p>
        </div>

        <Link
          to="/pengumuman-natal"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-gray-800 dark:text-slate-200 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Eye className="w-4 h-4 text-brand-500" />
          <span>Buka Tampilan Anggota</span>
        </Link>
      </div>

      {/* Section 1: Release Configuration Card */}
      <div className="card border-2 border-brand-500/20 shadow-md">
        <div className="flex items-center gap-2 text-brand-700 dark:text-amber-400 font-bold text-sm mb-4">
          <Sliders className="w-4 h-4" />
          <span>Pengaturan Status & Waktu Rilis Pengumuman</span>
        </div>

        <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Release Status */}
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

          {/* Target Countdown Time */}
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

          {/* Announcement Title */}
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

          {/* Allow Search Others */}
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={allowSearchOthers}
                onChange={(e) => setAllowSearchOthers(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                Izinkan Anggota Cari Nama Teman
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

      {/* Section 2: Input Duty Assignment Form */}
      <div className="card">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 text-brand-700 dark:text-amber-400 font-bold text-sm">
            <Plus className="w-4 h-4" />
            <span>Tambah Penugasan Petugas Misa Natal</span>
          </div>
          <span className="text-xs text-gray-500">
            Form khusus penugasan per anggota
          </span>
        </div>

        <form onSubmit={handleAddAssignment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Quick Pick Member Autocomplete */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Pilih Dari Daftar Anggota Aktif
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => handleSelectMember(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Ketik manual atau pilih anggota --</option>
                {membersPool.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nama_lengkap} ({m.nama_panggilan || m.nickname})
                  </option>
                ))}
              </select>
            </div>

            {/* Nama Lengkap */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Nama Lengkap (Ditampilkan di Kartu)
              </label>
              <input
                type="text"
                required
                value={manualNamaLengkap}
                onChange={(e) => setManualNamaLengkap(e.target.value)}
                placeholder="Contoh: Yohanes Stefanus Kurniawan"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Nama Panggilan */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Nama Panggilan
              </label>
              <input
                type="text"
                value={manualNamaPanggilan}
                onChange={(e) => setManualNamaPanggilan(e.target.value)}
                placeholder="Contoh: Stefan"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Misa Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Nama Perayaan Misa
              </label>
              <input
                type="text"
                list="misa-presets"
                value={misaName}
                onChange={(e) => setMisaName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
              <datalist id="misa-presets">
                {MISA_PRESETS.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>

            {/* Tanggal Tugas */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Tanggal Tugas
              </label>
              <input
                type="date"
                value={tanggalTugas}
                onChange={(e) => setTanggalTugas(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Jam Tugas */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Jam Tugas (WIB)
              </label>
              <input
                type="text"
                value={jamTugas}
                onChange={(e) => setJamTugas(e.target.value)}
                placeholder="17:00"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Posisi Tugas */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Posisi / Peran Tugas
              </label>
              <input
                type="text"
                list="posisi-presets"
                value={posisiTugas}
                onChange={(e) => setPosisiTugas(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
              <datalist id="posisi-presets">
                {POSISI_PRESETS.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Jadwal Latihan */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Jadwal Latihan Misa Natal (Wajib)
              </label>
              <input
                type="text"
                value={jadwalLatihan}
                onChange={(e) => setJadwalLatihan(e.target.value)}
                placeholder="Contoh: Minggu, 21 Des 2026 - Pk 10.00 WIB"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Catatan Khusus */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Catatan Khusus / Dresscode
              </label>
              <input
                type="text"
                value={catatanKhusus}
                onChange={(e) => setCatatanKhusus(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submittingDuty}
              className="py-2.5 px-6 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-md transition-colors flex items-center gap-2"
            >
              {submittingDuty ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Simpan Penugasan Petugas</span>
            </button>
          </div>
        </form>
      </div>

      {/* Section 3: Summary & Batch Automation Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300">
        <div className="flex items-center gap-4 text-xs sm:text-sm font-semibold">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Bertugas: <strong>{countAssigned}</strong> misdinar</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span>Belum Bertugas: <strong>{countUnassigned}</strong></span>
          </span>
        </div>

        <button
          type="button"
          onClick={handleGenerateUnassigned}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-sm transition-all"
        >
          ⚡ Generate Status "Tetap Semangat" untuk Anggota Lain
        </button>
      </div>

      {/* Section 4: Data Table of Announcements */}
      <div className="card overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedMisaFilter}
              onChange={(e) => setSelectedMisaFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              <option value="ALL">Semua Misa ({announcements.length})</option>
              {MISA_PRESETS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama..."
            className="w-full sm:w-64 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-600 dark:text-slate-400 uppercase tracking-wider font-bold border-b border-gray-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Panggilan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Misa & Jam</th>
                <th className="py-3 px-4">Posisi</th>
                <th className="py-3 px-4">Jadwal Latihan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800 dark:text-slate-200 font-medium">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Belum ada data penugasan natal yang cocok.
                  </td>
                </tr>
              ) : (
                filteredList.map((row) => (
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
                    <td className="py-3 px-4 text-amber-600 dark:text-amber-400 font-semibold">
                      {row.posisi_tugas || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {row.jadwal_latihan || '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteAssignment(row.id, row.nama_lengkap)}
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
    </div>
  );
}
