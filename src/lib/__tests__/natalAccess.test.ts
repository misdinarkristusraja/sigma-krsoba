import { describe, it, expect } from 'vitest';
import { isNatalPortalVisible, isNatalAdminVisible } from '../natalUtils';

describe('Natal Portal Access Permissions', () => {
  describe('isNatalPortalVisible', () => {
    it('returns false for everyone when status is disabled', () => {
      expect(isNatalPortalVisible('disabled', false)).toBe(false); // Misdinar aktif
      expect(isNatalPortalVisible('disabled', true)).toBe(false);  // Pengurus
    });

    it('returns true ONLY for pengurus when status is trial', () => {
      expect(isNatalPortalVisible('trial', false)).toBe(false); // Misdinar aktif blocked!
      expect(isNatalPortalVisible('trial', true)).toBe(true);   // Pengurus allowed!
    });

    it('returns true for everyone when status is published', () => {
      expect(isNatalPortalVisible('published', false)).toBe(true); // Misdinar aktif can access!
      expect(isNatalPortalVisible('published', true)).toBe(true);  // Pengurus can access!
    });

    it('handles unknown or undefined status safely', () => {
      expect(isNatalPortalVisible(undefined, false)).toBe(false);
      expect(isNatalPortalVisible(undefined, true)).toBe(false);
      expect(isNatalPortalVisible('unknown', false)).toBe(false);
    });
  });

  describe('isNatalAdminVisible', () => {
    it('only allows pengurus/admin to access admin management', () => {
      expect(isNatalAdminVisible(false)).toBe(false); // Misdinar aktif strictly blocked
      expect(isNatalAdminVisible(true)).toBe(true);   // Pengurus/Admin allowed
    });
  });
});
