import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, HeartHandshake, Calendar, Clock, MapPin, Sparkles, X, Search, ShieldCheck } from 'lucide-react';
import { NatalAnnouncement } from '../../types';
import { formatNatalAnnouncementMessage } from '../../lib/natalUtils';

interface NatalResultCardProps {
  announcement: Partial<NatalAnnouncement>;
  onClose: () => void;
  onSearchOther?: () => void;
  allowSearchOther?: boolean;
}

export default function NatalResultCard({
  announcement,
  onClose,
  onSearchOther,
  allowSearchOther = false,
}: NatalResultCardProps) {
  const { isAssigned, title } = formatNatalAnnouncementMessage(announcement);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border ${
          isAssigned
            ? 'bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-950 border-emerald-500/60 shadow-emerald-500/20'
            : 'bg-gradient-to-b from-red-950 via-slate-900 to-slate-950 border-red-500/50 shadow-red-500/20'
        } text-white`}
      >
        {/* Top Header ala SNBP */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isAssigned ? 'bg-emerald-900/50 border-emerald-500/30' : 'bg-red-900/40 border-red-500/30'
        }`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-5 h-5 ${isAssigned ? 'text-emerald-400' : 'text-red-400'}`} />
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase opacity-80">
                PENGUMUMAN RESMI PENUGASAN NATAL {announcement.tahun || new Date().getFullYear()}
              </p>
              <p className="text-xs font-semibold text-slate-300">
                MISDINAR KRISTUS RAJA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6 text-center">
          {/* Badge Icon */}
          <div className="flex justify-center">
            {isAssigned ? (
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                </div>
                <Sparkles className="w-6 h-6 text-amber-300 absolute -top-1 -right-1 animate-spin" style={{ animationDuration: '8s' }} />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-400/80 flex items-center justify-center shadow-lg shadow-red-500/20">
                <HeartHandshake className="w-10 h-10 text-red-400" />
              </div>
            )}
          </div>

          {/* Big Title (Selamat! / Tetap semangat!) */}
          <div>
            <h3 className={`text-3xl sm:text-4xl font-black tracking-tight mb-2 ${
              isAssigned ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {title}
            </h3>

            {/* Nama Lengkap */}
            <div className="inline-block px-4 py-1.5 rounded-full bg-white/10 border border-white/15 my-2">
              <span className="text-base sm:text-lg font-bold text-white tracking-wide">
                {announcement.nama_lengkap}
              </span>
            </div>

            {/* Custom Paragraph as per User Spec */}
            <p className="text-sm sm:text-base text-slate-200 mt-2 leading-relaxed max-w-md mx-auto">
              {isAssigned ? (
                <>
                  anda mendapatkan tugas{' '}
                  <span className="font-extrabold text-amber-300">
                    {announcement.misa_name || 'Misa Natal'}
                    {announcement.jam_tugas ? ` (Pk ${announcement.jam_tugas} WIB)` : ''}
                  </span>
                </>
              ) : (
                <>
                  anda belum mendapatkan tugas natal Tahun ini! Jangan menyerah dan jangan putus asa untuk melayani Tuhan!
                </>
              )}
            </p>
          </div>

          {/* Detail Box (Assigned) */}
          {isAssigned && (
            <div className="bg-white/5 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 text-left space-y-3">
              {announcement.tanggal_tugas && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                      Hari & Tanggal
                    </span>
                    <span className="text-sm font-semibold text-slate-200">
                      {announcement.tanggal_tugas}
                    </span>
                  </div>
                </div>
              )}

              {announcement.jadwal_latihan && (
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                      Jadwal Latihan Misa Natal
                    </span>
                    <span className="text-sm font-semibold text-amber-200">
                      {announcement.jadwal_latihan}
                    </span>
                  </div>
                </div>
              )}

              {announcement.catatan_khusus && (
                <div className="flex items-start gap-3 pt-1 border-t border-white/10">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                      Catatan Penjadwalan
                    </span>
                    <span className="text-xs text-slate-300">
                      {announcement.catatan_khusus}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-white/10 text-[11px] text-amber-300/90 flex items-center gap-1.5 italic">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Posisi penugasan akan dibagikan saat latihan secara langsung.</span>
              </div>
            </div>
          )}

          {/* Spiritual Encouragement Quote (Unassigned) */}
          {!isAssigned && (
            <div className="bg-white/5 border border-red-500/20 rounded-2xl p-4 text-xs text-slate-300 italic">
              &ldquo;Layanilah seorang akan yang lain, sesuai dengan karunia yang telah diperoleh tiap-tiap orang sebagai pengurus yang baik dari kasih karunia Allah.&rdquo;
              <span className="block mt-1 font-semibold not-italic text-slate-400">1 Petrus 4:10</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`w-full py-3 px-6 rounded-xl font-bold text-sm transition-all ${
                isAssigned
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              Tutup Pengumuman
            </button>

            {allowSearchOther && onSearchOther && (
              <button
                type="button"
                onClick={onSearchOther}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl font-semibold text-xs bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 transition-all"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Cari Anggota Lain</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
