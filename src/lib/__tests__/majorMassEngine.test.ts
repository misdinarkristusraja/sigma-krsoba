import { describe, it, expect } from 'vitest';
import {
  calculateMemberScore,
  allocateMajorMassSlots,
  isSeniorMember,
} from '../majorMassEngine';
import { MajorMassMember, MajorMassSlotConfig, MajorMassRules } from '@/types/majorMass';

describe('majorMassEngine', () => {
  describe('calculateMemberScore', () => {
    it('calculates score using K-points, hadir tugas count, and K6 penalties', () => {
      const score = calculateMemberScore({
        rekapPoints: 20,
        hadirTugasCount: 5,
        k6Count: 2,
        k6PenaltyWeight: 5,
      });
      // 20 + 5 - (2 * 5) = 15
      expect(score).toBe(15);
    });

    it('uses default K6 penalty weight of 5 if not specified', () => {
      const score = calculateMemberScore({
        rekapPoints: 30,
        hadirTugasCount: 10,
        k6Count: 1,
      });
      // 30 + 10 - (1 * 5) = 35
      expect(score).toBe(35);
    });
  });

  describe('isSeniorMember', () => {
    it('identifies SMA, SMK, and Lulus as Senior', () => {
      expect(isSeniorMember('SMA')).toBe(true);
      expect(isSeniorMember('SMK')).toBe(true);
      expect(isSeniorMember('Lulus')).toBe(true);
      expect(isSeniorMember('lulus')).toBe(true);
    });

    it('identifies SD and SMP as Junior', () => {
      expect(isSeniorMember('SD')).toBe(false);
      expect(isSeniorMember('SMP')).toBe(false);
      expect(isSeniorMember(undefined)).toBe(false);
    });
  });

  describe('allocateMajorMassSlots - Natal Series (Max 1 Duty)', () => {
    it('allocates Natal slots prioritizing highest K-score and balance Senior/Junior (1 duty max per person)', () => {
      const members: MajorMassMember[] = [
        { id: '1', nickname: 'SeniorTop1', nama_lengkap: 'Senior Top 1', nama_panggilan: 'ST1', pendidikan: 'SMA', kScore: 50, totalHadirTugas: 10, k6Count: 0, isSenior: true },
        { id: '2', nickname: 'JuniorTop1', nama_lengkap: 'Junior Top 1', nama_panggilan: 'JT1', pendidikan: 'SMP', kScore: 48, totalHadirTugas: 9, k6Count: 0, isSenior: false },
        { id: '3', nickname: 'SeniorTop2', nama_lengkap: 'Senior Top 2', nama_panggilan: 'ST2', pendidikan: 'SMA', kScore: 40, totalHadirTugas: 8, k6Count: 0, isSenior: true },
        { id: '4', nickname: 'JuniorTop2', nama_lengkap: 'Junior Top 2', nama_panggilan: 'JT2', pendidikan: 'SD', kScore: 35, totalHadirTugas: 7, k6Count: 0, isSenior: false },
      ];

      const slots: MajorMassSlotConfig[] = [
        { id: 'malam-1', name: 'Malam Natal 1', date: '2026-12-24', time: '17:00', quota: 2, priorityRank: 1 },
        { id: 'malam-2', name: 'Malam Natal 2', date: '2026-12-24', time: '20:00', quota: 2, priorityRank: 2 },
      ];

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

      const result = allocateMajorMassSlots(members, slots, rules);

      expect(result.slots[0].assigned.length).toBe(2);
      expect(result.slots[1].assigned.length).toBe(2);
      // Malam Natal 1 gets top Senior (1) and top Junior (2)
      expect(result.slots[0].assigned.map(a => a.member.id)).toEqual(['1', '2']);
      // Malam Natal 2 gets second Senior (3) and second Junior (4)
      expect(result.slots[1].assigned.map(a => a.member.id)).toEqual(['3', '4']);
      expect(result.unassignedMembers.length).toBe(0);
    });
  });

  describe('allocateMajorMassSlots - Pekan Suci Series (Max 2 Duties)', () => {
    it('allows top ranked members to serve 2 duties in Pekan Suci without concurrent same-date conflict', () => {
      const members: MajorMassMember[] = [
        { id: 's1', nickname: 'SeniorTop', nama_lengkap: 'Senior Top', nama_panggilan: 'ST', pendidikan: 'SMA', kScore: 100, totalHadirTugas: 20, k6Count: 0, isSenior: true },
        { id: 'j1', nickname: 'JuniorTop', nama_lengkap: 'Junior Top', nama_panggilan: 'JT', pendidikan: 'SMP', kScore: 90, totalHadirTugas: 18, k6Count: 0, isSenior: false },
        { id: 's2', nickname: 'Senior2', nama_lengkap: 'Senior 2', nama_panggilan: 'S2', pendidikan: 'SMK', kScore: 70, totalHadirTugas: 14, k6Count: 0, isSenior: true },
        { id: 'j2', nickname: 'Junior2', nama_lengkap: 'Junior 2', nama_panggilan: 'J2', pendidikan: 'SD', kScore: 60, totalHadirTugas: 12, k6Count: 0, isSenior: false },
      ];

      const slots: MajorMassSlotConfig[] = [
        { id: 'vigili-paskah', name: 'Vigili Paskah', date: '2026-04-04', time: '19:00', quota: 2, priorityRank: 1 },
        { id: 'kamis-putih', name: 'Kamis Putih', date: '2026-04-02', time: '18:00', quota: 2, priorityRank: 2 },
        { id: 'paskah-pagi', name: 'Paskah Pagi', date: '2026-04-05', time: '08:00', quota: 2, priorityRank: 3 },
      ];

      const rules: MajorMassRules = {
        seriesType: 'pekan_suci',
        seriesName: 'Pekan Suci 2026',
        evalStartDate: '2026-01-01',
        evalEndDate: '2026-04-01',
        maxDutyPerMember: 2,
        balanceSeniorJunior: true,
        seniorRatio: 0.5,
        k6PenaltyWeight: 5,
        avoidConsecutiveDays: false,
      };

      const result = allocateMajorMassSlots(members, slots, rules);

      // Total slots quota = 6 slots. With 4 members and maxDuty 2, all 6 slots are filled.
      const totalAssigned = result.slots.reduce((acc, s) => acc + s.assigned.length, 0);
      expect(totalAssigned).toBe(6);

      // Verify no member is assigned twice on the same date
      for (const slot of result.slots) {
        const userIds = slot.assigned.map(a => a.member.id);
        const uniqueUserIds = new Set(userIds);
        expect(uniqueUserIds.size).toBe(userIds.length);
      }

      // Check that s1 and j1 (top rank) received 2 assignments each
      const dutiesS1 = result.slots.flatMap(s => s.assigned).filter(a => a.member.id === 's1');
      const dutiesJ1 = result.slots.flatMap(s => s.assigned).filter(a => a.member.id === 'j1');
      expect(dutiesS1.length).toBe(2);
      expect(dutiesJ1.length).toBe(2);
    });

    it('generates warnings if pool size is insufficient to fill quotas', () => {
      const members: MajorMassMember[] = [
        { id: '1', nickname: 'SoleMember', nama_lengkap: 'Sole Member', nama_panggilan: 'Sole', pendidikan: 'SMA', kScore: 50, totalHadirTugas: 10, k6Count: 0, isSenior: true },
      ];

      const slots: MajorMassSlotConfig[] = [
        { id: 'm1', name: 'Misa 1', date: '2026-12-24', time: '17:00', quota: 5, priorityRank: 1 },
      ];

      const rules: MajorMassRules = {
        seriesType: 'natal',
        seriesName: 'Natal 2026',
        evalStartDate: '2026-06-01',
        evalEndDate: '2026-12-01',
        maxDutyPerMember: 1,
        balanceSeniorJunior: false,
        seniorRatio: 0.5,
        k6PenaltyWeight: 5,
        avoidConsecutiveDays: false,
      };

      const result = allocateMajorMassSlots(members, slots, rules);
      expect(result.slots[0].assigned.length).toBe(1);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('hanya terisi 1/5 petugas');
    });
  });
});
