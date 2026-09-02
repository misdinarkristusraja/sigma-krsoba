import {
  MajorMassMember,
  MajorMassSlotConfig,
  MajorMassRules,
  MajorMassAllocationResult,
  AssignedPetugas,
} from '@/types/majorMass';

/**
 * Calculates member score based on K-rekap points, duty attendance count, and K6 unexcused absences.
 */
export function calculateMemberScore(params: {
  rekapPoints: number;
  hadirTugasCount: number;
  k6Count: number;
  k6PenaltyWeight?: number;
}): number {
  const penalty = (params.k6Count || 0) * (params.k6PenaltyWeight ?? 5);
  return params.rekapPoints + params.hadirTugasCount - penalty;
}

/**
 * Checks whether member is classified as Senior (SMA, SMK, Lulus / Kuliah / Dewasa).
 */
export function isSeniorMember(pendidikan?: string): boolean {
  if (!pendidikan) return false;
  const p = pendidikan.toUpperCase();
  return p === 'SMA' || p === 'SMK' || p === 'LULUS';
}

/**
 * Main allocation engine for Major Mass series (Natal & Pekan Suci).
 * Adheres to priority rank, senior/junior balance, multi-duty limits, and date conflict rules.
 */
export function allocateMajorMassSlots(
  members: MajorMassMember[],
  slots: MajorMassSlotConfig[],
  rules: MajorMassRules
): MajorMassAllocationResult {
  // Sort slots by priorityRank ascending (rank 1 = highest priority first)
  const sortedSlots = [...slots].sort((a, b) => a.priorityRank - b.priorityRank);

  // Track assignments & assigned dates per member
  const memberDutyCount = new Map<string, number>();
  const memberDates = new Map<string, Set<string>>();
  members.forEach(m => {
    memberDutyCount.set(m.id, 0);
    memberDates.set(m.id, new Set());
  });

  // Separate pools and sort by kScore descending
  const seniors = members
    .filter(m => m.isSenior)
    .sort((a, b) => b.kScore - a.kScore);
  const juniors = members
    .filter(m => !m.isSenior)
    .sort((a, b) => b.kScore - a.kScore);

  const slotResults = new Map<string, AssignedPetugas[]>();
  sortedSlots.forEach(s => slotResults.set(s.id, []));

  const warnings: string[] = [];

  // Allocation Rounds (Round 1: primary assignment, Round 2: secondary assignment for Pekan Suci)
  const maxRounds = Math.max(1, rules.maxDutyPerMember);

  for (let round = 1; round <= maxRounds; round++) {
    for (const slot of sortedSlots) {
      const assigned = slotResults.get(slot.id)!;
      const needed = slot.quota - assigned.length;
      if (needed <= 0) continue;

      let seniorTarget = rules.balanceSeniorJunior
        ? Math.round(slot.quota * rules.seniorRatio)
        : needed;
      let juniorTarget = slot.quota - seniorTarget;

      const currentSeniors = assigned.filter(a => a.member.isSenior).length;
      const currentJuniors = assigned.filter(a => !a.member.isSenior).length;

      let seniorsNeeded = Math.max(0, seniorTarget - currentSeniors);
      let juniorsNeeded = Math.max(0, juniorTarget - currentJuniors);

      // Helper to pick candidate from given pool
      const pickCandidates = (pool: MajorMassMember[], count: number) => {
        const picked: MajorMassMember[] = [];
        for (const candidate of pool) {
          if (picked.length >= count) break;
          const currentDuties = memberDutyCount.get(candidate.id) || 0;
          if (currentDuties >= round) continue;
          if (currentDuties >= rules.maxDutyPerMember) continue;

          // Date check (avoid same date)
          const dates = memberDates.get(candidate.id)!;
          if (dates.has(slot.date)) continue;

          // Check already assigned to this slot
          if (assigned.some(a => a.member.id === candidate.id)) continue;

          picked.push(candidate);
          memberDutyCount.set(candidate.id, currentDuties + 1);
          dates.add(slot.date);
        }
        return picked;
      };

      // 1. Pick seniors up to needed target
      if (seniorsNeeded > 0) {
        const pickedSeniors = pickCandidates(seniors, seniorsNeeded);
        pickedSeniors.forEach(m => {
          assigned.push({
            slotId: slot.id,
            member: m,
            position: assigned.length + 1,
            dutyIndex: (memberDutyCount.get(m.id) || 1) as 1 | 2,
          });
        });
      }

      // 2. Pick juniors up to needed target
      if (juniorsNeeded > 0) {
        const pickedJuniors = pickCandidates(juniors, juniorsNeeded);
        pickedJuniors.forEach(m => {
          assigned.push({
            slotId: slot.id,
            member: m,
            position: assigned.length + 1,
            dutyIndex: (memberDutyCount.get(m.id) || 1) as 1 | 2,
          });
        });
      }

      // 3. Fallback: If still under quota (e.g. not enough seniors or juniors), pick from combined remaining pool
      const remainingNeeded = slot.quota - assigned.length;
      if (remainingNeeded > 0) {
        const combinedPool = [...seniors, ...juniors].sort((a, b) => b.kScore - a.kScore);
        const fallbackPicked = pickCandidates(combinedPool, remainingNeeded);
        fallbackPicked.forEach(m => {
          assigned.push({
            slotId: slot.id,
            member: m,
            position: assigned.length + 1,
            dutyIndex: (memberDutyCount.get(m.id) || 1) as 1 | 2,
          });
        });
      }
    }
  }

  // Check for under-quota warnings after all rounds
  for (const slot of sortedSlots) {
    const assigned = slotResults.get(slot.id) || [];
    if (assigned.length < slot.quota) {
      warnings.push(`Slot ${slot.name} hanya terisi ${assigned.length}/${slot.quota} petugas (kurang kandidat).`);
    }
  }

  const unassigned = members.filter(m => (memberDutyCount.get(m.id) || 0) === 0);

  return {
    slots: sortedSlots.map(s => ({
      config: s,
      assigned: slotResults.get(s.id) || [],
    })),
    unassignedMembers: unassigned,
    warnings,
  };
}
