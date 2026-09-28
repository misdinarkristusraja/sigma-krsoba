import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNatalAnnouncement } from '../hooks/useNatalAnnouncement';
import { useNatalCountdown } from '../hooks/useNatalCountdown';
import NatalCountdownDisplay from '../components/natal/NatalCountdownDisplay';
import NatalResultCard from '../components/natal/NatalResultCard';
import NatalAdminOfficersList from '../components/natal/NatalAdminOfficersList';
import { Sparkles, Search, UserCheck, Lock, AlertCircle, ArrowLeft, RefreshCw, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { NatalAnnouncement } from '../types';
import { formatNatalTargetTime } from '../lib/natalUtils';

export default function NatalAnnouncementPage() {
  const { profile, isPengurus, isAdmin } = useAuth();
  const {
    config,
    loading,
    isVisible,
    myAnnouncement,
    searchMember,
    bypassCountdown,
    setBypassCountdown,
  } = useNatalAnnouncement();

  const countdown = useNatalCountdown(config.target_time, bypassCountdown);

  const [inputNama, setInputNama] = useState('');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Partial<NatalAnnouncement> | null>(null);
  const [searching, setSearching] = useState(false);
  const [isOpeningResult, setIsOpeningResult] = useState(false);

  // Sync initial input name with logged-in profile
  React.useEffect(() => {
    if (profile?.nama_lengkap) {
      setInputNama(profile.nama_lengkap);
    } else if (profile?.nama_panggilan) {
      setInputNama(profile.nama_panggilan);
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
          <p className="text-sm font-medium">Memuat portal pengumuman natal...</p>
        </div>
      </div>
    );
  }

  // Access control check: exclusively for Pengurus ke atas (Pengurus, Pendamping, Administrator) during trial
  if (!isPengurus || !isVisible) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-3xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-center shadow-lg">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Portal Khusus Pengurus
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
          Fitur pengumuman penugasan misa natal ini sedang dalam tahap uji coba terbatas dan hanya dapat diakses oleh Pengurus, Pendamping, dan Administrator.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
    );
  }

  // Handle open own result
  const handleOpenMyResult = () => {
    setIsOpeningResult(true);
    setTimeout(() => {
      setIsOpeningResult(false);
      if (myAnnouncement) {
        setSelectedAnnouncement(myAnnouncement);
      } else {
        setSelectedAnnouncement({
          nama_lengkap: profile?.nama_lengkap || profile?.nama_panggilan || 'Anggota Misdinar',
          status_tugas: 'unassigned',
          tahun: new Date().getFullYear(),
        });
      }
    }, 600);
  };

  // Handle search member
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputNama.trim()) {
      toast.error('Masukkan nama anggota');
      return;
    }

    setSearching(true);
    try {
      const res = await searchMember(inputNama.trim());
      if (res) {
        setSelectedAnnouncement(res);
      } else {
        toast.error(`Data untuk nama "${inputNama}" tidak ditemukan`);
      }
    } catch {
      toast.error('Gagal mencari nama');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="py-6 sm:py-10 max-w-5xl mx-auto px-4">
      {/* Top back navigation */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-amber-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Dashboard</span>
        </Link>

        {isPengurus && (
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            Akses Pengurus Aktif
          </span>
        )}
      </div>

      {/* Phase 1: Countdown Display (when not expired) */}
      {!countdown.isExpired ? (
        <div className="space-y-8">
          <NatalCountdownDisplay
            countdown={countdown}
            title={config.title}
            targetIsoDate={config.target_time}
            isPengurus={isPengurus}
            onBypassCountdown={() => setBypassCountdown(!bypassCountdown)}
            isBypassed={bypassCountdown}
          />
        </div>
      ) : (
        /* Phase 2: Reveal & Input Form (when countdown is 0 or bypassed) */
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto rounded-3xl p-6 sm:p-10 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl text-center"
          >
            {/* Header */}
            <div className="flex items-center justify-center gap-2 text-xs font-bold tracking-widest uppercase text-brand-600 dark:text-amber-400 mb-2">
              <Sparkles className="w-4 h-4" />
              <span>PORTAL RESMI PENGUMUMAN NATAL</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
              Hasil Penjadwalan Tugas Natal Telah Dibuka
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mb-3 max-w-md mx-auto">
              Silakan cek hasil penugasan Anda untuk melayani pada Hari Raya Natal di Gereja Paroki Kristus Raja.
            </p>

            {/* Release Date info badge */}
            {config.target_time && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-xs text-amber-700 dark:text-amber-300 font-medium mb-8">
                <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Jadwal Resmi Dirilis: <strong>{formatNatalTargetTime(config.target_time)}</strong></span>
              </div>
            )}

            {/* Quick Check Own Profile Card */}
            <div className="p-6 rounded-2xl bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700/60 mb-6 text-left">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider block">
                    Akun Terverifikasi
                  </span>
                  <span className="text-base font-bold text-gray-900 dark:text-white">
                    {profile?.nama_lengkap || profile?.nama_panggilan || 'Nama Tidak Terdaftar'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenMyResult}
                disabled={isOpeningResult}
                className="w-full py-3.5 px-6 rounded-xl font-extrabold text-sm sm:text-base bg-brand-600 hover:bg-brand-500 text-white shadow-xl shadow-brand-600/30 transition-all flex items-center justify-center gap-2 transform active:scale-98"
              >
                {isOpeningResult ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Membuka Hasil Pengumuman...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
                    <span>Buka Hasil Pengumuman Saya</span>
                  </>
                )}
              </button>
            </div>

            {/* Optional: Search other members if allowed */}
            {config.allow_search_others && (
              <div className="pt-6 border-t border-gray-100 dark:border-slate-800 text-left">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-3">
                  Cari Jadwal Anggota Lain
                </h4>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={inputNama}
                      onChange={(e) => setInputNama(e.target.value)}
                      placeholder="Ketik nama lengkap atau panggilan..."
                      className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searching}
                    className="px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold text-xs sm:text-sm transition-colors"
                  >
                    {searching ? 'Mencari...' : 'Cari'}
                  </button>
                </form>
              </div>
            )}

            {/* Pengurus Bypass indicator */}
            {bypassCountdown && isPengurus && (
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-amber-500 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Mode Bypass Aktif: Anda sedang menguji coba tampilan rilis sebelum waktu resmi tiba.</span>
                <button
                  type="button"
                  onClick={() => setBypassCountdown(false)}
                  className="underline hover:text-white"
                >
                  Kembalikan Timer
                </button>
              </div>
            )}
          </motion.div>

          {/* Phase 2b: Administrator Full Duty Officers Roster */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <NatalAdminOfficersList
                onPreviewOfficer={(officer) => setSelectedAnnouncement(officer)}
              />
            </motion.div>
          )}
        </div>
      )}

      {/* SNBP Result Modal Popup */}
      <AnimatePresence>
        {selectedAnnouncement && (
          <NatalResultCard
            announcement={selectedAnnouncement}
            onClose={() => setSelectedAnnouncement(null)}
            onSearchOther={() => {
              setSelectedAnnouncement(null);
            }}
            allowSearchOther={config.allow_search_others}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
