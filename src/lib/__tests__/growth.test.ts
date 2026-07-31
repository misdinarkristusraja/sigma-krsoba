import { describe, it, expect } from 'vitest';
import { getServiceTier, calculateRadarMetrics } from '../growth';

describe('Growth Metrics & Tier Engine', () => {
  it('assigns correct Service Tier based on assignment count', () => {
    expect(getServiceTier(5)).toEqual({ name: 'Misdinar Mula', level: 1, icon: 'Shield' });
    expect(getServiceTier(20)).toEqual({ name: 'Misdinar Pratama', level: 2, icon: 'Award' });
    expect(getServiceTier(50)).toEqual({ name: 'Misdinar Utama', level: 3, icon: 'Star' });
    expect(getServiceTier(90)).toEqual({ name: 'Misdinar Senior', level: 4, icon: 'Crown' });
  });

  it('calculates 5-dimension radar metrics accurately', () => {
    const metrics = calculateRadarMetrics({
      totalAssignments: 10,
      scannedAssignments: 9,
      totalTrainings: 5,
      scannedTrainings: 4,
      uniqueEventTypes: 3,
      claimedSwapsCount: 2,
      attitudeScoreAvg: 4.5
    });

    expect(metrics).toEqual([
      { subject: 'Kedisiplinan Misa', score: 90, fullMark: 100 },
      { subject: 'Komitmen Latihan', score: 80, fullMark: 100 },
      { subject: 'Variasi Peran', score: 60, fullMark: 100 },
      { subject: 'Solidaritas Swap', score: 80, fullMark: 100 },
      { subject: 'Sikap & Kerapian', score: 90, fullMark: 100 }
    ]);
  });
});
