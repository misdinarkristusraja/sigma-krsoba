import { describe, it, expect } from 'vitest';
import { shouldRedirectToChangePassword } from '../routeHelpers';

describe('shouldRedirectToChangePassword', () => {
  it('returns true when must_change_password is true and current path is NOT /change-password', () => {
    const profile = { must_change_password: true };
    expect(shouldRedirectToChangePassword(profile, '/dashboard')).toBe(true);
    expect(shouldRedirectToChangePassword(profile, '/anggota')).toBe(true);
  });

  it('returns false when current path IS /change-password, preventing infinite redirect loops', () => {
    const profile = { must_change_password: true };
    expect(shouldRedirectToChangePassword(profile, '/change-password')).toBe(false);
  });

  it('returns false when must_change_password is false or undefined', () => {
    expect(shouldRedirectToChangePassword({ must_change_password: false }, '/dashboard')).toBe(false);
    expect(shouldRedirectToChangePassword({}, '/dashboard')).toBe(false);
    expect(shouldRedirectToChangePassword(null, '/dashboard')).toBe(false);
  });
});
