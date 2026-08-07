import { describe, it, expect } from 'vitest';
import { toggleSelectMember, toggleSelectAll, getSelectedMembers } from '../cardExportHelpers';

describe('Card Bulk Export Selection Helpers', () => {
  const members = [
    { id: '1', nickname: 'user1', nama_panggilan: 'User One' },
    { id: '2', nickname: 'user2', nama_panggilan: 'User Two' },
    { id: '3', nickname: 'user3', nama_panggilan: 'User Three' },
  ];

  it('toggles member selection correctly', () => {
    let set = new Set<string>();
    set = toggleSelectMember(set, '1');
    expect(Array.from(set)).toEqual(['1']);

    set = toggleSelectMember(set, '2');
    expect(Array.from(set).sort()).toEqual(['1', '2']);

    set = toggleSelectMember(set, '1');
    expect(Array.from(set)).toEqual(['2']);
  });

  it('toggles select all and deselect all', () => {
    let set = new Set<string>();
    const allIds = members.map(m => m.id);

    // Select all when empty
    set = toggleSelectAll(set, allIds);
    expect(set.size).toBe(3);

    // Deselect all when all selected
    set = toggleSelectAll(set, allIds);
    expect(set.size).toBe(0);

    // Select all when partially selected
    set = new Set(['1']);
    set = toggleSelectAll(set, allIds);
    expect(set.size).toBe(3);
  });

  it('filters selected members list correctly', () => {
    const set = new Set(['1', '3']);
    const selected = getSelectedMembers(members, set);
    expect(selected.map(m => m.id)).toEqual(['1', '3']);
  });
});
