import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approveRegistrationAction } from '../registration';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

vi.mock('../utils', () => ({
  generateMyID: vi.fn().mockResolvedValue('MYID123456')
}));

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
        temp_password: 'sigmamyid12',
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
      tempPassword: 'sigmamyid12',
      myid: 'MYID123456'
    });

    expect(supabase.rpc).toHaveBeenCalledWith('admin_approve_registration', {
      p_registration_id: 'reg-uuid-abc',
      p_myid: 'MYID123456',
      p_temp_password: 'sigmamyid12'
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
