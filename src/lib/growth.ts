export interface ServiceTier {
  name: string;
  level: number;
  icon: string;
}

export interface RadarMetric {
  subject: string;
  score: number;
  fullMark: number;
}

export function getServiceTier(completedCount: number): ServiceTier {
  if (completedCount >= 80) return { name: 'Misdinar Senior', level: 4, icon: 'Crown' };
  if (completedCount >= 41) return { name: 'Misdinar Utama', level: 3, icon: 'Star' };
  if (completedCount >= 16) return { name: 'Misdinar Pratama', level: 2, icon: 'Award' };
  return { name: 'Misdinar Mula', level: 1, icon: 'Shield' };
}

export function calculateRadarMetrics(input: {
  totalAssignments: number;
  scannedAssignments: number;
  totalTrainings: number;
  scannedTrainings: number;
  uniqueEventTypes: number;
  claimedSwapsCount: number;
  attitudeScoreAvg: number; // 1 to 5
}): RadarMetric[] {
  const discipline = input.totalAssignments > 0
    ? Math.round((input.scannedAssignments / input.totalAssignments) * 100)
    : 100;

  const training = input.totalTrainings > 0
    ? Math.round((input.scannedTrainings / input.totalTrainings) * 100)
    : 100;

  // Max 5 event types = 100%
  const diversity = Math.min(100, Math.round((input.uniqueEventTypes / 5) * 100));

  // Max 2.5 claimed swaps = 100% (40% per claimed swap)
  const solidarity = Math.min(100, Math.round((input.claimedSwapsCount / 2.5) * 100));

  // 1-5 scale mapped to 0-100%
  const attitude = Math.round((input.attitudeScoreAvg / 5) * 100);

  return [
    { subject: 'Kedisiplinan Misa', score: discipline, fullMark: 100 },
    { subject: 'Komitmen Latihan', score: training, fullMark: 100 },
    { subject: 'Variasi Peran', score: diversity, fullMark: 100 },
    { subject: 'Solidaritas Swap', score: solidarity, fullMark: 100 },
    { subject: 'Sikap & Kerapian', score: attitude, fullMark: 100 }
  ];
}
