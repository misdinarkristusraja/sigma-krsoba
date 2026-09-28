import { describe, it, expect } from 'vitest';
import { formatNatalAnnouncementMessage } from '../natalUtils';

describe('formatNatalAnnouncementMessage', () => {
  it('formats assigned result correctly', () => {
    const res = formatNatalAnnouncementMessage({
      status_tugas: 'assigned',
      nama_lengkap: 'Yohanes Baptista',
      misa_name: 'Malam Natal I',
      jam_tugas: '17:00'
    });
    expect(res.title).toBe('Selamat!');
    expect(res.headline).toBe('Yohanes Baptista anda mendapatkan tugas Malam Natal I 17:00');
    expect(res.isAssigned).toBe(true);
  });

  it('formats unassigned result correctly', () => {
    const res = formatNatalAnnouncementMessage({
      status_tugas: 'unassigned',
      nama_lengkap: 'Petrus Agung',
    });
    expect(res.title).toBe('Tetap semangat!');
    expect(res.headline).toBe('Petrus Agung anda belum mendapatkan tugas natal Tahun ini! Jangan menyerah dan jangan putus asa untuk melayani Tuhan!');
    expect(res.isAssigned).toBe(false);
  });
});
