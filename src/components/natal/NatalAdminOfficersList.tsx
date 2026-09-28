import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { NatalAnnouncement } from '../../types';
import { FIXED_NATAL_MISAS, FixedNatalMisa } from '../../lib/natalUtils';
import {
  Users, ShieldCheck, Search, Copy, Check, RefreshCw,
  ExternalLink, Calendar, Clock, Eye, Sparkles, Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

interface NatalAdminOfficersListProps {
  onPreviewOfficer?: (officer: NatalAnnouncement) => void;
}

export default function NatalAdminOfficersList({
  onPreviewOfficer,
}: NatalAdminOfficersListProps) {
  const [officers, setOfficers] = useState<NatalAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMisaId, setSelectedMisaId] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  // Fetch all assigned officers
  const fetchOfficers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('natal_announcements')
        .select('*')
        .eq('status_tugas', 'assigned')
        .order('misa_name', { ascending: true })
        .order('nama_lengkap', { ascending: true });

      if (error) throw error;
      setOfficers((data as NatalAnnouncement[]) || []);
    } catch (err: any) {
      console.error('Error fetching officers:', err);
      toast.error('Gagal memuat daftar petugas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOfficers();
  }, [fetchOfficers]);

  // Counts per misa
  const countsPerMisa = useMemo(() => {
    const map: Record<string, number> = {};
    FIXED_NATAL_MISAS.forEach((m) => {
      map[m.id] = 0;
    });

    officers.forEach((o) => {
      const matched = FIXED_NATAL_MISAS.find(
        (m) => m.name === o.misa_name || (o.misa_name && m.name.startsWith(o.misa_name))
      );
      if (matched) {
        map[matched.id] = (map[matched.id] || 0) + 1;
      }
    });

    return map;
  }, [officers]);

  // Filtered officers
  const filteredOfficers = useMemo(() => {
    return officers.filter((o) => {
      // Filter by misa
      if (selectedMisaId !== 'all') {
        const matched = FIXED_NATAL_MISAS.find((m) => m.id === selectedMisaId);
        const matchByName = matched && (
          o.misa_name === matched.name ||
          (o.misa_name && matched.name.startsWith(o.misa_name))
        );
        if (!matchByName) return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNama = (o.nama_lengkap || '').toLowerCase().includes(q);
        const matchPanggilan = (o.nama_panggilan || '').toLowerCase().includes(q);
        const matchMisa = (o.misa_name || '').toLowerCase().includes(q);
        if (!matchNama && !matchPanggilan && !matchMisa) return false;
      }

      return true;
    });
  }, [officers, selectedMisaId, searchQuery]);

  // Copy full roster to clipboard
  const handleCopy = () => {
    if (officers.length === 0) {
      toast.error('Belum ada data petugas untuk disalin');
      return;
    }

    let text = `DAFTAR SELURUH PETUGAS MISA NATAL\nGEREJA PAROKI KRISTUS RAJA\n`;
    text += `Total Petugas Bertugas: ${officers.length} Orang\n`;
    text += `Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}\n\n`;

    FIXED_NATAL_MISAS.forEach((misa) => {
      const list = officers.filter(
        (o) => o.misa_name === misa.name || (o.misa_name && misa.name.startsWith(o.misa_name))
      );
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `📌 ${misa.name.toUpperCase()}\n`;
      text += `Jumlah: ${list.length} Petugas\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      if (list.length === 0) {
        text += `(Belum ada petugas ditugaskan)\n`;
      } else {
        list.forEach((officer, idx) => {
          const panggilan = officer.nama_panggilan ? ` (${officer.nama_panggilan})` : '';
          text += `${idx + 1}. ${officer.nama_lengkap}${panggilan}\n`;
        });
      }
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Daftar lengkap seluruh petugas disalin ke clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="w-full mt-10 rounded-3xl bg-white dark:bg-slate-900 border border-amber-500/30 shadow-2xl p-6 sm:p-8 text-left transition-all">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Khusus Administrator
            </span>
            <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
              Hasil Lengkap Penjadwalan
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-600 dark:text-amber-400" />
            <span>Daftar Seluruh Petugas Misa Natal</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
            Data penugasan terisi secara penuh di seluruh 4 perayaan misa natal.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchOfficers}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors"
            title="Muat ulang data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-colors"
            title="Salin daftar seluruh petugas"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Semua</span>
              </>
            )}
          </button>

          <Link
            to="/pengurus/penjadwalan-natal"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-600/20 transition-all"
            title="Buka panel admin penjadwalan natal"
          >
            <span>Kelola Jadwal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 my-6">
        <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
            Total Bertugas
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl sm:text-3xl font-black text-amber-900 dark:text-amber-200">
              {officers.length}
            </span>
            <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
              Orang
            </span>
          </div>
        </div>

        {FIXED_NATAL_MISAS.map((misa) => (
          <div
            key={misa.id}
            onClick={() => setSelectedMisaId(selectedMisaId === misa.id ? 'all' : misa.id)}
            className={`p-3 rounded-2xl border cursor-pointer transition-all ${
              selectedMisaId === misa.id
                ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-500 ring-2 ring-brand-500/30'
                : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-800 hover:border-gray-300'
            }`}
          >
            <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 line-clamp-1 block">
              {misa.name.split(' (')[0]}
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                {countsPerMisa[misa.id] || 0}
              </span>
              <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400">
                {misa.jam}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        {/* Misa Selection Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedMisaId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedMisaId === 'all'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            Semua Misa ({officers.length})
          </button>

          {FIXED_NATAL_MISAS.map((misa) => (
            <button
              key={misa.id}
              type="button"
              onClick={() => setSelectedMisaId(misa.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                selectedMisaId === misa.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              {misa.name.split(' (')[0]} ({countsPerMisa[misa.id] || 0})
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama petugas..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Officers List / Table */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin text-brand-500 mb-2" />
          <p className="text-xs font-medium">Memuat data seluruh petugas...</p>
        </div>
      ) : filteredOfficers.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-gray-50 dark:bg-slate-800/40 border border-dashed border-gray-200 dark:border-slate-800">
          <Users className="w-8 h-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-300">
            Tidak ada petugas ditemukan
          </p>
          <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-0.5">
            {searchQuery
              ? `Tidak ada hasil yang cocok dengan kata kunci "${searchQuery}"`
              : 'Belum ada anggota yang ditugaskan pada kategori misa ini.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Nama Lengkap & Panggilan</th>
                  <th className="py-3 px-4">Tugas Misa</th>
                  <th className="py-3 px-4">Waktu & Jam</th>
                  <th className="py-3 px-4 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {filteredOfficers.map((officer, index) => {
                  const matchedMisa = FIXED_NATAL_MISAS.find(
                    (m) => m.name === officer.misa_name || (officer.misa_name && m.name.startsWith(officer.misa_name))
                  );

                  return (
                    <tr
                      key={officer.id || index}
                      className="hover:bg-amber-500/5 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-center font-mono font-semibold text-gray-400 dark:text-slate-500">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500/20 to-brand-500/20 text-brand-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {(officer.nama_panggilan || officer.nama_lengkap || 'A').charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 dark:text-white block text-xs sm:text-sm">
                              {officer.nama_lengkap}
                            </span>
                            {officer.nama_panggilan && (
                              <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
                                ({officer.nama_panggilan})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            matchedMisa?.badgeClass || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {officer.misa_name || matchedMisa?.name || 'Misa Natal'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="font-semibold font-mono">
                            {officer.jam_tugas || matchedMisa?.jam || '-'}
                          </span>
                          <span className="text-gray-400 dark:text-slate-500">
                            ({officer.tanggal_tugas || matchedMisa?.tanggal || '-'})
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {onPreviewOfficer && (
                          <button
                            type="button"
                            onClick={() => onPreviewOfficer(officer)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-brand-600 dark:text-amber-400 hover:bg-brand-50 dark:hover:bg-amber-500/10 transition-colors"
                            title="Preview kartu SNBP petugas ini"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Lihat</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
