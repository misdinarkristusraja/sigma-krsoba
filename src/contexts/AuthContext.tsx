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
    try {
      const { data, error } = await supabase.rpc('get_my_profile');

      if (error) {
        console.error('fetchProfile RPC error:', error.message);
        // Jangan beri role default — set error state agar UI menampilkan pesan jelas
        setProfileError(true);
        setProfile(null);
        return;
      }

      if (data) {
        setProfileError(false);
        setProfile(data);
      } else {
        // Profil tidak ditemukan: akun mungkin belum diapprove (status Pending)
        // atau ada masalah RLS. Jangan grant akses default.
        console.warn('fetchProfile: profil tidak ditemukan (akun mungkin belum diapprove)');
        setProfileError(true);
        setProfile(null);
      }
    } catch (err) {
      console.error('fetchProfile exception:', err);
      setProfileError(true);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount — use it as single source of truth.
    // Do NOT also call fetchProfile from getSession to avoid double-fetch race condition
    // where the second call (via setTimeout) can land first with an error, setting
    // profileError=true before the first call resolves with valid data.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile();
      } else {
        setProfile(null);
        setProfileError(false);
      }
      setLoading(false);
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

    // onAuthStateChange will fire SIGNED_IN and call fetchProfile — don't duplicate here
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setProfileError(false);
  }

  const role       = (profile?.role ?? null) as UserRole | null;
  const isAdmin    = role === 'Administrator';
  const isPengurus = role != null && ['Administrator', 'Pengurus'].includes(role);
  const isPelatih  = role != null && ['Administrator', 'Pengurus', 'Pelatih'].includes(role);
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
