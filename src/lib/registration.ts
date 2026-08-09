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

export interface RegistrationPayload {
  nama_lengkap: string;
  nama_panggilan: string;
  nickname: string;
  tanggal_lahir?: string;
  lingkungan: string;
  wilayah?: string;
  pendidikan?: string;
  sekolah?: string;
  is_tarakanita?: boolean;
  hp_anak?: string;
  hp_ortu?: string;
  nama_ayah?: string;
  nama_ibu?: string;
  alasan_masuk?: string;
  alamat?: string;
  status?: string;
}

export function validateRegistrationPayload(data: Partial<RegistrationPayload>): { valid: boolean; error?: string } {
  if (!data.nama_lengkap?.trim()) {
    return { valid: false, error: 'Nama lengkap wajib diisi.' };
  }
  if (!data.nama_panggilan?.trim()) {
    return { valid: false, error: 'Nama panggilan wajib diisi.' };
  }
  if (!data.nickname?.trim()) {
    return { valid: false, error: 'Nickname wajib diisi.' };
  }
  if (!data.lingkungan?.trim()) {
    return { valid: false, error: 'Lingkungan wajib diisi.' };
  }
  return { valid: true };
}

export async function createRegistrationAction(payload: RegistrationPayload): Promise<{ ok: boolean; data?: any; error?: string }> {
  const validation = validateRegistrationPayload(payload);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  const { nama_panggilan, ...dbFields } = payload;

  const cleanData = {
    ...dbFields,
    nickname: payload.nickname.toLowerCase().trim(),
    nama_lengkap: payload.nama_lengkap.trim(),
    lingkungan: payload.lingkungan.trim(),
    status: payload.status || 'Pending',
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('registrations')
    .insert(cleanData)
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message || 'Gagal menyimpan pendaftaran' };
  }

  return { ok: true, data };
}

export async function updateRegistrationAction(id: string, payload: Partial<RegistrationPayload>): Promise<{ ok: boolean; data?: any; error?: string }> {
  if (!id) {
    return { ok: false, error: 'ID pendaftaran tidak valid.' };
  }

  const validation = validateRegistrationPayload(payload);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  const { nama_panggilan, ...dbFields } = payload;

  const cleanData = {
    ...dbFields,
    ...(payload.nickname ? { nickname: payload.nickname.toLowerCase().trim() } : {}),
    ...(payload.nama_lengkap ? { nama_lengkap: payload.nama_lengkap.trim() } : {}),
    ...(payload.lingkungan ? { lingkungan: payload.lingkungan.trim() } : {}),
  };

  const { data, error } = await supabase
    .from('registrations')
    .update(cleanData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message || 'Gagal merubah data pendaftaran' };
  }

  return { ok: true, data };
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

