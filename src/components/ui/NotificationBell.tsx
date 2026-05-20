import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Calendar, ArrowLeftRight, Flame, FileText, Info, CheckCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id:         string;
  user_id:    string;
  type:       string;
  title:      string;
  body:       string | null;
  is_read:    boolean;
  link:       string | null;
  created_at: string;
}

const TYPE_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  jadwal_reminder: { icon: Calendar,       color: 'text-brand-800 bg-brand-50'   },
  swap_request:    { icon: ArrowLeftRight,  color: 'text-purple-600 bg-purple-50' },
  streak:          { icon: Flame,           color: 'text-orange-500 bg-orange-50' },
  laporan:         { icon: FileText,        color: 'text-blue-600 bg-blue-50'     },
  info:            { icon: Info,            color: 'text-gray-600 bg-gray-100'    },
};

function timeAgo(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60)    return 'baru saja';
  if (diff < 3600)  return `${Math.floor(diff / 60)} mnt`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam`;
  return `${Math.floor(diff / 86400)} hr`;
}

export default function NotificationBell() {
  const { profile } = useAuth();
  const [open,    setOpen]    = useState(false);
  const [notifs,  setNotifs]  = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const unread = notifs.filter(n => !n.is_read).length;

  useEffect(() => {
    if (profile?.id) loadNotifs();
  }, [profile?.id]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    const ch = (supabase as any).channel('notifs-' + profile.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, (payload: any) => {
        setNotifs(n => [payload.new as Notification, ...n]);
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [profile?.id]);

  async function loadNotifs() {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setNotifs((data as Notification[]) || []);
    setLoading(false);
  }

  async function markRead(id: string) {
    await (supabase as any).from('notifications').update({ is_read: true }).eq('id', id);
    setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  }

  async function markAllRead() {
    const ids = notifs.filter(n => !n.is_read).map(n => n.id);
    if (!ids.length) return;
    await (supabase as any).from('notifications').update({ is_read: true }).in('id', ids);
    setNotifs(n => n.map(x => ({ ...x, is_read: true })));
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-all hover:scale-110 active:scale-95"
      >
        <Bell size={20} className="text-gray-600"/>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-[fadeIn_0.15s_ease-out]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm">🔔 Notifikasi</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead}
                  className="text-xs text-brand-800 hover:underline flex items-center gap-1">
                  <CheckCheck size={12}/> Tandai semua dibaca
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={14}/>
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="p-6 text-center text-gray-400 text-sm">Memuat...</div>
            ) : notifs.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={32} className="mx-auto text-gray-200 mb-2"/>
                <p className="text-sm text-gray-400">Belum ada notifikasi</p>
              </div>
            ) : notifs.map(n => {
              const meta  = TYPE_ICON[n.type] || TYPE_ICON.info;
              const Icon  = meta.icon;
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    markRead(n.id);
                    if (n.link) { navigate(n.link); setOpen(false); }
                  }}
                  className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${!n.is_read ? 'bg-blue-50/40' : ''}`}
                >
                  <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.color}`}>
                    <Icon size={16}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {n.title}
                    </p>
                    {n.body && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-gray-300 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2"/>}
                </div>
              );
            })}
          </div>

          {notifs.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">{notifs.length} notifikasi tersimpan</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
