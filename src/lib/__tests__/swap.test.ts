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

import { filterAndSortBoardRequests, effectiveDate, getEffectiveStatus } from '../swapUtils';

describe('Swap Board filtering and sorting criteria (tugas terdekat & tugas mendatang)', () => {
  const TODAY = '2026-09-05';
  const CURRENT_USER_ID = 'user-me';

  it('calculates effectiveDate correctly for weekend slot 1 (vigil Saturday H-1)', () => {
    // Sunday 2026-09-06, slot 1 (Sabtu 17:30) -> 2026-09-05
    expect(effectiveDate('2026-09-06', 1, 'Mingguan')).toBe('2026-09-05');
    // Sunday 2026-09-06, slot 2 (Minggu 06:00) -> 2026-09-06
    expect(effectiveDate('2026-09-06', 2, 'Mingguan')).toBe('2026-09-06');
    // Misa Harian slot 1 -> no shift
    expect(effectiveDate('2026-09-06', 1, 'Misa_Harian')).toBe('2026-09-06');
  });

  it('filters out past events and items with null/missing events (e.g. draft events)', () => {
    const sampleRequests = [
      // Ghost card from past with null event (e.g. RLS blocked draft)
      {
        id: 'ghost-1',
        status: 'Offered',
        is_penawaran: true,
        requester_id: 'user-other-1',
        assignment: { slot_number: 1, events: null }
      },
      // Past event (3 weeks ago)
      {
        id: 'past-1',
        status: 'Offered',
        is_penawaran: true,
        requester_id: 'user-other-2',
        assignment: {
          slot_number: 2,
          events: { tanggal_tugas: '2026-08-23', tipe_event: 'Mingguan' }
        }
      },
      // Past event (yesterday)
      {
        id: 'past-2',
        status: 'Offered',
        is_penawaran: true,
        requester_id: 'user-other-3',
        assignment: {
          slot_number: 1,
          events: { tanggal_tugas: '2026-09-04', tipe_event: 'Misa_Harian' }
        }
      },
      // Valid future event (tomorrow)
      {
        id: 'future-1',
        status: 'Offered',
        is_penawaran: true,
        requester_id: 'user-other-4',
        assignment: {
          slot_number: 2,
          events: { tanggal_tugas: '2026-09-06', tipe_event: 'Mingguan' }
        }
      }
    ];

    const result = filterAndSortBoardRequests(sampleRequests, TODAY, CURRENT_USER_ID);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('future-1');
  });

  it('excludes requests created by the current user', () => {
    const sampleRequests = [
      {
        id: 'own-request',
        status: 'Offered',
        is_penawaran: true,
        requester_id: CURRENT_USER_ID,
        assignment: {
          slot_number: 2,
          events: { tanggal_tugas: '2026-09-06', tipe_event: 'Mingguan' }
        }
      },
      {
        id: 'other-request',
        status: 'Offered',
        is_penawaran: true,
        requester_id: 'user-other',
        assignment: {
          slot_number: 2,
          events: { tanggal_tugas: '2026-09-06', tipe_event: 'Mingguan' }
        }
      }
    ];

    const result = filterAndSortBoardRequests(sampleRequests, TODAY, CURRENT_USER_ID);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('other-request');
  });

  it('sorts upcoming requests by closest date first (tugas terdekat), then by slot_number', () => {
    const sampleRequests = [
      // Next week
      {
        id: 'next-week',
        status: 'Offered',
        is_penawaran: true,
        requester_id: 'u1',
        assignment: {
          slot_number: 2,
          events: { tanggal_tugas: '2026-09-13', tipe_event: 'Mingguan' }
        }
      },
      // Tomorrow slot 3
      {
        id: 'tomorrow-slot3',
        status: 'Offered',
        is_penawaran: true,
        requester_id: 'u2',
        assignment: {
          slot_number: 3,
          events: { tanggal_tugas: '2026-09-06', tipe_event: 'Mingguan' }
        }
      },
      // Tomorrow slot 2
      {
        id: 'tomorrow-slot2',
        status: 'Offered',
        is_penawaran: true,
        requester_id: 'u3',
        assignment: {
          slot_number: 2,
          events: { tanggal_tugas: '2026-09-06', tipe_event: 'Mingguan' }
        }
      },
      // Today (2026-09-05) - Saturday vigil mass of 2026-09-06 slot 1
      {
        id: 'today-vigil',
        status: 'Offered',
        is_penawaran: true,
        requester_id: 'u4',
        assignment: {
          slot_number: 1,
          events: { tanggal_tugas: '2026-09-06', tipe_event: 'Mingguan' }
        }
      }
    ];

    const result = filterAndSortBoardRequests(sampleRequests, TODAY, CURRENT_USER_ID);
    expect(result.map(r => r.id)).toEqual([
      'today-vigil',    // 2026-09-05
      'tomorrow-slot2', // 2026-09-06 slot 2
      'tomorrow-slot3', // 2026-09-06 slot 3
      'next-week'       // 2026-09-13 slot 2
    ]);
  });

  it('marks offered requests with past event dates or expired dates as Tidak_Terganti', () => {
    // Past event
    expect(getEffectiveStatus({
      status: 'Offered',
      assignment: { slot_number: 2, events: { tanggal_tugas: '2026-08-23', tipe_event: 'Mingguan' } }
    }, TODAY)).toBe('Tidak_Terganti');

    // Past vigil event (Sunday 2026-09-06 slot 1 effective date was Saturday 2026-09-05; tested against 2026-09-06)
    expect(getEffectiveStatus({
      status: 'Offered',
      assignment: { slot_number: 1, events: { tanggal_tugas: '2026-09-06', tipe_event: 'Mingguan' } }
    }, '2026-09-06')).toBe('Tidak_Terganti');

    // Future event
    expect(getEffectiveStatus({
      status: 'Offered',
      assignment: { slot_number: 2, events: { tanggal_tugas: '2026-09-06', tipe_event: 'Mingguan' } }
    }, TODAY)).toBe('Offered');

    // Missing event but expired_at in past
    expect(getEffectiveStatus({
      status: 'Offered',
      expires_at: '2026-08-20T00:00:00Z',
      assignment: { slot_number: 1, events: null }
    }, TODAY)).toBe('Tidak_Terganti');
  });
});
