import { describe, it, expect, vi } from 'vitest';
import {
  fetchMajorMassPoolAndScores,
  persistMajorMassSeries,
} from '../majorMassService';
import { MajorMassRules, MajorMassAllocationResult } from '@/types/majorMass';

describe('majorMassService', () => {
  it('aggregates user pool with rekap points, presence count, and K6 count', async () => {
    const mockUsers = [
      { id: 'u1', nickname: 'Alice', nama_lengkap: 'Alice A', nama_panggilan: 'Alice', pendidikan: 'SMA', lingkungan: 'L1' },
      { id: 'u2', nickname: 'Bob', nama_lengkap: 'Bob B', nama_panggilan: 'Bob', pendidikan: 'SMP', lingkungan: 'L2' },
    ];

    const mockRekap = [
      { user_id: 'u1', poin: 15, kondisi: 'K2a' },
      { user_id: 'u1', poin: 5, kondisi: 'K1' },
      { user_id: 'u2', poin: -1, kondisi: 'K6' },
    ];

    const mockScans = [
      { user_id: 'u1', scan_type: 'tugas' },
      { user_id: 'u1', scan_type: 'walkin_tugas' },
      { user_id: 'u2', scan_type: 'tugas' },
    ];

    const mockSupabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: mockUsers, error: null }),
          };
        }
        if (table === 'rekap_poin_mingguan') {
          return {
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ data: mockRekap, error: null }),
          };
        }
        if (table === 'scan_records') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ data: mockScans, error: null }),
          };
        }
        return {};
      }),
    };

    const rules: MajorMassRules = {
      seriesType: 'natal',
      seriesName: 'Natal 2026',
      evalStartDate: '2026-06-01',
      evalEndDate: '2026-12-01',
      maxDutyPerMember: 1,
      balanceSeniorJunior: true,
      seniorRatio: 0.5,
      k6PenaltyWeight: 5,
      avoidConsecutiveDays: false,
    };

    const members = await fetchMajorMassPoolAndScores(mockSupabase, rules);

    expect(members.length).toBe(2);
    const u1 = members.find(m => m.id === 'u1')!;
    const u2 = members.find(m => m.id === 'u2')!;

    // u1: poin (15+5=20) + hadirTugas (2) - K6 (0*5) = 22, isSenior: true
    expect(u1.kScore).toBe(22);
    expect(u1.totalHadirTugas).toBe(2);
    expect(u1.isSenior).toBe(true);

    // u2: poin (-1) + hadirTugas (1) - K6 (1*5=5) = -1 + 1 - 5 = -5, isSenior: false
    expect(u2.kScore).toBe(-5);
    expect(u2.k6Count).toBe(1);
    expect(u2.isSenior).toBe(false);
  });

  it('persists events and assignments in batch into Supabase', async () => {
    const insertedEvents: any[] = [];
    const insertedAssignments: any[] = [];

    const mockSupabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'events') {
          return {
            insert: vi.fn((payload) => {
              insertedEvents.push(payload);
              return {
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: `ev-${insertedEvents.length}` }, error: null }),
              };
            }),
          };
        }
        if (table === 'assignments') {
          return {
            insert: vi.fn((payload) => {
              insertedAssignments.push(...payload);
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {};
      }),
    };

    const allocation: MajorMassAllocationResult = {
      slots: [
        {
          config: {
            id: 's1',
            name: 'Malam Natal 1',
            date: '2026-12-24',
            time: '17:00',
            quota: 2,
            priorityRank: 1,
            rehearsalDate: '2026-12-22',
            rehearsalTime: '18:00',
            rehearsalNotes: 'Gladi bersih pakaian liturgi',
          },
          assigned: [
            {
              slotId: 's1',
              member: { id: 'u1', nickname: 'Alice', nama_lengkap: 'Alice', nama_panggilan: 'A', kScore: 20, totalHadirTugas: 5, k6Count: 0, isSenior: true },
              position: 1,
              dutyIndex: 1,
            },
            {
              slotId: 's1',
              member: { id: 'u2', nickname: 'Bob', nama_lengkap: 'Bob', nama_panggilan: 'B', kScore: 18, totalHadirTugas: 4, k6Count: 0, isSenior: false },
              position: 2,
              dutyIndex: 1,
            },
          ],
        },
      ],
      unassignedMembers: [],
      warnings: [],
    };

    const rules: MajorMassRules = {
      seriesType: 'natal',
      seriesName: 'Natal 2026',
      evalStartDate: '2026-06-01',
      evalEndDate: '2026-12-01',
      maxDutyPerMember: 1,
      balanceSeniorJunior: true,
      seniorRatio: 0.5,
      k6PenaltyWeight: 5,
      avoidConsecutiveDays: false,
    };

    const eventIds = await persistMajorMassSeries(mockSupabase, allocation, rules, true);

    expect(eventIds.length).toBe(1);
    expect(insertedEvents.length).toBe(1);
    expect(insertedEvents[0].is_misa_besar).toBe(true);
    expect(insertedEvents[0].nama_event).toBe('MALAM NATAL 1');
    expect(insertedAssignments.length).toBe(2);
    expect(insertedAssignments[0].user_id).toBe('u1');
    expect(insertedAssignments[1].user_id).toBe('u2');
  });
});
