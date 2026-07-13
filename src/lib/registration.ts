import { supabase as supabaseTyped } from './supabase';
import { generateMyID } from './utils';

const supabase = supabaseTyped as any;

export interface ApproveResult {
  ok: boolean;
  userId?: string;
  email?: string;
  tempPassword?: string;
  myid?: string;
  error?: string;
  message?: string;
}

export async function approveRegistrationAction(
  reg: { id: string; nickname: string; tanggal_lahir?: string }
): Promise<ApproveResult> {
  const myid = await generateMyID(reg.nickname, reg.tanggal_lahir || '2000-01-01');
  const tempPass = `sigma${myid.slice(0, 6)}`;

  const { data, error } = await supabase.rpc('admin_approve_registration', {
    p_registration_id: reg.id,
    p_myid:            myid,
    p_temp_password:   tempPass,
  });

  if (error) {
    return { ok: false, error: error.code || 'DB_ERROR', message: error.message };
  }
  if (!data?.ok) {
    return { ok: false, error: data?.error || 'UNKNOWN_ERROR', message: data?.message || 'Unknown error' };
  }

  return {
    ok: true,
    userId: data.user_id,
    email: data.email,
    tempPassword: data.temp_password || tempPass,
    myid: data.myid || myid,
  };
}
