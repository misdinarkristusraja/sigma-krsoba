import React, { useState, useEffect } from 'react';
import { Bell, Sparkles, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NotificationPromptModal() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Only prompt if browser supports Notification and permission is 'default' (not yet answered)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const isDefault = Notification.permission === 'default';
      const dismissedRecently = sessionStorage.getItem('sigma_notif_prompt_dismissed');
      if (isDefault && !dismissedRecently) {
        // Short delay for smoother initial load UX
        const timer = setTimeout(() => setShowPrompt(true), 1200);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleAllow = async () => {
    try {
      const permission = await Notification.requestPermission();
      setShowPrompt(false);
      if (permission === 'granted') {
        toast.success('🔔 Notifikasi Browser berhasil diaktifkan!');
        new Notification('SIGMA Notifikasi Aktif ✨', {
          body: 'Pengingat H-1 Tugas Misa & Latihan akan langsung terkirim ke HP/Laptop Anda.',
          icon: '/favicon.ico'
        });
      } else {
        toast('Izin notifikasi ditolak di browser', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error(err);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('sigma_notif_prompt_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-slate-800 space-y-5 text-center">
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="w-16 h-16 mx-auto rounded-3xl bg-brand-50 dark:bg-brand-950/60 text-brand-800 dark:text-brand-300 flex items-center justify-center shadow-inner">
          <Bell size={32} className="animate-bounce" />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-full text-[11px] font-bold tracking-wide">
            ✨ Fitur Baru SIGMA
          </span>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Aktifkan Pengingat H-1 Tugas &amp; Info Misa?
          </h3>
          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
            Dapatkan pengingat otomatis <strong>H-1 Tugas Misa</strong>, <strong>H-1 Latihan</strong>, serta pengumuman penting langsung di HP &amp; Laptop Anda tanpa perlu khawatir lupa bertugas.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={handleAllow}
            className="flex-1 btn-primary py-3 rounded-2xl font-bold text-sm shadow-lg gap-2 justify-center"
          >
            <Check size={18} /> Izinkan Notifikasi
          </button>
          <button
            onClick={handleDismiss}
            className="btn-ghost py-3 text-xs text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl"
          >
            Nanti Saja
          </button>
        </div>
      </div>
    </div>
  );
}
