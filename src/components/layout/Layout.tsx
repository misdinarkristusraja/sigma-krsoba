import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import NotificationBell from '../ui/NotificationBell';
import DarkModeToggle from '../ui/DarkModeToggle';
import NotificationPromptModal from '../ui/NotificationPromptModal';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Users, Calendar, CalendarDays, QrCode,
  ArrowLeftRight, BarChart2, CreditCard,
  Settings, LogOut, Menu, X, Church, AlertTriangle,
  ClipboardList, RefreshCw, ClipboardCheck, PartyPopper, ListChecks,
  BookUser, Star, Microscope, Globe, ChevronDown, TrendingUp, ShieldCheck,
  FileText, Wallet, HeartHandshake, Video, Camera, Shirt, Bell,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn, truncate } from '../../lib/utils';
import toast from 'react-hot-toast';

const STAFF = ['Administrator', 'Pengurus', 'Pendamping', 'Pelatih'];
const PENG  = ['Administrator', 'Pengurus', 'Pendamping'];
const ADMIN = ['Administrator'];

type NavItem = {
  icon: React.ElementType;
  label: string;
  path: string;
  roles: string[] | null;
  configKey?: string;
};

type NavGroup = {
  key: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'jadwal',
    label: 'Jadwal',
    icon: CalendarDays,
    items: [
      { icon: Globe,          label: 'Cek Jadwal Semua',  path: '/jadwal-misa',     roles: null },
      { icon: ListChecks,     label: 'Cek Jadwal Saya',   path: '/jadwal-saya',     roles: null },
      { icon: CalendarDays,   label: 'Cek Jadwal Harian', path: '/jadwal-harian',   roles: null },
      { icon: Calendar,       label: 'Buat Mingguan',     path: '/jadwal-mingguan', roles: PENG },
      { icon: ArrowLeftRight, label: 'Tukar Jadwal',      path: '/tukar-jadwal',    roles: null },
    ],
  },
  {
    key: 'presensi',
    label: 'Presensi',
    icon: ClipboardCheck,
    items: [
      { icon: QrCode,         label: 'Scan QR',         path: '/scan-qr',      roles: STAFF },
      { icon: Star,           label: 'Latihan Khusus',  path: '/scan-latihan', roles: STAFF },
      { icon: ClipboardCheck, label: 'Presensi Acara',  path: '/presensi',     roles: STAFF },
      { icon: ClipboardList,  label: 'Riwayat Scan',    path: '/riwayat-scan', roles: STAFF },
    ],
  },
  {
    key: 'anggota',
    label: 'Data Anggota',
    icon: Users,
    items: [
      { icon: Users,      label: 'Anggota',          path: '/anggota',   roles: STAFF },
      { icon: BookUser,   label: 'Direktori',         path: '/direktori', roles: PENG  },
      { icon: Microscope, label: 'Analisis Kualitas', path: '/analisis',  roles: PENG  },
    ],
  },
  {
    key: 'rekap',
    label: 'Profil & Rekap',
    icon: BarChart2,
    items: [
      { icon: TrendingUp,  label: 'Perkembangan Saya', path: '/perkembangan', roles: null },
      { icon: BarChart2,   label: 'Rekap Presensi',    path: '/rekap',        roles: null },
      { icon: CreditCard,  label: 'Kartu Anggota',     path: '/kartu',        roles: null },
      { icon: RefreshCw,   label: 'Daftar Ulang',      path: '/daftar-ulang', roles: null },
    ],
  },
  {
    key: 'kegiatan',
    label: 'Kegiatan',
    icon: PartyPopper,
    items: [
      { icon: PartyPopper, label: 'Acara',          path: '/acara',          roles: PENG },
      { icon: Star,        label: 'Poin Kegiatan',  path: '/poin-kegiatan', roles: PENG },
    ],
  },
  {
    key: 'pengurus_suite',
    label: 'Pengurus Suite',
    icon: ShieldCheck,
    items: [
      { icon: ShieldCheck,    label: 'Dashboard Pengurus', path: '/pengurus/ketua',      roles: PENG },
      { icon: FileText,       label: 'Sekretaris',         path: '/pengurus/sekretaris', roles: PENG },
      { icon: Wallet,         label: 'Bendahara',          path: '/pengurus/bendahara',  roles: PENG },
      { icon: HeartHandshake, label: 'Jasmani Rohani',     path: '/pengurus/jasroh',     roles: PENG },
      { icon: Video,          label: 'Multimedia',         path: '/pengurus/multimedia', roles: PENG },
      { icon: Camera,         label: 'Sakristan (PIC)',    path: '/pengurus/sakristan',  roles: PENG },
      { icon: Shirt,          label: 'Putsankris',         path: '/pengurus/putsankris', roles: PENG },
      { icon: Bell,           label: 'Pusat Notifikasi',   path: '/pengurus/notifikasi', roles: PENG },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: Settings,
    items: [
      { icon: Settings, label: 'Admin & Config', path: '/admin',   roles: ADMIN },
    ],
  },
];

// Bottom tab bar — 5 most-used items for mobile
const BOTTOM_TAB_ITEMS = [
  { icon: LayoutDashboard, label: 'Home',    path: '/dashboard'     },
  { icon: CalendarDays,    label: 'Harian',  path: '/jadwal-harian' },
  { icon: ListChecks,      label: 'Jadwal',  path: '/jadwal-saya'   },
  { icon: BarChart2,       label: 'Rekap',   path: '/rekap'         },
  { icon: CreditCard,      label: 'Kartu',   path: '/kartu'         },
];

export default function Layout() {
  const { profile, role, loading: authLoading, signOut } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open,       setOpen]      = useState(false);
  const [hiddenKeys, setHiddenKeys]= useState<Record<string, boolean>>({});
  // Default tertutup; auto-buka grup yang mengandung path aktif saat ini
  const [openGroups, setOpenGroups]= useState<Set<string>>(() => {
    const active = new Set<string>();
    const path = window.location.pathname;
    NAV_GROUPS.forEach(g => {
      if (g.items.some(i => i.path === path)) active.add(g.key);
    });
    return active;
  });

  useEffect(() => {
    supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['migration_enabled'])
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, boolean> = {};
        (data as { key: string; value: string }[]).forEach(row => { map[row.key] = row.value !== 'false'; });
        setHiddenKeys(map);
      });
  }, []);

  async function handleSignOut() {
    await signOut();
    toast.success('Berhasil logout');
    navigate('/login');
  }

  function canSeeItem(item: NavItem) {
    if (item.configKey && hiddenKeys[item.configKey] === false) return false;
    if (!item.roles) return true;
    if (!role) return true;
    return item.roles.includes(role);
  }

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const displayName = profile?.nama_panggilan || profile?.nickname || '...';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-brand-900/30">
        <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
          <Church size={18} className="text-white"/>
        </div>
        <div>
          <div className="font-bold text-white text-lg leading-none">SIGMA</div>
          <div className="text-[10px] text-brand-200 mt-0.5 leading-none">Misdinar KR Solo Baru</div>
        </div>
      </div>

      {/* Profile warning */}
      {!profile && !authLoading && (
        <div className="mx-3 mt-3 p-2 bg-yellow-500/20 rounded-lg flex items-start gap-2">
          <AlertTriangle size={13} className="text-yellow-300 flex-shrink-0 mt-0.5"/>
          <p className="text-[10px] text-yellow-200 leading-tight">
            Profil tidak ditemukan. Hubungi administrator.
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {/* Dashboard — standalone, always visible */}
        <NavLink to="/dashboard" onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn('nav-item', isActive ? 'nav-item-active' : 'nav-item-inactive text-brand-100/80')
          }>
          <LayoutDashboard size={17}/>
          <span className="text-sm">Dashboard</span>
        </NavLink>

        {/* Grouped nav items */}
        {NAV_GROUPS.map(group => {
          const visibleItems = group.items.filter(canSeeItem);
          if (!visibleItems.length) return null;

          const isGroupActive = visibleItems.some(i => location.pathname === i.path);
          const isOpen = openGroups.has(group.key);

          return (
            <div key={group.key}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors',
                  isGroupActive
                    ? 'text-white/90'
                    : 'text-brand-200/70 hover:text-brand-100',
                )}
              >
                <group.icon size={14} className="shrink-0"/>
                <span className="text-[11px] font-semibold uppercase tracking-wider flex-1">
                  {group.label}
                </span>
                <ChevronDown
                  size={13}
                  className={cn('shrink-0 transition-transform duration-200', isOpen ? 'rotate-0' : '-rotate-90')}
                />
              </button>

              {/* Items */}
              {isOpen && (
                <div className="ml-2 pl-2 border-l border-brand-700/50 space-y-0.5 mt-0.5 mb-1">
                  {visibleItems.map(item => (
                    <NavLink key={item.path} to={item.path} onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn('nav-item py-1.5', isActive ? 'nav-item-active' : 'nav-item-inactive text-brand-100/80')
                      }>
                      <item.icon size={15}/>
                      <span className="text-sm">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Profile footer */}
      <div className="p-3 border-t border-brand-900/30">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {displayName[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{truncate(displayName, 18)}</div>
            <div className="text-[11px] text-brand-200">{role?.replace('_', ' ') || 'Memuat...'}</div>
          </div>
          <button onClick={handleSignOut}
            className="p-1.5 rounded-lg text-brand-200 hover:text-white hover:bg-white/10"
            title="Logout">
            <LogOut size={15}/>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors duration-200">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 bg-gradient-to-b from-brand-950 via-slate-900 to-slate-950 text-slate-100 flex-col border-r border-slate-800 shadow-2xl">
        <SidebarContent/>
      </aside>

      {/* Mobile slide-in drawer */}
      <div className={`lg:hidden fixed inset-0 z-50 flex transition-all duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setOpen(false)}/>
        <aside className={`relative w-64 bg-gradient-to-b from-brand-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col z-10 shadow-2xl border-r border-slate-800 transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <button onClick={() => setOpen(false)}
            className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white transition-colors">
            <X size={20}/>
          </button>
          <SidebarContent/>
        </aside>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-sm flex-shrink-0">
          <button onClick={() => setOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300">
            <Menu size={20}/>
          </button>
          <div className="flex items-center gap-2">
            <Church size={18} className="text-brand-800 dark:text-brand-400"/>
            <span className="font-bold text-brand-800 dark:text-brand-400">SIGMA</span>
          </div>
          <div className="ml-auto">
            <NotificationBell/>
          </div>
        </header>

        {/* Desktop top header bar */}
        <header className="hidden lg:flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <Church size={20} className="text-brand-800 dark:text-brand-400"/>
            <span className="font-bold text-gray-900 dark:text-white text-sm">SIGMA System — Paroki Kristus Raja</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell/>
            <div className="h-4 w-px bg-gray-200 dark:bg-slate-700" />
            <div className="text-xs text-gray-600 dark:text-slate-300 font-medium">
              {displayName} <span className="text-brand-800 dark:text-brand-400 font-semibold">({role?.replace('_', ' ') || 'Misdinar'})</span>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              >
                <Outlet/>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 safe-area-inset-bottom">
          <div className="flex items-stretch h-14">
            {BOTTOM_TAB_ITEMS.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-brand-800' : 'text-gray-400 hover:text-gray-600',
                )}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
            <button
              onClick={() => setOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Menu size={20} strokeWidth={1.8} />
              <span>Lainnya</span>
            </button>
          </div>
        </nav>
      </div>
      <DarkModeToggle />
      <NotificationPromptModal />
    </div>
  );
}
