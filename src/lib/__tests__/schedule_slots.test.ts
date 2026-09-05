import { describe, it, expect } from 'vitest';
import {
  effectiveDate,
  slotLabel,
  parseSlotScheduleUniversal,
  WEEKEND_SLOT_INFO,
} from '../swapUtils';
import { generateICS } from '../calendarExport';

describe('Scheduling Slot & Date Logic', () => {
  describe('effectiveDate', () => {
    it('shifts Slot 1 of Weekend Mass to Saturday (H-1)', () => {
      // 2026-09-06 is Sunday
      const eff = effectiveDate('2026-09-06', 1, 'Mingguan');
      expect(eff).toBe('2026-09-05'); // Saturday
    });

    it('keeps Slots 2, 3, 4 of Weekend Mass on Sunday', () => {
      expect(effectiveDate('2026-09-06', 2, 'Mingguan')).toBe('2026-09-06');
      expect(effectiveDate('2026-09-06', 3, 'Mingguan')).toBe('2026-09-06');
      expect(effectiveDate('2026-09-06', 4, 'Mingguan')).toBe('2026-09-06');
    });

    it('does not shift date for Misa_Harian or Misa_Khusus', () => {
      expect(effectiveDate('2026-12-25', 1, 'Misa_Khusus')).toBe('2026-12-25');
      expect(effectiveDate('2026-09-07', 1, 'Misa_Harian')).toBe('2026-09-07');
    });
  });

  describe('parseSlotScheduleUniversal', () => {
    it('accurately parses slots with custom dates and times without split(|) bug', () => {
      const draftNote = 'Jam: Slot 1: 17.00|2026-12-24 | Slot 2: 08.00|2026-12-25';
      const parsed = parseSlotScheduleUniversal(draftNote, '2026-12-25');
      expect(parsed).toEqual([
        { slot: 1, jam: '17.00', tanggal: '2026-12-24' },
        { slot: 2, jam: '08.00', tanggal: '2026-12-25' },
      ]);
    });

    it('handles draft notes without pipe dates by applying fallback date', () => {
      const draftNote = 'Jam: Slot 1: 06.00 | Slot 2: 08.00';
      const parsed = parseSlotScheduleUniversal(draftNote, '2026-11-01');
      expect(parsed).toEqual([
        { slot: 1, jam: '06.00', tanggal: '2026-11-01' },
        { slot: 2, jam: '08.00', tanggal: '2026-11-01' },
      ]);
    });

    it('returns empty array when draftNote is null or empty', () => {
      expect(parseSlotScheduleUniversal(null, '2026-11-01')).toEqual([]);
      expect(parseSlotScheduleUniversal('', '2026-11-01')).toEqual([]);
    });
  });

  describe('slotLabel and WEEKEND_SLOT_INFO', () => {
    it('returns human-readable time labels for Weekend slots', () => {
      expect(slotLabel(1, 'Mingguan')).toBe('Sabtu 17:30');
      expect(slotLabel(2, 'Mingguan')).toBe('Minggu 06:00');
      expect(slotLabel(3, 'Mingguan')).toBe('Minggu 08:00');
      expect(slotLabel(4, 'Mingguan')).toBe('Minggu 17:30');
    });

    it('returns custom slot label for Misa Khusus when draft_note is provided', () => {
      const draftNote = 'Jam: Slot 1: 17.00|2026-12-24 | Slot 2: 08.00|2026-12-25';
      expect(slotLabel(1, 'Misa_Khusus', draftNote)).toBe('Misa 1 (17.00) · 2026-12-24');
      expect(slotLabel(2, 'Misa_Khusus', draftNote)).toBe('Misa 2 (08.00) · 2026-12-25');
    });

    it('has accurate metadata in WEEKEND_SLOT_INFO', () => {
      expect(WEEKEND_SLOT_INFO[1]).toEqual({ time: 'Sabtu 17:30', label: 'Sabtu Sore', jam: '17.30' });
      expect(WEEKEND_SLOT_INFO[2]).toEqual({ time: 'Minggu 06:00', label: 'Minggu Pagi I', jam: '06.00' });
      expect(WEEKEND_SLOT_INFO[3]).toEqual({ time: 'Minggu 08:00', label: 'Minggu Pagi II', jam: '08.00' });
      expect(WEEKEND_SLOT_INFO[4]).toEqual({ time: 'Minggu 17:30', label: 'Minggu Sore', jam: '17.30' });
    });
  });

  describe('calendarExport (generateICS)', () => {
    it('exports Slot 1 on Saturday (H-1) at 17:30, not on Sunday', () => {
      const assignments = [
        {
          event_id: 'ev-1',
          slot_number: 1,
          events: {
            tanggal_tugas: '2026-09-06', // Sunday
            tipe_event: 'Mingguan',
            perayaan: 'Minggu Biasa XXIII',
          },
        },
      ];

      const ics = generateICS(assignments as any, 'Benedictus');
      // Must contain Saturday 20260905 at 17:30
      expect(ics).toContain('DTSTART;TZID=Asia/Jakarta:20260905T173000');
      expect(ics).toContain('DTEND;TZID=Asia/Jakarta:20260905T193000');
      expect(ics).toContain('Sabtu 17:30');
    });

    it('exports Slot 2 on Sunday at 06:00', () => {
      const assignments = [
        {
          event_id: 'ev-2',
          slot_number: 2,
          events: {
            tanggal_tugas: '2026-09-06',
            tipe_event: 'Mingguan',
            perayaan: 'Minggu Biasa XXIII',
          },
        },
      ];

      const ics = generateICS(assignments as any, 'Benedictus');
      expect(ics).toContain('DTSTART;TZID=Asia/Jakarta:20260906T060000');
      expect(ics).toContain('DTEND;TZID=Asia/Jakarta:20260906T080000');
      expect(ics).toContain('Minggu 06:00');
    });
  });
});
