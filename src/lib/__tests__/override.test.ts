import { describe, it, expect } from 'vitest';
import { hitungPoin } from '../utils';

describe('Smart Override & Walk-In K-Category Classification', () => {
  it('assigns K1 to a substitute who attended training and replaced a missing member', () => {
    const res = hitungPoin({
      isDijadwalkan: false,
      isHadirTugas: true,
      isHadirLatihan: true,
      isWalkIn: true,
      isSwapPengganti: true,
    });
    expect(res.kondisi).toBe('K1');
  });

  it('assigns K3b to an emergency substitute or walk-in who did not attend training', () => {
    const res = hitungPoin({
      isDijadwalkan: false,
      isHadirTugas: true,
      isHadirLatihan: false,
      isWalkIn: true,
      isSwapPengganti: false,
    });
    expect(res.kondisi).toBe('K3b');
  });

  it('includes replaced_user_id when provided in override scan record payload', () => {
    const customReplacedId = 'user-uuid-123';
    const ovReplacedUserId = 'user-uuid-456';
    const replacedId = customReplacedId || ovReplacedUserId;
    const payload = {
      user_id: 'member-123',
      is_walk_in: true,
      replaced_user_id: replacedId || null,
    };
    expect(payload.replaced_user_id).toBe('user-uuid-123');
  });
});
