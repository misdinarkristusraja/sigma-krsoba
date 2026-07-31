import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import LoadingScreen from './components/ui/LoadingScreen';
import ErrorBoundary from './components/ui/ErrorBoundary';

const LoginPage          = lazy(() => import('./pages/LoginPage'));
const RegisterPage       = lazy(() => import('./pages/RegisterPage'));
const DashboardPage      = lazy(() => import('./pages/DashboardPage'));
const MembersPage        = lazy(() => import('./pages/MembersPage'));
const MemberDetailPage   = lazy(() => import('./pages/MemberDetailPage'));
const ScheduleWeekly     = lazy(() => import('./pages/schedule/ScheduleWeeklyPage'));
const ScheduleDaily      = lazy(() => import('./pages/ScheduleDailyPage'));
const ScanPage           = lazy(() => import('./pages/ScanPage'));
const ScanLatihanPage    = lazy(() => import('./pages/ScanLatihanPage'));
const ScanRecordsPage    = lazy(() => import('./pages/ScanRecordsPage'));
const SwapPage           = lazy(() => import('./pages/SwapPage'));
const RecapPage          = lazy(() => import('./pages/RecapPage'));
const CardsPage          = lazy(() => import('./pages/CardsPage'));
const AdminPage          = lazy(() => import('./pages/AdminPage'));
const AttendancePage     = lazy(() => import('./pages/AttendancePage'));
const AcaraPage          = lazy(() => import('./pages/AcaraPage'));
const PoinKegiatanPage   = lazy(() => import('./pages/PoinKegiatanPage'));
const MyGrowthPage       = lazy(() => import('./pages/MyGrowthPage'));
const ReregistrationPage = lazy(() => import('./pages/ReregistrationPage'));
const StatistikPage      = lazy(() => import('./pages/StatistikPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const LaporanPage        = lazy(() => import('./pages/LaporanPage'));
const StreakPage          = lazy(() => import('./pages/StreakPage'));
const JadwalSayaPage     = lazy(() => import('./pages/JadwalSayaPage'));
const DirectoryPage      = lazy(() => import('./pages/DirectoryPage'));
const AnalisisPage       = lazy(() => import('./pages/AnalisisPage'));
const PublicSchedule     = lazy(() => import('./pages/ScheduleDailyPage').then(m => ({ default: m.PublicSchedulePage })));
const JadwalMisa         = lazy(() => import('./pages/ScheduleDailyPage').then(m => ({ default: m.InternalSchedulePage })));
const NotFound           = lazy(() => import('./pages/ScheduleDailyPage').then(m => ({ default: m.NotFoundPage })));

const PengurusLayout    = lazy(() => import('./pages/pengurus/PengurusDashboardLayout'));
const KetuaPage         = lazy(() => import('./pages/pengurus/KetuaPage'));
const SekretarisPage    = lazy(() => import('./pages/pengurus/SekretarisPage'));
const BendaharaPage     = lazy(() => import('./pages/pengurus/BendaharaPage'));
const JasrohPage        = lazy(() => import('./pages/pengurus/JasrohPage'));
const MultimediaPage    = lazy(() => import('./pages/pengurus/MultimediaPage'));
const SakristanPage     = lazy(() => import('./pages/pengurus/SakristanPage'));
const PutsankrisPage    = lazy(() => import('./pages/pengurus/PutsankrisPage'));

const ADMIN = ['Administrator'];
const PENG  = ['Administrator', 'Pengurus', 'Pendamping'];
const STAFF = ['Administrator', 'Pengurus', 'Pendamping', 'Pelatih'];

/**
 * ProtectedRoute — penjaga akses berbasis login dan role.
 *
 * FIX BUG-006 (lanjutan): Konsumsi profileError dari AuthContext.
 * Jika profil gagal dimuat (RPC error / akun belum approved), tampilkan
 * pesan informatif daripada loading selamanya atau memberi akses default.
 */
function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, profile, profileError, loading } = useAuth();

  if (loading) return <LoadingScreen/>;
  if (!user)   return <Navigate to="/login" replace/>;

  // Profil error: tampilkan pesan jelas, bukan loading selamanya
  if (profileError && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Profil tidak dapat dimuat</h2>
          <p className="text-gray-500 text-sm mb-5 leading-relaxed">
            Akunmu mungkin belum disetujui Admin, atau terjadi gangguan koneksi sementara.
            Coba refresh halaman atau hubungi Pengurus jika masalah berlanjut.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-red-800 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Refresh Halaman
          </button>
        </div>
      </div>
    );
  }

  // Masih menunggu profile selesai di-fetch (normal loading)
  if (!profile) return <LoadingScreen/>;

  if (roles && !roles.includes(profile.role))
    return <Navigate to="/dashboard" replace/>;

  return children;
}

function AppRoutes() {
  const { user, profile, loading, profileError } = useAuth();
  if (loading) return <LoadingScreen/>;
  // Wait for profile fetch before rendering — prevents whitescreen flash on /ganti-password
  if (user && !profile && !profileError) return <LoadingScreen/>;

  // Force change password jika flag aktif
  const path = window.location.pathname;
  if (user && profile?.must_change_password &&
      path !== '/ganti-password' && path !== '/login') {
    return <Navigate to="/ganti-password" replace/>;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen/>}>
        <Routes>
          {/* Public */}
          <Route path="/login"          element={user ? <Navigate to="/dashboard"/> : <LoginPage/>}/>
          <Route path="/daftar"         element={<RegisterPage/>}/>
          <Route path="/jadwal"         element={<PublicSchedule/>}/>
          {/* Ganti password — butuh user login tapi tidak butuh Layout */}
          <Route path="/ganti-password" element={user ? <ChangePasswordPage/> : <Navigate to="/login"/>}/>

          {/* Protected + Layout */}
          <Route element={<ProtectedRoute roles={undefined}><Layout/></ProtectedRoute>}>
            <Route index                   element={<Navigate to="/dashboard"/>}/>
            <Route path="/dashboard"       element={<ErrorBoundary><DashboardPage/></ErrorBoundary>}/>

            {/* Daftar anggota — STAFF only */}
            <Route path="/anggota"         element={<ProtectedRoute roles={STAFF}><ErrorBoundary><MembersPage/></ErrorBoundary></ProtectedRoute>}/>

            {/*
              FIX BUG-005: Sebelumnya /anggota/:id tidak memiliki ProtectedRoute dengan roles,
              sehingga Misdinar_Aktif dan Misdinar_Retired bisa mengakses halaman detail
              anggota manapun langsung via URL — termasuk hp_ortu, alamat, nama orang tua
              yang menurut SKPL N10 hanya boleh dilihat Admin & Pengurus.
              Sekarang ditambahkan roles={STAFF} agar Pelatih+ yang bisa mengakses.
            */}
            <Route path="/anggota/:id"     element={<ProtectedRoute roles={STAFF}><ErrorBoundary><MemberDetailPage/></ErrorBoundary></ProtectedRoute>}/>

            <Route path="/jadwal-mingguan" element={<ProtectedRoute roles={PENG}><ErrorBoundary><ScheduleWeekly/></ErrorBoundary></ProtectedRoute>}/>
            <Route path="/jadwal-harian"   element={<ErrorBoundary><ScheduleDaily/></ErrorBoundary>}/>
            <Route path="/jadwal-misa"    element={<ErrorBoundary><JadwalMisa/></ErrorBoundary>}/>
            <Route path="/scan-qr"         element={<ProtectedRoute roles={STAFF}><ErrorBoundary><ScanPage/></ErrorBoundary></ProtectedRoute>}/>
            <Route path="/scan-latihan"   element={<ProtectedRoute roles={STAFF}><ErrorBoundary><ScanLatihanPage/></ErrorBoundary></ProtectedRoute>}/>
            <Route path="/presensi"        element={<ProtectedRoute roles={STAFF}><ErrorBoundary><AttendancePage/></ErrorBoundary></ProtectedRoute>}/>
            <Route path="/acara"           element={<ProtectedRoute roles={PENG}><ErrorBoundary><AcaraPage/></ErrorBoundary></ProtectedRoute>}/>
            <Route path="/poin-kegiatan"  element={<ProtectedRoute roles={PENG}><ErrorBoundary><PoinKegiatanPage/></ErrorBoundary></ProtectedRoute>}/>
            <Route path="/riwayat-scan"    element={<ProtectedRoute roles={STAFF}><ErrorBoundary><ScanRecordsPage/></ErrorBoundary></ProtectedRoute>}/>
            <Route path="/tukar-jadwal"    element={<ErrorBoundary><SwapPage/></ErrorBoundary>}/>
            <Route path="/rekap"           element={<ErrorBoundary><RecapPage/></ErrorBoundary>}/>
            <Route path="/perkembangan"    element={<ErrorBoundary><MyGrowthPage/></ErrorBoundary>}/>
            <Route path="/kartu"           element={<ErrorBoundary><CardsPage/></ErrorBoundary>}/>
            <Route path="/daftar-ulang"    element={<ErrorBoundary><ReregistrationPage/></ErrorBoundary>}/>
            <Route path="/statistik"       element={<ProtectedRoute roles={PENG}><ErrorBoundary><StatistikPage/></ErrorBoundary></ProtectedRoute>}/>
            <Route path="/laporan"         element={<ProtectedRoute roles={PENG}><ErrorBoundary><LaporanPage/></ErrorBoundary></ProtectedRoute>}/>
            <Route path="/streak"          element={<ErrorBoundary><StreakPage/></ErrorBoundary>}/>
            <Route path="/jadwal-saya"     element={<ErrorBoundary><JadwalSayaPage/></ErrorBoundary>}/>
            <Route path="/direktori"       element={<ProtectedRoute roles={PENG}><ErrorBoundary><DirectoryPage/></ErrorBoundary></ProtectedRoute>}/>
            <Route path="/analisis"        element={<ProtectedRoute roles={PENG}><ErrorBoundary><AnalisisPage/></ErrorBoundary></ProtectedRoute>}/>
            <Route path="/admin"           element={<ProtectedRoute roles={ADMIN}><ErrorBoundary><AdminPage/></ErrorBoundary></ProtectedRoute>}/>

            {/* Pengurus Suite — PENG / STAFF roles only */}
            <Route path="/pengurus" element={<ProtectedRoute roles={PENG}><ErrorBoundary><PengurusLayout/></ErrorBoundary></ProtectedRoute>}>
              <Route index element={<Navigate to="/pengurus/ketua" replace/>}/>
              <Route path="ketua" element={<KetuaPage/>}/>
              <Route path="sekretaris" element={<SekretarisPage/>}/>
              <Route path="bendahara" element={<BendaharaPage/>}/>
              <Route path="penjadwalan" element={<Navigate to="/jadwal-mingguan" replace/>}/>
              <Route path="jasroh" element={<JasrohPage/>}/>
              <Route path="multimedia" element={<MultimediaPage/>}/>
              <Route path="sakristan" element={<SakristanPage/>}/>
              <Route path="putsankris" element={<PutsankrisPage/>}/>
            </Route>
          </Route>

          <Route path="*" element={<NotFound/>}/>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes/>
      </AuthProvider>
    </ErrorBoundary>
  );
}
