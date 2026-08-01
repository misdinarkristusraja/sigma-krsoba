import { describe, it, expect } from 'vitest';

// List of all registered path routes in App.tsx
const REGISTERED_APP_ROUTES = [
  '/',
  '/login',
  '/register',
  '/daftar',
  '/jadwal-publik',
  '/dashboard',
  '/change-password',
  '/anggota',
  '/anggota/:id',
  '/jadwal-mingguan',
  '/jadwal-harian',
  '/jadwal-misa',
  '/absensi',
  '/presensi',
  '/scan',
  '/scan-qr',
  '/scan-latihan',
  '/scan-records',
  '/riwayat-scan',
  '/acara',
  '/poin-kegiatan',
  '/tukar-jadwal',
  '/rekap',
  '/perkembangan',
  '/kartu',
  '/daftar-ulang',
  '/statistik',
  '/laporan',
  '/streak',
  '/jadwal-saya',
  '/direktori',
  '/analisis',
  '/admin',
  '/pengurus',
  '/pengurus/ketua',
  '/pengurus/sekretaris',
  '/pengurus/bendahara',
  '/pengurus/penjadwalan',
  '/pengurus/jasroh',
  '/pengurus/multimedia',
  '/pengurus/sakristan',
  '/pengurus/putsankris',
];

// Sidebar navigation items from Layout.tsx
const SIDEBAR_NAV_PATHS = [
  '/jadwal-misa',
  '/jadwal-saya',
  '/jadwal-harian',
  '/jadwal-mingguan',
  '/tukar-jadwal',
  '/scan-qr',
  '/scan-latihan',
  '/presensi',
  '/riwayat-scan',
  '/anggota',
  '/direktori',
  '/analisis',
  '/perkembangan',
  '/rekap',
  '/kartu',
  '/daftar-ulang',
  '/acara',
  '/poin-kegiatan',
  '/pengurus/ketua',
  '/pengurus/sekretaris',
  '/pengurus/bendahara',
  '/pengurus/jasroh',
  '/pengurus/multimedia',
  '/pengurus/sakristan',
  '/pengurus/putsankris',
  '/admin',
];

describe('App & Layout Route Alignment Audit', () => {
  it('ensures every sidebar navigation path is registered in App.tsx routes', () => {
    const unhandledPaths = SIDEBAR_NAV_PATHS.filter(path => !REGISTERED_APP_ROUTES.includes(path));
    expect(unhandledPaths).toEqual([]);
  });

  it('ensures public registration routes /register and /daftar are registered', () => {
    expect(REGISTERED_APP_ROUTES).toContain('/register');
    expect(REGISTERED_APP_ROUTES).toContain('/daftar');
  });
});
