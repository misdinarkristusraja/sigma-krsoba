import { describe, it, expect } from 'vitest';
import { formatNotificationLabel } from '../utils';

describe('Notification Hub Helpers', () => {
  it('formats notification type labels correctly', () => {
    expect(formatNotificationLabel('REMINDER_TUGAS')).toContain('Pengingat Tugas');
    expect(formatNotificationLabel('REMINDER_LATIHAN')).toContain('Pengingat Latihan');
    expect(formatNotificationLabel('MISSED_DUTY')).toContain('Tugas Terlewat');
    expect(formatNotificationLabel('ANNOUNCEMENT')).toContain('Informasi Pengumuman');
    expect(formatNotificationLabel('NEW_SCHEDULE')).toContain('Jadwal Baru');
    expect(formatNotificationLabel('NEW_EVENT')).toContain('Event Baru');
  });
});
