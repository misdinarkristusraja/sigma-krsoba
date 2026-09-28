import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { NatalConfig, NatalAnnouncement } from '../types';

export function useNatalAnnouncement() {
  const { user, profile, isPengurus } = useAuth();
  const [config, setConfig] = useState<NatalConfig>({
    status: 'disabled',
    target_time: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
    title: 'Pengumuman Penjadwalan Tugas Natal',
    allow_search_others: false,
  });
  const [loading, setLoading] = useState(true);
  const [myAnnouncement, setMyAnnouncement] = useState<NatalAnnouncement | null>(null);
  const [bypassCountdown, setBypassCountdown] = useState(false);

  // Load config from system_config
  const loadConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('key, value')
        .in('key', [
          'natal_announcement_status',
          'natal_announcement_target_time',
          'natal_announcement_title',
          'natal_announcement_allow_search_others',
        ]);

      if (error) throw error;

      if (data) {
        const configMap: Record<string, string> = {};
        data.forEach((r: any) => { configMap[r.key] = r.value; });

        setConfig({
          status: (configMap['natal_announcement_status'] as any) || 'disabled',
          target_time: configMap['natal_announcement_target_time'] || new Date(Date.now() + 1000 * 60 * 10).toISOString(),
          title: configMap['natal_announcement_title'] || 'Pengumuman Penjadwalan Tugas Natal',
          allow_search_others: configMap['natal_announcement_allow_search_others'] === 'true',
        });
      }
    } catch {
      // Fallback defaults on network error
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch current user's announcement record
  const fetchMyAnnouncement = useCallback(async () => {
    if (!profile) return;
    try {
      // Try matching by user_id first
      const { data: byId } = await supabase
        .from('natal_announcements')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byId) {
        setMyAnnouncement(byId as NatalAnnouncement);
        return;
      }

      // Fallback matching by nama_panggilan / nickname
      const cleanPanggilan = (profile.nama_panggilan || profile.nickname || '').trim().toLowerCase();
      if (cleanPanggilan) {
        const { data: byName } = await supabase
          .from('natal_announcements')
          .select('*')
          .ilike('nama_panggilan', cleanPanggilan)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (byName) {
          setMyAnnouncement(byName as NatalAnnouncement);
          return;
        }
      }

      // If not found in table, generate default unassigned fallback record
      setMyAnnouncement({
        id: 'unassigned-fallback',
        user_id: profile.id,
        nama_lengkap: profile.nama_lengkap || profile.nama_panggilan || 'Anggota Misdinar',
        nama_panggilan: profile.nama_panggilan || profile.nickname || '',
        status_tugas: 'unassigned',
        tahun: new Date().getFullYear(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Graceful unassigned fallback
      setMyAnnouncement({
        id: 'unassigned-fallback',
        user_id: profile?.id,
        nama_lengkap: profile?.nama_lengkap || 'Anggota Misdinar',
        nama_panggilan: profile?.nama_panggilan || '',
        status_tugas: 'unassigned',
        tahun: new Date().getFullYear(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }, [profile]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (user && profile) {
      fetchMyAnnouncement();
    }
  }, [user, profile, fetchMyAnnouncement]);

  // Search by query (nickname / full name)
  const searchMember = async (query: string): Promise<NatalAnnouncement | null> => {
    const clean = query.trim().toLowerCase();
    if (!clean) return null;

    try {
      const { data } = await supabase
        .from('natal_announcements')
        .select('*')
        .or(`nama_panggilan.ilike.%${clean}%,nama_lengkap.ilike.%${clean}%`)
        .limit(1)
        .maybeSingle();

      return data as NatalAnnouncement | null;
    } catch {
      return null;
    }
  };

  // Determine if feature should be visible to current user
  const isVisible =
    config.status === 'published' ||
    (config.status === 'trial' && isPengurus);

  return {
    config,
    loading,
    isVisible,
    myAnnouncement,
    searchMember,
    bypassCountdown,
    setBypassCountdown,
    refreshConfig: loadConfig,
    refreshMyAnnouncement: fetchMyAnnouncement,
  };
}
