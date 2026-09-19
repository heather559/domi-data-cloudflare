/**
 * Field-by-field diff engine for the backfill comparison: computed payload
 * (from compute/, fed with real historical fetches) vs. the real stored
 * payload for that same week (already in `weekly_report`).
 *
 * Per the architect's guidance (repeated in the task brief): the OLD
 * system's numbers went through an LLM doing arithmetic in its head, so
 * small numeric drift between the computed and stored values is EXPECTED
 * and not itself a failure -- this engine buckets numeric leaves into
 * exact / close (within tolerance) / mismatch, rather than a blunt
 * equal-or-not comparison.
 */

export type FieldStatus = 'exact' | 'close' | 'mismatch' | 'missing_in_computed' | 'missing_in_stored' | 'type_mismatch';

export interface FieldDiff {
  path: string;
  status: FieldStatus;
  computed: unknown;
  stored: unknown;
  detail?: string;
}

export interface CompareOptions {
  /** Relative tolerance for numeric leaves, e.g. 0.03 = within 3% counts as "close". */
  relTolerance: number;
  /** For values near zero (where relative tolerance blows up), an absolute tolerance fallback. */
  absTolerance: number;
}

const DEFAULT_OPTIONS: CompareOptions = { relTolerance: 0.03, absTolerance: 0.05 };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function compareNumbers(path: string, computed: number, stored: number, options: CompareOptions): FieldDiff {
  if (computed === stored) return { path, status: 'exact', computed, stored };

  const diff = Math.abs(computed - stored);
  const denom = Math.max(Math.abs(stored), Math.abs(computed));
  const relDiff = denom === 0 ? 0 : diff / denom;

  if (diff <= options.absTolerance || relDiff <= options.relTolerance) {
    return { path, status: 'close', computed, stored, detail: `relative diff ${(relDiff * 100).toFixed(2)}%` };
  }

  return { path, status: 'mismatch', computed, stored, detail: `relative diff ${(relDiff * 100).toFixed(2)}%` };
}

function compareLeaf(path: string, computed: unknown, stored: unknown, options: CompareOptions): FieldDiff {
  if (computed === null && stored === null) return { path, status: 'exact', computed, stored };
  if (computed === null || stored === null) {
    return { path, status: 'mismatch', computed, stored, detail: 'one side is null, the other is not' };
  }

  if (typeof computed === 'number' && typeof stored === 'number') {
    if (Number.isNaN(computed) || Number.isNaN(stored)) {
      return { path, status: 'mismatch', computed, stored, detail: 'NaN encountered' };
    }
    return compareNumbers(path, computed, stored, options);
  }

  if (typeof computed !== typeof stored) {
    return { path, status: 'type_mismatch', computed, stored, detail: `${typeof computed} vs ${typeof stored}` };
  }

  if (computed === stored) return { path, status: 'exact', computed, stored };
  return { path, status: 'mismatch', computed, stored };
}

/** Recursively walks two values (objects/arrays/leaves) and produces a flat list of per-field diffs. */
export function comparePayloads(
  computed: unknown,
  stored: unknown,
  path = '$',
  options: CompareOptions = DEFAULT_OPTIONS,
): FieldDiff[] {
  if (computed === undefined && stored === undefined) return [];
  if (computed === undefined) return [{ path, status: 'missing_in_computed', computed, stored }];
  if (stored === undefined) return [{ path, status: 'missing_in_stored', computed, stored }];

  if (Array.isArray(computed) || Array.isArray(stored)) {
    if (!Array.isArray(computed) || !Array.isArray(stored)) {
      return [{ path, status: 'type_mismatch', computed, stored, detail: 'one side is an array, the other is not' }];
    }
    const maxLen = Math.max(computed.length, stored.length);
    if (computed.length !== stored.length) {
      // Still diff element-wise up to the shorter length so a length
      // mismatch doesn't hide otherwise-useful per-element results, but
      // flag the length mismatch itself as its own top-level diff too.
      const out: FieldDiff[] = [
        {
          path: `${path}.length`,
          status: 'mismatch',
          computed: computed.length,
          stored: stored.length,
          detail: 'array length mismatch',
        },
      ];
      for (let i = 0; i < maxLen; i++) {
        out.push(...comparePayloads(computed[i], stored[i], `${path}[${i}]`, options));
      }
      return out;
    }
    const out: FieldDiff[] = [];
    for (let i = 0; i < computed.length; i++) {
      out.push(...comparePayloads(computed[i], stored[i], `${path}[${i}]`, options));
    }
    return out;
  }

  if (isPlainObject(computed) || isPlainObject(stored)) {
    if (!isPlainObject(computed) || !isPlainObject(stored)) {
      return [{ path, status: 'type_mismatch', computed, stored, detail: 'one side is an object, the other is not' }];
    }
    const keys = new Set([...Object.keys(computed), ...Object.keys(stored)]);
    const out: FieldDiff[] = [];
    for (const key of keys) {
      out.push(...comparePayloads(computed[key], stored[key], `${path}.${key}`, options));
    }
    return out;
  }

  return [compareLeaf(path, computed, stored, options)];
}

export interface CompareSummary {
  total: number;
  exact: number;
  close: number;
  mismatch: number;
  missing: number;
  typeMismatch: number;
  mismatches: FieldDiff[];
}

export function summarizeDiffs(diffs: readonly FieldDiff[]): CompareSummary {
  const summary: CompareSummary = { total: diffs.length, exact: 0, close: 0, mismatch: 0, missing: 0, typeMismatch: 0, mismatches: [] };
  for (const d of diffs) {
    if (d.status === 'exact') summary.exact++;
    else if (d.status === 'close') summary.close++;
    else if (d.status === 'mismatch') {
      summary.mismatch++;
      summary.mismatches.push(d);
    } else if (d.status === 'type_mismatch') {
      summary.typeMismatch++;
      summary.mismatches.push(d);
    } else {
      summary.missing++;
      summary.mismatches.push(d);
    }
  }
  return summary;
}
