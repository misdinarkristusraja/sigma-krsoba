import { describe, it, expect } from 'vitest';

export function isUserAssignedToEvent(userSchedules: Array<{ event_id: string }>, targetEventId: string | undefined): boolean {
  if (!targetEventId) return false;
  return userSchedules.some(s => s.event_id === targetEventId);
}

export function parseClaimSwapError(rpcResponse: { data: any; error: any }): { ok: boolean; message?: string; error?: string } {
  if (rpcResponse.error) {
    if (rpcResponse.error.message?.includes('assignments_event_id_user_id_key')) {
      return {
        ok: false,
        error: 'ALREADY_ASSIGNED_TO_EVENT',
        message: 'Kamu tidak dapat mengambil jadwal ini karena kamu sudah terdaftar dalam misa/acara yang sama.'
      };
    }
    return { ok: false, error: rpcResponse.error.code || 'DB_ERROR', message: rpcResponse.error.message };
  }

  if (!rpcResponse.data?.ok) {
    if (rpcResponse.data?.error === 'ALREADY_ASSIGNED_TO_EVENT') {
      return {
        ok: false,
        error: 'ALREADY_ASSIGNED_TO_EVENT',
        message: rpcResponse.data?.message || 'Kamu tidak dapat mengambil jadwal ini karena kamu sudah terdaftar dalam misa/acara yang sama.'
      };
    }
    return {
      ok: false,
      error: rpcResponse.data?.error || 'CLAIM_FAILED',
      message: rpcResponse.data?.message || rpcResponse.data?.error || 'Gagal mengklaim tugas'
    };
  }

  return { ok: true };
}

describe('Swap Claim logic helper unit tests', () => {
  it('detects when user is already assigned to the same event', () => {
    const mySchedules = [
      { event_id: 'event-uuid-1' },
      { event_id: 'event-uuid-2' }
    ];

    expect(isUserAssignedToEvent(mySchedules, 'event-uuid-1')).toBe(true);
    expect(isUserAssignedToEvent(mySchedules, 'event-uuid-3')).toBe(false);
    expect(isUserAssignedToEvent(mySchedules, undefined)).toBe(false);
  });

  it('handles ALREADY_ASSIGNED_TO_EVENT returned from DB RPC', () => {
    const res = parseClaimSwapError({
      data: {
        ok: false,
        error: 'ALREADY_ASSIGNED_TO_EVENT',
        message: 'Kamu tidak dapat mengambil jadwal ini karena kamu sudah terdaftar dalam misa/acara yang sama.'
      },
      error: null
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe('ALREADY_ASSIGNED_TO_EVENT');
    expect(res.message).toContain('sudah terdaftar dalam misa/acara yang sama');
  });

  it('handles raw Postgres constraint error if RPC throws unique_violation', () => {
    const res = parseClaimSwapError({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "assignments_event_id_user_id_key"'
      }
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe('ALREADY_ASSIGNED_TO_EVENT');
    expect(res.message).toContain('sudah terdaftar dalam misa/acara yang sama');
  });

  it('handles successful swap claim', () => {
    const res = parseClaimSwapError({
      data: { ok: true },
      error: null
    });

    expect(res.ok).toBe(true);
  });
});
