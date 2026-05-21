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
  // authReady: true once onAuthStateChange fires its first event (INITIAL_SESSION)
  const [authReady,    setAuthReady]    = useState(false);
  const [profileError, setProfileError] = useState(false);

  // loading = true until we know auth state AND profile result
  const loading = !authReady;

  const fetchProfile = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_profile');
      if (error) {
        console.error('fetchProfile RPC error:', error.message);
        setProfileError(true);
        setProfile(null);
        return;
      }
      if (data) {
        setProfileError(false);
        setProfile(data);
      } else {
        console.warn('fetchProfile: profil tidak ditemukan');
        setProfileError(true);
        setProfile(null);
      }
    } catch (err) {
      console.error('fetchProfile exception:', err);
      setProfileError(true);
      setProfile(null);
    }
  }, []);

  // Step 1: listen for auth state — synchronous only, no async work here.
  // onAuthStateChange does NOT await async callbacks, so doing async work
  // inside it causes setLoading(false) to race with fetchProfile completion.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        setProfileError(false);
      }
      // Mark auth as resolved after the first event (INITIAL_SESSION on mount)
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Step 2: fetch profile whenever user changes — fully decoupled from auth listener.
  useEffect(() => {
    if (!authReady) return;   // wait for first auth event
    if (user) {
      fetchProfile();
    }
  }, [user, authReady, fetchProfile]);

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
