/**
 * The single shared percentage-change helper for the pipeline.
 *
 * Every `*_pct` field in the weekly_report payload follows the same rule from
 * the site-data-agent spec: "never divide by zero, never fabricate." This
 * computes `(numerator - denominator) / denominator * 100` in percentage
 * scale (e.g. 35.0 meaning 35%, never a 0-1 fraction), returning `null`
 * whenever the denominator is 0, null, or undefined, or the numerator is
 * null/undefined.
 *
 * Note: despite the name, most call sites in the spec pass an already-computed
 * delta as the numerator (e.g. `current - previous`) and the baseline as the
 * denominator -- so `pct(current - previous, previous)` is the typical usage,
 * not `pct(current, previous)`. Callers are responsible for computing the
 * correct numerator; this helper only owns the null-safety and scaling.
 */
export function pct(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (numerator === null || numerator === undefined) return null;
  if (denominator === null || denominator === undefined || denominator === 0) return null;
  if (Number.isNaN(numerator) || Number.isNaN(denominator)) return null;

  return (numerator / denominator) * 100;
}
