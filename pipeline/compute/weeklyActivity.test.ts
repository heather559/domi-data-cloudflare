import { describe, it, expect } from 'vitest';
import { computeWeeklyActivityLeaderboard, dedupeActivities, type RawActivityRecord } from './weeklyActivity';

function rec(overrides: Partial<RawActivityRecord>): RawActivityRecord {
  return { address: '1 Main St', unit: '1A', price: 5_000_000, neighborhood: 'tribeca', ...overrides };
}

describe('dedupeActivities', () => {
  it('drops exact address+unit duplicates, keeping the first occurrence', () => {
    const records = [rec({ price: 5_000_000 }), rec({ price: 9_999_999 })];
    expect(dedupeActivities(records)).toHaveLength(1);
    expect(dedupeActivities(records)[0].price).toBe(5_000_000);
  });

  it('excludes building-mirror rows via event_tags', () => {
    const records = [rec({ eventTags: ['Multi-Residential Building'] })];
    expect(dedupeActivities(records)).toHaveLength(0);
  });

  it('excludes timeshares', () => {
    const records = [rec({ eventTags: ['Timeshare Unit'] })];
    expect(dedupeActivities(records)).toHaveLength(0);
  });

  it('keeps distinct units in the same building', () => {
    const records = [rec({ unit: '1A' }), rec({ unit: '1B' })];
    expect(dedupeActivities(records)).toHaveLength(2);
  });
});

describe('computeWeeklyActivityLeaderboard', () => {
  it('returns [] when activities is null or empty', () => {
    expect(computeWeeklyActivityLeaderboard(null, 4_800_000, [], [])).toEqual([]);
    expect(computeWeeklyActivityLeaderboard([], 4_800_000, [], [])).toEqual([]);
  });

  it('buckets by neighborhood, sorted by count desc then volume desc', () => {
    const activities: RawActivityRecord[] = [
      rec({ address: '1 A', unit: '1', neighborhood: 'tribeca', price: 6_000_000 }),
      rec({ address: '2 A', unit: '1', neighborhood: 'tribeca', price: 7_000_000 }),
      rec({ address: '3 A', unit: '1', neighborhood: 'tribeca', price: 8_000_000 }),
      rec({ address: '4 A', unit: '1', neighborhood: 'soho', price: 20_000_000 }),
      rec({ address: '5 A', unit: '1', neighborhood: 'soho', price: 20_000_000 }),
    ];
    const result = computeWeeklyActivityLeaderboard(activities, 4_800_000, [], []);
    expect(result[0].name).toBe('tribeca'); // 3 contracts beats soho's 2
    expect(result[0].wk_contracts).toBe(3);
    expect(result[0].wk_volume).toBe(21_000_000);
  });

  it('re-filters below-cutoff rows defensively', () => {
    const activities: RawActivityRecord[] = [rec({ price: 1_000_000 }), rec({ address: '2 A', price: 6_000_000 })];
    const result = computeWeeklyActivityLeaderboard(activities, 4_800_000, [], []);
    expect(result[0].wk_contracts).toBe(1);
  });

  it('cross-references largest_rank/concentrated_rank, null when not present on that panel', () => {
    const activities: RawActivityRecord[] = [rec({ neighborhood: 'tribeca' })];
    const result = computeWeeklyActivityLeaderboard(activities, 4_800_000, ['upper east side', 'tribeca'], []);
    expect(result[0].largest_rank).toBe(2);
    expect(result[0].concentrated_rank).toBeNull();
  });

  it('caps at 10 rows, never padded', () => {
    const activities: RawActivityRecord[] = Array.from({ length: 15 }, (_, i) => rec({ address: `${i} St`, neighborhood: `hood${i}` }));
    const result = computeWeeklyActivityLeaderboard(activities, 4_800_000, [], []);
    expect(result).toHaveLength(10);
  });
});
