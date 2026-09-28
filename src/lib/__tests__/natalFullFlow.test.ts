import { describe, it, expect } from 'vitest';
import { calculateCountdownState } from '../../hooks/useNatalCountdown';
import { formatNatalAnnouncementMessage } from '../natalUtils';

describe('Full Natal Announcement Flow Verification', () => {
  it('handles complete transition from countdown to reveal message', () => {
    // 1. Initial State: > 5 minutes (Calm)
    const calmState = calculateCountdownState(600);
    expect(calmState.isExpired).toBe(false);
    expect(calmState.isUnder5Min).toBe(false);
    expect(calmState.tensionLevel).toBe('calm');

    // 2. Tension State: < 5 minutes (Rising)
    const risingState = calculateCountdownState(250);
    expect(risingState.isUnder5Min).toBe(true);
    expect(risingState.tensionLevel).toBe('rising');

    // 3. Critical Tension: < 1 minute (Critical)
    const criticalState = calculateCountdownState(45);
    expect(criticalState.isUnder1Min).toBe(true);
    expect(criticalState.tensionLevel).toBe('critical');

    // 4. Climax: < 10 seconds (Climax)
    const climaxState = calculateCountdownState(8);
    expect(climaxState.isUnder10Sec).toBe(true);
    expect(climaxState.tensionLevel).toBe('climax');

    // 5. Expired: 0 seconds (Reveal Gate)
    const revealState = calculateCountdownState(0);
    expect(revealState.isExpired).toBe(true);
    expect(revealState.tensionLevel).toBe('reveal');

    // 6. Member A checks assigned result
    const msgAssigned = formatNatalAnnouncementMessage({
      status_tugas: 'assigned',
      nama_lengkap: 'Gabriel Michael',
      misa_name: 'Misa Fajar Natal',
      jam_tugas: '06:00',
    });
    expect(msgAssigned.title).toBe('Selamat!');
    expect(msgAssigned.headline).toBe('Gabriel Michael anda mendapatkan tugas Misa Fajar Natal 06:00');
    expect(msgAssigned.isAssigned).toBe(true);

    // 7. Member B checks unassigned result
    const msgUnassigned = formatNatalAnnouncementMessage({
      status_tugas: 'unassigned',
      nama_lengkap: 'Maria Goretti',
    });
    expect(msgUnassigned.title).toBe('Tetap semangat!');
    expect(msgUnassigned.headline).toBe('Maria Goretti anda belum mendapatkan tugas natal Tahun ini! Jangan menyerah dan jangan putus asa untuk melayani Tuhan!');
    expect(msgUnassigned.isAssigned).toBe(false);
  });
});
