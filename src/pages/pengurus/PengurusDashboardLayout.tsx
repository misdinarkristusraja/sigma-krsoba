import React from 'react';
import { Outlet, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  ShieldCheck, FileText, Wallet, Calendar, HeartHandshake,
  Video, Camera, Shirt, Sparkles, AlertTriangle
} from 'lucide-react';

const DIVISI_NAV = [
  { key: 'ketua',       label: 'Ketua / Executive', icon: ShieldCheck,     path: '/pengurus/ketua' },
  { key: 'sekretaris',  label: 'Sekretaris',        icon: FileText,        path: '/pengurus/sekretaris' },
  { key: 'bendahara',   label: 'Bendahara',         icon: Wallet,          path: '/pengurus/bendahara' },
  { key: 'penjadwalan', label: 'Penjadwalan',       icon: Calendar,        path: '/pengurus/penjadwalan' },
  { key: 'jasroh',      label: 'Jasmani Rohani',    icon: HeartHandshake,  path: '/pengurus/jasroh' },
  { key: 'multimedia',  label: 'Multimedia',        icon: Video,           path: '/pengurus/multimedia' },
  { key: 'sakristan',   label: 'Sakristan (PIC)',   icon: Camera,          path: '/pengurus/sakristan' },
  { key: 'putsankris',  label: 'Putsankris',        icon: Shirt,           path: '/pengurus/putsankris' },
];

export default function PengurusDashboardLayout() {
  const { profile, isPengurus, isAdmin } = useAuth();
  const location = useLocation();

  if (!profile || (!isPengurus && !isAdmin)) {
    return <Navigate to="/dashboard" replace />;
  }

  const userDivisi = (profile.divisi || '').toLowerCase();
  const isExecutive = ['ketua', 'sekretaris', 'bendahara'].includes(userDivisi) || isAdmin || profile.role === 'Administrator';

  return (
    <div className="space-y-6 pb-12">
      {/* Pengurus Header */}
      <div className="card bg-gradient-to-r from-red-900 to-purple-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
              <ShieldCheck size={32} className="text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-red-200 text-xs font-semibold uppercase tracking-wider">
                <Sparkles size={14} className="text-amber-300" /> Pengurus Suite SIGMA
              </div>
              <h1 className="text-2xl font-bold text-white">Dashboard Pengurus Divisi</h1>
              <p className="text-xs text-red-100 mt-0.5">
                Pengguna: <strong>{profile.nama_panggilan}</strong> ({profile.role}) · Divisi: <span className="bg-amber-300/20 text-amber-200 px-2 py-0.5 rounded font-bold">{profile.divisi || 'Umum'}</span>
              </p>
            </div>
          </div>

          {isExecutive && (
            <span className="text-xs bg-amber-300 text-amber-950 px-3 py-1 rounded-full font-bold shadow-sm flex items-center gap-1 w-fit">
              ⭐ Akses Lintas Divisi (Executive Access)
            </span>
          )}
        </div>
      </div>

      {/* Navigation Switcher Tabs (For Executive or allowed division) */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {DIVISI_NAV.map((nav) => {
            const Icon = nav.icon;
            const isAllowed = isExecutive || userDivisi === nav.key || !profile.divisi;
            const isActive = location.pathname === nav.path;

            if (!isAllowed) return null;

            return (
              <NavLink
                key={nav.key}
                to={nav.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-red-800 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <Icon size={15} />
                {nav.label}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Division Content Outlet */}
      <Outlet />
    </div>
  );
}
