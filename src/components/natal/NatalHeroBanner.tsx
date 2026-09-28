import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Clock, ArrowRight, ShieldAlert, Gift } from 'lucide-react';
import { useNatalAnnouncement } from '../../hooks/useNatalAnnouncement';
import { useNatalCountdown } from '../../hooks/useNatalCountdown';

export default function NatalHeroBanner() {
  const { config, isVisible, loading } = useNatalAnnouncement();
  const countdown = useNatalCountdown(config.target_time);

  if (loading || !isVisible) return null;

  const isTrial = config.status === 'trial';
  const isUrgent = countdown.isUnder5Min && !countdown.isExpired;

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden p-4 sm:p-6 mb-6 transition-all duration-300 border ${
      countdown.isExpired
        ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 border-emerald-500/50 shadow-lg shadow-emerald-600/10'
        : isUrgent
        ? 'bg-gradient-to-r from-red-950 via-slate-900 to-amber-950 border-red-500/60 shadow-lg shadow-red-600/20 animate-pulse'
        : 'bg-gradient-to-r from-brand-950/80 via-slate-900 to-slate-950 border-brand-500/30 shadow-md'
    } text-white`}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left Info */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
            countdown.isExpired
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400'
              : isUrgent
              ? 'bg-red-500/20 border-red-400 text-red-400'
              : 'bg-amber-500/20 border-amber-400 text-amber-400'
          }`}>
            {countdown.isExpired ? (
              <Gift className="w-6 h-6 animate-bounce" />
            ) : (
              <Sparkles className="w-6 h-6" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase text-amber-400">
                PENGUMUMAN TUGAS NATAL
              </span>
              {isTrial && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <ShieldAlert className="w-2.5 h-2.5" />
                  Uji Coba Pengurus
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
              {countdown.isExpired
                ? 'Hasil Penjadwalan Tugas Natal Telah Resmi Dibuka!'
                : config.title}
            </h3>

            <p className="text-xs text-slate-300 mt-0.5">
              {countdown.isExpired
                ? 'Klik untuk melihat apakah nama Anda terdaftar dalam tugas misa natal.'
                : isUrgent
                ? 'Waktu pengumuman kurang dari 5 menit! Bersiaplah untuk melihat hasilnya.'
                : 'Sistem hitungan mundur menuju rilis resmi pembagian misa natal.'}
            </p>
          </div>
        </div>

        {/* Right Action / Countdown Display */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {!countdown.isExpired ? (
            <div className="flex items-center gap-1.5 font-mono text-center">
              <div className="bg-black/40 border border-white/10 px-2 py-1 rounded-lg">
                <span className="text-xs font-bold text-amber-300 block">
                  {String(countdown.days).padStart(2, '0')}
                </span>
                <span className="text-[8px] text-slate-400 uppercase">Hr</span>
              </div>
              <span className="text-slate-500 font-bold">:</span>
              <div className="bg-black/40 border border-white/10 px-2 py-1 rounded-lg">
                <span className="text-xs font-bold text-amber-300 block">
                  {String(countdown.hours).padStart(2, '0')}
                </span>
                <span className="text-[8px] text-slate-400 uppercase">Jm</span>
              </div>
              <span className="text-slate-500 font-bold">:</span>
              <div className="bg-black/40 border border-white/10 px-2 py-1 rounded-lg">
                <span className="text-xs font-bold text-amber-300 block">
                  {String(countdown.minutes).padStart(2, '0')}
                </span>
                <span className="text-[8px] text-slate-400 uppercase">Mn</span>
              </div>
              <span className="text-slate-500 font-bold">:</span>
              <div className="bg-black/40 border border-white/10 px-2 py-1 rounded-lg">
                <span className={`text-xs font-bold block ${isUrgent ? 'text-red-400 animate-pulse' : 'text-amber-300'}`}>
                  {String(countdown.seconds).padStart(2, '0')}
                </span>
                <span className="text-[8px] text-slate-400 uppercase">Dt</span>
              </div>
            </div>
          ) : null}

          <Link
            to="/pengumuman-natal"
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all shrink-0 ${
              countdown.isExpired
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-600/30'
                : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
            }`}
          >
            <span>{countdown.isExpired ? 'Buka Hasil' : 'Masuk Portal'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
