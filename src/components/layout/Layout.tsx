import React, { useState, useEffect } from 'react';
import NotificationBell from '../ui/NotificationBell';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Users, Calendar, CalendarDays, QrCode,
  ArrowLeftRight, BarChart2, CreditCard, Database,
  Settings, LogOut, Menu, X, Church, AlertTriangle,
  ClipboardList, RefreshCw, ClipboardCheck, PartyPopper, ListChecks,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn, truncate } from '../../lib/utils';
import toast from 'react-hot-toast';

const STAFF = ['Administrator', 'Pengurus', 'Pelatih'];
const PENG  = ['Administrator', 'Pengurus'];
const ADMIN = ['Administrator'];

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',       path: '/dashboard',       roles: null  },
  { icon: Users,           label: 'Anggota',         path: '/anggota',         roles: STAFF },
  { icon: Calendar,        label: 'Jadwal Mingguan', path: '/jadwal-mingguan', roles: PENG  },
  { icon: CalendarDays,    label: 'Misa Harian',     path: '/jadwal-harian',   roles: null  },
  { icon: QrCode,          label: 'Scan QR',         path: '/scan-qr',         roles: STAFF },
  { icon: ClipboardCheck,  label: 'Presensi Acara',  path: '/presensi',        roles: STAFF },
  { icon: PartyPopper,     label: 'Acara',            path: '/acara',           roles: PENG  },
  { icon: ClipboardList,   label: 'Riwayat Scan',    path: '/riwayat-scan',    roles: STAFF },
  { icon: ListChecks,      label: 'Jadwal Saya',     path: '/jadwal-saya',     roles: null  },
  { icon: ArrowLeftRight,  label: 'Tukar Jadwal',    path: '/tukar-jadwal',    roles: null  },
  { icon: BarChart2,       label: 'Rekap & Poin',    path: '/rekap',           roles: null  },
  { icon: CreditCard,      label: 'Kartu Anggota',   path: '/kartu',           roles: null  },
  { icon: RefreshCw,       label: 'Daftar Ulang',    path: '/daftar-ulang',    roles: null  },
  { icon: Database,        label: 'Migrasi Data',    path: '/migrasi',         roles: ADMIN, configKey: 'migration_enabled' },
  { icon: Settings,        label: 'Admin & Config',  path: '/admin',           roles: ADMIN },
];

// Bottom tab bar shows 5 most-used items for mobile
const BOTTOM_TAB_ITEMS = [
  { icon: LayoutDashboard, label: 'Home',    path: '/dashboard'     },
  { icon: CalendarDays,    label: 'Harian',  path: '/jadwal-harian' },
  { icon: ListChecks,      label: 'Jadwal',  path: '/jadwal-saya'   },
  { icon: BarChart2,       label: 'Rekap',   path: '/rekap'         },
  { icon: CreditCard,      label: 'Kartu',   path: '/kartu'         },
];

export default function Layout() {
  const { profile, role, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [open,       setOpen]      = useState(false);
  const [hiddenKeys, setHiddenKeys]= useState<Record<string, boolean>>({}); // { migration_enabled: false }

  // Fetch config flags yang bisa sembunyikan menu
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

  function canSeeItem(item: typeof NAV_ITEMS[0]) {
    // Cek config flag (misal migration_enabled = false → sembunyikan)
    if (item.configKey && hiddenKeys[item.configKey] === false) return false;
    if (!item.roles) return true;
    if (!role) return true; // belum load profile → tampilkan semua dulu
    return item.roles.includes(role);
  }

  const visibleItems = NAV_ITEMS.filter(canSeeItem);
  const displayName  = profile?.nama_panggilan || profile?.nickname || '...';

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
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {visibleItems.map(item => (
          <NavLink key={item.path} to={item.path} onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn('nav-item', isActive ? 'nav-item-active' : 'nav-item-inactive text-brand-100/80')
            }>
            <item.icon size={17}/>
            <span className="text-sm">{item.label}</span>
          </NavLink>
        ))}
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
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-brand-800 flex-col">
        <SidebarContent/>
      </aside>

      {/* Mobile slide-in drawer */}
      <div className={`lg:hidden fixed inset-0 z-50 flex transition-all duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)}/>
        <aside className={`relative w-64 bg-brand-800 flex flex-col z-10 shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <button onClick={() => setOpen(false)}
            className="absolute top-3 right-3 p-1.5 text-brand-200 hover:text-white transition-colors">
            <X size={20}/>
          </button>
          <SidebarContent/>
        </aside>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
          <button onClick={() => setOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <Menu size={20}/>
          </button>
          <div className="flex items-center gap-2">
            <Church size={18} className="text-brand-800"/>
            <span className="font-bold text-brand-800">SIGMA</span>
          </div>
          <div className="ml-auto">
            <NotificationBell/>
          </div>
        </header>

        {/* Scrollable content — leave room for bottom tab on mobile */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <Outlet/>
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
            {/* More — opens drawer */}
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
    </div>
  );
}
