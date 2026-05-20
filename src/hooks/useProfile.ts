import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

export function useProfile(userId?: string) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        if (userId) {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
          if (error) throw error;
          setProfile(data);
        } else {
          // get my profile
          const { data, error } = await supabase.rpc('get_my_profile');
          if (error) throw error;
          setProfile(data);
        }
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [userId]);

  return { profile, loading, error };
}
