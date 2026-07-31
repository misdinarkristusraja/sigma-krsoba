import { describe, it, expect } from 'vitest';

export function isExecutiveRole(role: string, divisi: string | undefined): boolean {
  if (role !== 'Pengurus' && role !== 'Administrator' && role !== 'Pendamping') return false;
  if (role === 'Administrator') return true;
  if (!divisi) return false;
  const d = divisi.toLowerCase();
  return ['ketua', 'sekretaris', 'bendahara'].includes(d);
}

export function canAccessDivision(role: string, userDivisi: string | undefined, targetDivision: string): boolean {
  if (role !== 'Pengurus' && role !== 'Administrator' && role !== 'Pendamping') return false;
  if (isExecutiveRole(role, userDivisi)) return true;
  if (!userDivisi) return false;
  return userDivisi.toLowerCase() === targetDivision.toLowerCase();
}

describe('Divisional Access Control & Status Matrix', () => {
  it('identifies Executive roles correctly', () => {
    expect(isExecutiveRole('Administrator', undefined)).toBe(true);
    expect(isExecutiveRole('Pengurus', 'Ketua')).toBe(true);
    expect(isExecutiveRole('Pengurus', 'Sekretaris')).toBe(true);
    expect(isExecutiveRole('Pengurus', 'Bendahara')).toBe(true);
    expect(isExecutiveRole('Pengurus', 'Multimedia')).toBe(false);
    expect(isExecutiveRole('Misdinar', 'Ketua')).toBe(false);
  });

  it('evaluates division access rules accurately', () => {
    // Executive access all
    expect(canAccessDivision('Pengurus', 'Ketua', 'multimedia')).toBe(true);
    expect(canAccessDivision('Pengurus', 'Sekretaris', 'bendahara')).toBe(true);

    // Division specific
    expect(canAccessDivision('Pengurus', 'Multimedia', 'multimedia')).toBe(true);
    expect(canAccessDivision('Pengurus', 'Multimedia', 'bendahara')).toBe(false);

    // Regular member blocked
    expect(canAccessDivision('Misdinar', 'Multimedia', 'multimedia')).toBe(false);
  });
});
