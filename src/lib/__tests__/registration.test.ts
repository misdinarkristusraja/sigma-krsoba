import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  approveRegistrationAction,
  validateRegistrationPayload,
  createRegistrationAction,
  updateRegistrationAction
} from '../registration';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  }
}));

vi.mock('../utils', () => ({
  generateMyID: vi.fn().mockResolvedValue('MYID123456')
}));

describe('validateRegistrationPayload', () => {
  it('should validate required fields', () => {
    expect(validateRegistrationPayload({})).toEqual({ valid: false, error: 'Nama lengkap wajib diisi.' });
    expect(validateRegistrationPayload({ nama_lengkap: 'Budi' })).toEqual({ valid: false, error: 'Nama panggilan wajib diisi.' });
    expect(validateRegistrationPayload({ nama_lengkap: 'Budi', nama_panggilan: 'Budi' })).toEqual({ valid: false, error: 'Nickname wajib diisi.' });
    expect(validateRegistrationPayload({ nama_lengkap: 'Budi', nama_panggilan: 'Budi', nickname: 'budi' })).toEqual({ valid: false, error: 'Lingkungan wajib diisi.' });
    expect(validateRegistrationPayload({ nama_lengkap: 'Budi', nama_panggilan: 'Budi', nickname: 'budi', lingkungan: 'St. Paulus' })).toEqual({ valid: true });
  });
});

describe('createRegistrationAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fail if payload is invalid', async () => {
    const res = await createRegistrationAction({ nama_lengkap: '', nama_panggilan: '', nickname: '', lingkungan: '' });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('Nama lengkap wajib diisi.');
  });

  it('should call supabase insert when payload is valid', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'reg-1', nickname: 'budi' }, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any);

    const res = await createRegistrationAction({
      nama_lengkap: 'Budi Santoso',
      nama_panggilan: 'Budi',
      nickname: 'Budi',
      lingkungan: 'St. Paulus'
    });

    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ id: 'reg-1', nickname: 'budi' });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      nama_lengkap: 'Budi Santoso',
      nickname: 'budi',
      lingkungan: 'St. Paulus',
      status: 'Pending'
    }));
    expect(mockInsert.mock.calls[0][0]).not.toHaveProperty('nama_panggilan');
  });
});

describe('updateRegistrationAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fail if id is missing', async () => {
    const res = await updateRegistrationAction('', { nama_lengkap: 'Budi' });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('ID pendaftaran tidak valid.');
  });

  it('should call supabase update when payload is valid', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'reg-1', nickname: 'budi' }, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);

    const res = await updateRegistrationAction('reg-1', {
      nama_lengkap: 'Budi Update',
      nama_panggilan: 'Budi',
      nickname: 'Budi',
      lingkungan: 'St. Paulus'
    });

    expect(res.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      nama_lengkap: 'Budi Update',
      nickname: 'budi'
    }));
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('nama_panggilan');
    expect(mockEq).toHaveBeenCalledWith('id', 'reg-1');
  });
});

describe('approveRegistrationAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully approve registration', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        ok: true,
        user_id: 'user-uuid-123',
        email: 'test@sigma.krsoba.id',
        temp_password: 'sigmaMYID12',
        myid: 'MYID123456'
      },
      error: null
    } as any);

    const result = await approveRegistrationAction({
      id: 'reg-uuid-abc',
      nickname: 'test',
      tanggal_lahir: '2010-01-01'
    });

    expect(result).toEqual({
      ok: true,
      userId: 'user-uuid-123',
      email: 'test@sigma.krsoba.id',
      tempPassword: 'sigmaMYID12',
      myid: 'MYID123456'
    });

    expect(supabase.rpc).toHaveBeenCalledWith('admin_approve_registration', {
      p_registration_id: 'reg-uuid-abc',
      p_myid: 'MYID123456',
      p_temp_password: 'sigmaMYID12'
    });
  });

  it('should handle RPC DB error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'Some Postgres Error'
      }
    } as any);

    const result = await approveRegistrationAction({
      id: 'reg-uuid-abc',
      nickname: 'test',
      tanggal_lahir: '2010-01-01'
    });

    expect(result).toEqual({
      ok: false,
      error: 'P0001',
      message: 'Some Postgres Error'
    });
  });

  it('should handle logic rejection error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        ok: false,
        error: 'NICKNAME_TAKEN',
        message: 'Nickname test sudah dipakai.'
      },
      error: null
    } as any);

    const result = await approveRegistrationAction({
      id: 'reg-uuid-abc',
      nickname: 'test',
      tanggal_lahir: '2010-01-01'
    });

    expect(result).toEqual({
      ok: false,
      error: 'NICKNAME_TAKEN',
      message: 'Nickname test sudah dipakai.'
    });
  });
});

