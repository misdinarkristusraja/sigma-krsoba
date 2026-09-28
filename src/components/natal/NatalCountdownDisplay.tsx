import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Sparkles, AlertCircle, Clock, Zap, Calendar } from 'lucide-react';
import { CountdownState } from '../../hooks/useNatalCountdown';
import { soundEffects } from '../../lib/audioEffects';
import { formatNatalTargetTime } from '../../lib/natalUtils';

interface NatalCountdownDisplayProps {
  countdown: CountdownState;
  title?: string;
  targetIsoDate?: string;
  isPengurus?: boolean;
  onBypassCountdown?: () => void;
  isBypassed?: boolean;
}

export default function NatalCountdownDisplay({
  countdown,
  title = 'Pengumuman Penjadwalan Tugas Natal',
  targetIsoDate,
  isPengurus = false,
  onBypassCountdown,
  isBypassed = false,
}: NatalCountdownDisplayProps) {
  const [muted, setMuted] = useState(false);

  const toggleSound = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    soundEffects.setMuted(nextMuted);
    if (!nextMuted) {
      soundEffects.playTick();
    }
  };

  // Sound triggers based on tension level
  useEffect(() => {
    if (countdown.isExpired || muted) return;

    if (countdown.isUnder10Sec) {
      soundEffects.playHeartbeat('high');
      soundEffects.playTick();
    } else if (countdown.isUnder1Min) {
      soundEffects.playHeartbeat('high');
    } else if (countdown.isUnder5Min) {
      // Periodic heartbeat on even seconds
      if (countdown.seconds % 2 === 0) {
        soundEffects.playHeartbeat('low');
      }
    }
  }, [countdown.seconds, countdown.isUnder5Min, countdown.isUnder1Min, countdown.isUnder10Sec, countdown.isExpired, muted]);

  // Determine shake container class
  let shakeClass = '';
  if (!countdown.isExpired) {
    if (countdown.tensionLevel === 'climax') shakeClass = 'animate-tension-climax';
    else if (countdown.tensionLevel === 'critical') shakeClass = 'animate-tension-critical';
    else if (countdown.tensionLevel === 'rising') shakeClass = 'animate-tension-rising';
  }

  const timeUnits = [
    { label: 'HARI', value: countdown.days },
    { label: 'JAM', value: countdown.hours },
    { label: 'MENIT', value: countdown.minutes },
    { label: 'DETIK', value: countdown.seconds },
  ];

  return (
    <div className={`relative w-full max-w-4xl mx-auto rounded-3xl p-6 sm:p-10 transition-all duration-300 ${shakeClass} ${
      countdown.tensionLevel === 'climax'
        ? 'bg-gradient-to-b from-red-950/90 via-slate-900 to-black border-2 border-red-500 shadow-2xl shadow-red-600/30'
        : countdown.tensionLevel === 'critical'
        ? 'bg-gradient-to-b from-amber-950/80 via-slate-900 to-slate-950 border-2 border-amber-500 shadow-2xl shadow-amber-600/20'
        : countdown.tensionLevel === 'rising'
        ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-red-950/40 border border-red-500/40 shadow-xl'
        : 'bg-gradient-to-b from-slate-900/95 via-slate-900 to-slate-950 border border-slate-800 shadow-xl'
    } text-white`}>
      {/* Top action row */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wider uppercase text-amber-400">
          <Sparkles className="w-4 h-4 animate-spin text-amber-300" style={{ animationDuration: '6s' }} />
          <span>MISDINAR KRISTUS RAJA</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mute toggle button */}
          <button
            type="button"
            onClick={toggleSound}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-white/10 hover:bg-white/20 border border-white/15 transition-colors"
            title={muted ? 'Aktifkan Suara Ketegangan' : 'Matikan Suara'}
          >
            {muted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden sm:inline text-red-300">Suara Mati</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="hidden sm:inline text-emerald-300">Suara Aktif</span>
              </>
            )}
          </button>

          {/* Pengurus Bypass Button for Testing */}
          {isPengurus && onBypassCountdown && (
            <button
              type="button"
              onClick={onBypassCountdown}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                isBypassed
                  ? 'bg-amber-500 text-black border-amber-400 font-bold'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
              }`}
              title="Khusus Pengurus: Preview langsung tampilan pengumuman tanpa menunggu waktu habis"
            >
              <Zap className="w-3 h-3" />
              <span>{isBypassed ? 'Mode Nyata' : '⚡ Bypass Test'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Title */}
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
          {title}
        </h2>
        <p className="text-xs sm:text-base text-slate-300 max-w-xl mx-auto mb-4">
          Penugasan resmi untuk segenap misdinar yang melayani pada Hari Raya Natal.
        </p>

        {/* Target Day & Date Display */}
        {targetIsoDate && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/90 border border-amber-500/40 text-xs sm:text-sm text-amber-200 shadow-inner">
            <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Waktu Rilis:{' '}
              <strong className="text-white font-bold">{formatNatalTargetTime(targetIsoDate)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Urgent Warning Banner (< 5 Min) */}
      <AnimatePresence>
        {countdown.isUnder5Min && !countdown.isExpired && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`flex items-center justify-center gap-2 p-3 rounded-2xl mb-8 font-bold text-center text-xs sm:text-sm ${
              countdown.isUnder1Min
                ? 'bg-red-600/30 border border-red-500 text-red-200 animate-pulse'
                : 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
            }`}
          >
            <AlertCircle className="w-4 h-4 text-red-400 animate-bounce" />
            <span>
              {countdown.isUnder10Sec
                ? 'SIAP-SIAP! HITUNGAN MUNDUR TERAKHIR MENUJU PENGUMUMAN!'
                : countdown.isUnder1Min
                ? 'DETIK-DETIK MENDEBARKAN! KURANG DARI 1 MENIT LAGI!'
                : 'SIAPKAN DIRI ANDA! WAKTU PENGUMUMAN KURANG DARI 5 MENIT!'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown Grid Units */}
      <div className="grid grid-cols-4 gap-2 sm:gap-6 max-w-2xl mx-auto">
        {timeUnits.map((unit) => {
          const isSeconds = unit.label === 'DETIK';
          const isCritical = countdown.isUnder1Min && isSeconds;

          return (
            <div
              key={unit.label}
              className={`relative flex flex-col items-center justify-center p-3 sm:p-6 rounded-2xl border transition-all ${
                isCritical
                  ? 'bg-red-950/80 border-red-500 shadow-lg shadow-red-600/40 scale-105'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <span className={`font-mono text-3xl sm:text-6xl font-black tracking-tight ${
                isCritical
                  ? 'text-red-400 animate-pulse'
                  : countdown.isUnder5Min
                  ? 'text-amber-300'
                  : 'text-white'
              }`}>
                {String(unit.value).padStart(2, '0')}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-slate-400 uppercase mt-2">
                {unit.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-8 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Hasil akan terbuka otomatis saat countdown mencapai 00:00:00</span>
        </div>
        {targetIsoDate && (
          <span className="hidden sm:inline text-slate-600">•</span>
        )}
        {targetIsoDate && (
          <span className="text-amber-400/90 font-medium">Target: {formatNatalTargetTime(targetIsoDate)}</span>
        )}
      </div>
    </div>
  );
}
