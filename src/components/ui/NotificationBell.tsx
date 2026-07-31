import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../../contexts/AuthContext';
import { Bell, CheckCheck, ExternalLink, ShieldAlert, Sparkles, Volume2 } from 'lucide-react';
import { formatNotificationLabel } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function NotificationBell() {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [open, setOpen]                   = useState(false);
  const [pushGranted, setPushGranted]     = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushGranted(Notification.permission === 'granted');
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const items = data || [];
      setNotifications(items);
      setUnreadCount(items.filter((n: any) => !n.is_read).length);
    } catch (err) {
      console.warn('Load notifications error:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const requestWebPushPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Browser ini tidak mendukung Web Push Notification.');
      return;
    }
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      setPushGranted(true);
      toast.success('🔔 Notifikasi Browser berhasil diaktifkan!');
      new Notification('SIGMA Notifikasi Aktif', {
        body: 'Terima kasih! Anda akan menerima pengingat tugas H-1 & info terbaru.',
        icon: '/favicon.ico'
      });
    } else {
      toast.error('Izin notifikasi ditolak oleh browser.');
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id || unreadCount === 0) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    toast.success('Semua notifikasi ditandai dibaca');
  };

  const markAsRead = async (id: string, linkUrl?: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    if (linkUrl) {
      setOpen(false);
      window.location.href = linkUrl;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-gray-600 hover:text-brand-800 hover:bg-gray-100 transition-colors"
        title="Notifikasi"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden space-y-0">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              <span className="font-bold text-sm">Notifikasi Saya</span>
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-[11px] text-amber-300 hover:underline flex items-center gap-1 font-medium">
                <CheckCheck size={13} /> Tandai Dibaca
              </button>
            )}
          </div>

          {/* Web Push Prompt */}
          {!pushGranted && (
            <div className="p-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between text-xs text-amber-900">
              <span>Aktifkan pengingat H-1 di browser:</span>
              <button onClick={requestWebPushPermission} className="btn-xs bg-amber-600 text-white hover:bg-amber-700 rounded-lg">
                Aktifkan
              </button>
            </div>
          )}

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 space-y-1">
                <Bell size={32} className="mx-auto text-gray-300" />
                <p className="text-xs font-medium">Belum ada notifikasi baru</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id, n.link_url)}
                  className={`p-3 text-left transition-colors cursor-pointer hover:bg-gray-50 ${!n.is_read ? 'bg-brand-50/50 font-semibold' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-bold text-brand-800">
                      {formatNotificationLabel(n.tipe)}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(n.created_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-gray-900 leading-tight">{n.judul || n.title || 'Pengumuman'}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">{n.pesan || n.body || n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
