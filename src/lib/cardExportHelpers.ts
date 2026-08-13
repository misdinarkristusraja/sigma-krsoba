/**
 * Helper functions for member selection in bulk export and canvas export optimizations.
 */

export function toggleSelectMember(selectedIds: Set<string>, id: string): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function toggleSelectAll(selectedIds: Set<string>, targetIds: string[]): Set<string> {
  if (targetIds.length === 0) return new Set(selectedIds);
  const allTargetSelected = targetIds.every(id => selectedIds.has(id));
  const next = new Set(selectedIds);
  if (allTargetSelected) {
    targetIds.forEach(id => next.delete(id));
  } else {
    targetIds.forEach(id => next.add(id));
  }
  return next;
}

export function getSelectedMembers<T extends { id: string }>(members: T[], selectedIds: Set<string>): T[] {
  if (selectedIds.size === 0) return [];
  return members.filter(m => selectedIds.has(m.id));
}
