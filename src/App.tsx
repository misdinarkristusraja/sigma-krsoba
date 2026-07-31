import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import LoadingScreen from './components/ui/LoadingScreen';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { lazyWithRetry as lazy } from './lib/lazyWithRetry';

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
const StreakPage         = lazy(() => import('./pages/StreakPage'));
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
const NotificationAdminPage = lazy(() => import('./pages/pengurus/NotificationAdminPage'));

const ADMIN = ['Administrator'];
const PENG  = ['Administrator', 'Pengurus', 'Pendamping'];
const STAFF = ['Administrator', 'Pengurus', 'Pendamping', 'Pelatih'];

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] | null }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user)   return <Navigate to="/login" replace />;

  if (profile?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user)    return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/jadwal-publik" element={<PublicSchedule />} />

            {/* Protected routes wrapped in Layout */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/"                element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"       element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="/change-password" element={<ErrorBoundary><ChangePasswordPage /></ErrorBoundary>} />
              <Route path="/anggota"         element={<ProtectedRoute roles={PENG}><ErrorBoundary><MembersPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/anggota/:id"     element={<ProtectedRoute roles={PENG}><ErrorBoundary><MemberDetailPage /></ErrorBoundary></ProtectedRoute>} />

              {/* Schedule */}
              <Route path="/jadwal-mingguan" element={<ErrorBoundary><ScheduleWeekly /></ErrorBoundary>} />
              <Route path="/jadwal-harian"   element={<ErrorBoundary><ScheduleDaily /></ErrorBoundary>} />
              <Route path="/jadwal-misa"     element={<ErrorBoundary><JadwalMisa /></ErrorBoundary>} />

              {/* Attendance & Scan */}
              <Route path="/absensi"         element={<ProtectedRoute roles={STAFF}><ErrorBoundary><AttendancePage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/presensi"        element={<ProtectedRoute roles={STAFF}><ErrorBoundary><AttendancePage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/scan"            element={<ProtectedRoute roles={STAFF}><ErrorBoundary><ScanPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/scan-qr"         element={<ProtectedRoute roles={STAFF}><ErrorBoundary><ScanPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/scan-latihan"    element={<ProtectedRoute roles={STAFF}><ErrorBoundary><ScanLatihanPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/scan-records"    element={<ProtectedRoute roles={STAFF}><ErrorBoundary><ScanRecordsPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/riwayat-scan"    element={<ProtectedRoute roles={STAFF}><ErrorBoundary><ScanRecordsPage /></ErrorBoundary></ProtectedRoute>} />

              {/* Event & Points */}
              <Route path="/acara"           element={<ProtectedRoute roles={PENG}><ErrorBoundary><AcaraPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/poin-kegiatan"   element={<ProtectedRoute roles={PENG}><ErrorBoundary><PoinKegiatanPage /></ErrorBoundary></ProtectedRoute>} />

              {/* Swap, Recap, Cards */}
              <Route path="/tukar-jadwal"    element={<ErrorBoundary><SwapPage /></ErrorBoundary>} />
              <Route path="/rekap"           element={<ErrorBoundary><RecapPage /></ErrorBoundary>} />
              <Route path="/perkembangan"    element={<ErrorBoundary><MyGrowthPage /></ErrorBoundary>} />
              <Route path="/kartu"           element={<ErrorBoundary><CardsPage /></ErrorBoundary>} />
              <Route path="/daftar-ulang"    element={<ErrorBoundary><ReregistrationPage /></ErrorBoundary>} />
              <Route path="/statistik"       element={<ProtectedRoute roles={PENG}><ErrorBoundary><StatistikPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/laporan"         element={<ProtectedRoute roles={PENG}><ErrorBoundary><LaporanPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/streak"          element={<ErrorBoundary><StreakPage /></ErrorBoundary>} />
              <Route path="/jadwal-saya"     element={<ErrorBoundary><JadwalSayaPage /></ErrorBoundary>} />
              <Route path="/direktori"       element={<ProtectedRoute roles={PENG}><ErrorBoundary><DirectoryPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/analisis"        element={<ProtectedRoute roles={PENG}><ErrorBoundary><AnalisisPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/admin"           element={<ProtectedRoute roles={ADMIN}><ErrorBoundary><AdminPage /></ErrorBoundary></ProtectedRoute>} />

              {/* Pengurus Suite — PENG / STAFF roles only */}
              <Route path="/pengurus" element={<ProtectedRoute roles={PENG}><ErrorBoundary><PengurusLayout /></ErrorBoundary></ProtectedRoute>}>
                <Route index element={<Navigate to="/pengurus/ketua" replace />} />
                <Route path="ketua" element={<KetuaPage />} />
                <Route path="sekretaris" element={<SekretarisPage />} />
                <Route path="bendahara" element={<BendaharaPage />} />
                <Route path="penjadwalan" element={<Navigate to="/jadwal-mingguan" replace />} />
                <Route path="jasroh" element={<JasrohPage />} />
                <Route path="multimedia" element={<MultimediaPage />} />
                <Route path="sakristan" element={<SakristanPage />} />
                <Route path="putsankris" element={<PutsankrisPage />} />
                <Route path="notifikasi" element={<NotificationAdminPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  );
}
