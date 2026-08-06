import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../types';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user:         User | null;
  profile:      Profile | null;
  loading:      boolean;
  profileError: boolean;
  role:         UserRole | null;
  isAdmin:      boolean;
  isPengurus:   boolean;
  isPelatih:    boolean;
  canScan:      boolean;
  signIn:       (username: string, password: string) => Promise<any>;
  signOut:      () => Promise<void>;
  fetchProfile: () => Promise<void>;
  hasRole:      (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,         setUser]         = useState<User | null>(null);
  const [profile,      setProfile]      = useState<Profile | null>(null);
  const [loading,      setLoading]      = useState(true);
  // FIX BUG-006: tambahkan state profileError yang jelas.
  // Sebelumnya, semua jalur error (RPC gagal / data null) menggunakan fallback
  // { role: 'Misdinar_Aktif' } — ini berbahaya karena akun Pending bisa mendapat
  // akses seolah-olah sudah diapprove jika ada gangguan koneksi sementara.
  // Sekarang: error → profileError=true, profile=null.
  // ProtectedRoute di App.jsx menangani kondisi ini dengan pesan informatif.
  const [profileError, setProfileError] = useState(false);

  const fetchProfile = useCallback(async () => {
    // Retry up to 5x with progressive backoff — handles JWT propagation delay,
    // slow networks, and cold-start Supabase instances where RLS may not be
    // ready immediately after onAuthStateChange fires.
    const delays = [0, 400, 1000, 2000, 3500];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) {
        await new Promise(res => setTimeout(res, delays[attempt]));
      }
      try {
        const { data, error } = await supabase.rpc('get_my_profile');
        if (error) {
          console.warn(`fetchProfile attempt ${attempt + 1} error:`, error.message);
          if (attempt < delays.length - 1) continue;
          setProfileError(true);
          setProfile(null);
          return;
        }
        if (data) {
          setProfileError(false);
          setProfile(data);
          return;
        }
        // null data — profile not found or JWT not yet propagated, retry
        console.warn(`fetchProfile attempt ${attempt + 1}: null data`);
        if (attempt < delays.length - 1) continue;
        // All attempts failed — account genuinely missing or not approved
        setProfileError(true);
        setProfile(null);
      } catch (err) {
        console.error(`fetchProfile attempt ${attempt + 1} exception:`, err);
        if (attempt < delays.length - 1) continue;
        setProfileError(true);
        setProfile(null);
      }
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) await fetchProfile();
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Delay singkat (150ms) dipertahankan untuk memberi waktu Supabase Auth
        // menyelesaikan sinkronisasi session sebelum memanggil RPC get_my_profile.
        // Tanpa ini, RPC kadang dipanggil sebelum JWT ter-propagate ke DB,
        // menyebabkan RLS gagal dan profile null.
        setTimeout(() => fetchProfile(), 150);
      } else {
        setProfile(null);
        setProfileError(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Login dengan USERNAME saja (bukan email)
  async function signIn(username: string, password: string) {
    // Simple client-side hash for rate-limit bucketing (best-effort, not crypto)
    const clientHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(navigator.userAgent + window.location.hostname)
    ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''))
    .catch(() => 'unknown');

    // 1. Cari email dari nickname via RPC (SECURITY DEFINER — bypass RLS)
    const { data: email, error: lookupErr } = await (supabase as any).rpc('get_email_by_nickname', {
      p_nickname:    username.toLowerCase().trim(),
      p_client_hash: clientHash,
    });

    if (lookupErr || !email) {
      throw new Error(`Username "${username}" tidak ditemukan di SIGMA`);
    }

    // 2. Login dengan email yang ditemukan
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Set state user secara sinkronus agar router/context segera ter-update
    if (data.session?.user) {
      setUser(data.session.user);
    }

    // 3. Fetch profile — onAuthStateChange juga akan memanggil fetchProfile,
    // tapi kita panggil di sini juga agar UI login langsung responsif.
    await fetchProfile();
    return data;
  }

  async function signOut() {
    setUser(null);
    setProfile(null);
    setProfileError(false);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('signOut error:', err);
    }
  }

  const role       = (profile?.role ?? null) as UserRole | null;
  const isAdmin    = role === 'Administrator';
  const isPengurus = role != null && ['Administrator', 'Pengurus', 'Pendamping'].includes(role);
  const isPelatih  = role != null && ['Administrator', 'Pengurus', 'Pendamping', 'Pelatih'].includes(role);
  const canScan    = isPelatih;

  function hasRole(...roles: UserRole[]) { return role != null && roles.includes(role); }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, profileError,
      signIn, signOut, fetchProfile,
      isAdmin, isPengurus, isPelatih, canScan, role, hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai dalam AuthProvider');
  return ctx;
}
