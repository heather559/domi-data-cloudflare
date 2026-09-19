import { describe, it, expect } from 'vitest';
import {
  supplyBandFor,
  computeMonthsOfSupply,
  computeLuxuryPace,
  computeDaysOnMarket,
  computeDiscount,
  computeDollarVolume,
  computeTierTrophy,
  computeNeighborhoodMover,
  computeMarketReadBadge,
  computeSowhat,
} from './sowhat';
import type { LuxuryContractStatsResponse, NeighborhoodRankResponse, WeeklySalesStatsResponse, ContractPeriodEntry } from '../fetch/schemas';
import type { TopDeal } from '../schema/weeklyReportPayload';

describe('supplyBandFor', () => {
  it('picks the first matching band, ascending', () => {
    expect(supplyBandFor(3.9).label).toBe("acute seller's market");
    expect(supplyBandFor(5.9).label).toBe("seller's market");
    expect(supplyBandFor(7.9).label).toBe('balanced, tilting to sellers');
    expect(supplyBandFor(8.9).label).toBe('balanced');
    expect(supplyBandFor(11.9).label).toBe("buyer's market");
    expect(supplyBandFor(20).label).toBe("deep buyer's market");
  });
});

describe('computeMonthsOfSupply', () => {
  it('matches the spec\'s own worked example: ~10 months, buyer\'s market, streak >= 3 appends the streak sentence', () => {
    // months = active / (pace13w * 4.33). Reproduce ~10 months with round numbers.
    const pace13w = 21; // spec's own pace_read example uses "~21" this-week pace
    const active = Math.round(10 * pace13w * 4.33); // engineer active to land ~10 months
    const result = computeMonthsOfSupply(pace13w, active, "buyer's market", 2)!;
    expect(result.band.label).toBe("buyer's market");
    expect(result.streakWeeks).toBe(3);
    expect(result.supplyRead).toContain('buyer\'s market');
    expect(result.supplyRead).toContain('3 weeks running');
    expect(result.supplyRead).toContain('borough-wide picture');
  });

  it('resets streak_weeks to 1 when the band label changed from last week', () => {
    const result = computeMonthsOfSupply(21, 800, "seller's market", 5)!;
    expect(result.streakWeeks).toBe(1);
    expect(result.supplyRead).not.toContain('weeks running'); // streak < 3
  });

  it('returns null when pace13w or supply is unavailable', () => {
    expect(computeMonthsOfSupply(null, 800, null, null)).toBeNull();
    expect(computeMonthsOfSupply(21, null, null, null)).toBeNull();
  });
});

describe('computeLuxuryPace', () => {
  it('applies the small-sample gate when hero.luxury_count < 5', () => {
    const result = computeLuxuryPace(10, 20, 3, '2026-08-31');
    expect(result.paceRead).toBe('Only 3 deals this week -- too thin to read. See the 52-week trend.');
  });

  it('appends the Q3 seasonal caveat only in Jul/Aug/Sep', () => {
    const q3 = computeLuxuryPace(10, 20, 10, '2026-08-31');
    expect(q3.paceRead).toContain('Q3 is historically the slowest quarter');
    const nonQ3 = computeLuxuryPace(10, 20, 10, '2026-03-02');
    expect(nonQ3.paceRead).not.toContain('Q3');
  });

  it('bands momentum correctly at the boundaries', () => {
    expect(computeLuxuryPace(23, 20, 10, '2026-03-02').paceRead).toContain('accelerating'); // momentum 0.15
    expect(computeLuxuryPace(21, 20, 10, '2026-03-02').paceRead).toContain('picking up'); // momentum 0.05
    expect(computeLuxuryPace(20, 20, 10, '2026-03-02').paceRead).toContain('steady'); // momentum 0
    expect(computeLuxuryPace(19, 20, 10, '2026-03-02').paceRead).toContain('steady'); // momentum -0.05 -- boundary itself is still "steady" (>= -0.05)
    expect(computeLuxuryPace(18, 20, 10, '2026-03-02').paceRead).toContain('easing'); // momentum -0.10
    expect(computeLuxuryPace(16, 20, 10, '2026-03-02').paceRead).toContain('slowing sharply'); // momentum -0.20
  });
});

describe('computeDaysOnMarket', () => {
  // Note: the OUTPUT CONTRACT's own sample payload pairs "selling somewhat
  // faster" with (148 vs 178) as an ILLUSTRATIVE SHAPE example, not a
  // literally band-computed value -- (148-178)/178 = -0.1685, which is
  // actually past the -0.15 "somewhat faster" cutoff into "notably faster"
  // per STEP 6.5(3)'s own band thresholds. Trusting the formula's bands
  // (verified at their exact boundaries below) over the illustrative
  // example text, consistent with how every other section's sample JSON is
  // documented as shape-only, not exact values.
  it('formats the read with both numbers explicitly labeled', () => {
    const result = computeDaysOnMarket(148, 148);
    expect(result.domRead).toBe('Luxury days-on-market are selling times in line with the norm (148 days recently vs a 148-day 52-week average).');
  });

  it('bands delta correctly, strictly inside each bucket', () => {
    expect(computeDaysOnMarket(230, 200).domRead).toContain('sitting notably longer'); // delta 0.15
    expect(computeDaysOnMarket(210, 200).domRead).toContain('taking somewhat longer'); // delta 0.05
    expect(computeDaysOnMarket(200, 200).domRead).toContain('in line with the norm'); // delta 0
    expect(computeDaysOnMarket(180, 200).domRead).toContain('somewhat faster'); // delta -0.10
    expect(computeDaysOnMarket(148, 178).domRead).toContain('notably faster'); // delta -0.1685
  });
});

describe('computeDiscount', () => {
  function buildEntry(date: string, discount: number, salesCount: number): ContractPeriodEntry {
    return { date, discount, salesCount };
  }
  function buildSalesWk(): WeeklySalesStatsResponse {
    const dates = Array.from({ length: 26 }, (_, i) => `2026-${String(Math.floor(i / 4) + 1).padStart(2, '0')}-${String((i % 4) * 7 + 1).padStart(2, '0')}`);
    // last 13 weeks: discount -8, prior 13: discount -6, constant salesCount so weighting is trivial.
    const condos = dates.map((d, i) => buildEntry(d, i < 13 ? -6 : -8, 10));
    return { condos: { salesByWeek: condos } };
  }

  it('computes salesCount-weighted discount over last-13 vs prior-13 windows', () => {
    const result = computeDiscount(buildSalesWk())!;
    expect(result.discLast13).toBeCloseTo(-8, 6);
    expect(result.discPrior13).toBeCloseTo(-6, 6);
    expect(result.deltaPp).toBeCloseTo(Math.abs(-8) - Math.abs(-6), 6); // 2
    expect(result.discountRead).toContain('buyers are negotiating harder');
    expect(result.discountRead).toContain('-8.00%');
  });

  it('returns null with insufficient data', () => {
    expect(computeDiscount({})).toBeNull();
  });
});

describe('computeDollarVolume', () => {
  const topDeals: TopDeal[] = [{ address: 'x', price: 10_000_000, neighborhood: 'tribeca', sf: null, ppsf: null, dom: null, property_type: null }];

  it('returns null volume_read when momentum is below the 0.20 gate', () => {
    const result = computeDollarVolume(105, 100, topDeals, 40_000_000);
    expect(result.volumeRead).toBeNull();
  });

  it('produces a running-above read when momentum clears the gate', () => {
    const result = computeDollarVolume(130, 100, topDeals, 40_000_000);
    expect(result.volumeRead).toContain('running above');
  });

  it('appends the skew clause when the top deal exceeds 25% of this week\'s luxury volume', () => {
    const result = computeDollarVolume(130, 100, topDeals, 30_000_000); // 10M > 0.25*30M=7.5M
    expect(result.volumeRead).toContain('lifted by one outsized deal');
  });
});

describe('computeTierTrophy', () => {
  it('reports "no trophy" when current is 0', () => {
    expect(computeTierTrophy(0)).toBe('No trophy ($18M+) contracts this week (typical ~2).');
  });
  it('reports unusually active when current >= 4', () => {
    expect(computeTierTrophy(5)).toContain('Unusually active trophy week -- 5');
  });
  it('is null (unremarkable) for 1-3', () => {
    expect(computeTierTrophy(2)).toBeNull();
  });
});

describe('computeNeighborhoodMover', () => {
  function rank(entries: Array<{ name: string; pct: number; count: number; total: number }>): NeighborhoodRankResponse {
    return {
      neighborhoods: entries.map((e) => ({
        neighborhood: e.name,
        totalContracts: e.total,
        tiers: { p90: { pct: e.pct, count: e.count } },
      })),
    };
  }

  it('picks the largest-delta neighborhood that clears both floors', () => {
    const hood13 = rank([
      { name: 'noho', pct: 0.6, count: 3, total: 15 }, // fails both floors -- huge delta but thin sample
      { name: 'tribeca', pct: 0.364, count: 11, total: 41 }, // clears floors
    ]);
    const hood52 = rank([
      { name: 'noho', pct: 0.1, count: 2, total: 10 },
      { name: 'tribeca', pct: 0.268, count: 22, total: 82 },
    ]);
    const result = computeNeighborhoodMover(hood13, hood52);
    expect(result).toContain('Tribeca');
    expect(result).toContain('36.4%');
    expect(result).toContain('11 qualifying contracts of 41 total');
  });

  it('returns null when no candidate clears the floors', () => {
    const hood13 = rank([{ name: 'noho', pct: 0.6, count: 3, total: 15 }]);
    const hood52 = rank([{ name: 'noho', pct: 0.1, count: 2, total: 10 }]);
    expect(computeNeighborhoodMover(hood13, hood52)).toBeNull();
  });

  it('returns null when either input is missing', () => {
    expect(computeNeighborhoodMover(null, rank([]))).toBeNull();
  });
});

describe('computeMarketReadBadge', () => {
  it('bands momentum into the 5 states', () => {
    expect(computeMarketReadBadge(0.2, '2026-03-02')).toEqual({ badge: 'BUSY', class: 'read--busy' });
    expect(computeMarketReadBadge(0.1, '2026-03-02')).toEqual({ badge: 'ABOVE PACE', class: 'read--above' });
    expect(computeMarketReadBadge(0, '2026-03-02')).toEqual({ badge: 'NORMAL', class: 'read--normal' });
    expect(computeMarketReadBadge(-0.1, '2026-03-02')).toEqual({ badge: 'SLOW', class: 'read--slow' });
    expect(computeMarketReadBadge(-0.2, '2026-03-02')).toEqual({ badge: 'QUIET', class: 'read--quiet' });
  });

  it('appends -- SEASONAL during holiday weeks, keeping the class unchanged', () => {
    expect(computeMarketReadBadge(0, '2026-11-23').badge).toBe('NORMAL -- SEASONAL');
    expect(computeMarketReadBadge(0, '2026-11-23').class).toBe('read--normal');
    expect(computeMarketReadBadge(0, '2026-08-24').badge).toContain('SEASONAL');
    expect(computeMarketReadBadge(0, '2027-01-05').badge).toContain('SEASONAL');
    expect(computeMarketReadBadge(0, '2026-06-01').badge).not.toContain('SEASONAL');
  });
});

describe('computeSowhat (orchestrator)', () => {
  function buildLux(p90Counts: number[], trophyLast: number | null = 1): LuxuryContractStatsResponse {
    return {
      lines: {
        p90: { count: p90Counts.reduce((a, b) => a + b, 0), contractsByPeriod: p90Counts.map((c, i) => ({ date: `d${i}`, contractCount: c, totalPrice: c * 5_000_000, avgDaysOnMarket: 150 })) },
        p95: { contractsByPeriod: [] },
        p99: { contractsByPeriod: [{ date: 'last', contractCount: trophyLast ?? undefined }] },
      },
    };
  }

  const rankFixture: NeighborhoodRankResponse = {
    neighborhoods: [{ neighborhood: 'tribeca', totalContracts: 41, tiers: { p90: { pct: 0.364, count: 11 } } }],
  };
  const rankFixture52: NeighborhoodRankResponse = {
    neighborhoods: [{ neighborhood: 'tribeca', totalContracts: 82, tiers: { p90: { pct: 0.268, count: 22 } } }],
  };

  const baseInputs = {
    lux52: buildLux(Array(52).fill(20)),
    lux13: buildLux(Array(13).fill(20)),
    salesWk: null,
    hoodRank13: null,
    hoodRank52full: null,
    supplyLuxuryActive: 800,
    heroLuxuryCount: 20,
    heroLuxuryVolume: 100_000_000,
    topDeals: [] as TopDeal[],
    prevSupplyBandLabel: null,
    prevStreakWeeks: null,
    weekStart: '2026-03-02',
  };

  it('returns the fully-null shape when lux52 itself is null', () => {
    const result = computeSowhat({ ...baseInputs, lux52: null });
    expect(result.lede).toBeNull();
    expect(result.supply_read).toBeNull();
    expect(result.footnotes.provisional).toContain('recording lag');
  });

  it('nulls monthsOfSupply too when lux13 fails, since its own formula needs lux13\'s pace_13w -- but neighborhoodMover (independent of lux13) still computes from its own inputs', () => {
    // JUDGMENT CALL (documented in the final report): STEP 6.5's fail-handling
    // note says monthsOfSupply "still attempts" when lux13 fails, but its own
    // formula (pace_13w = lux13.lines.p90.count / 13) requires lux13 -- read
    // literally, that's a contradiction. Resolved by treating the note as
    // "don't let unrelated calls (salesWk/hoodRank13) null monthsOfSupply,"
    // not as a guarantee independent of lux13 itself.
    const result = computeSowhat({ ...baseInputs, lux13: null, hoodRank13: rankFixture, hoodRank52full: rankFixture52 });
    expect(result.supply_read).toBeNull();
    expect(result.pace_read).toBeNull();
    expect(result.dom_read).toBeNull();
    expect(result.trophy_read).toBeNull();
    expect(result.neighborhood_mover_read).not.toBeNull();
  });

  it('picks a lede from among the populated metrics', () => {
    const result = computeSowhat(baseInputs);
    expect(result.lede).not.toBeNull();
    expect([result.supply_read, result.pace_read, result.dom_read, result.discount_read, result.volume_read]).toContain(result.lede);
  });

  it('always includes fixed footnotes verbatim', () => {
    const result = computeSowhat(baseInputs);
    expect(result.footnotes.asking_not_achieved).toBe(
      'Contract figures use last asking price; closed-sale figures are recorded prices. The two are shown separately.',
    );
  });
});
