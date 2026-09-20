/** Shared axis helpers for the hand-rolled SVG charts. */

function niceStep(raw: number): number {
  const exponent = Math.floor(Math.log10(raw))
  const fraction = raw / 10 ** exponent
  const multiple = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return multiple * 10 ** exponent
}

/**
 * "Nice" tick values (steps of 1/2/5×10^k) covering [minValue, maxValue],
 * roughly capped at maxTicks gridlines.
 */
export function computeTicks(minValue: number, maxValue: number, maxTicks = 4): number[] {
  const span = maxValue - minValue
  if (!Number.isFinite(span) || span <= 0) return [minValue]
  const step = niceStep(span / Math.max(maxTicks - 1, 1))
  const ticks: number[] = []
  for (
    let tick = Math.ceil(minValue / step) * step;
    tick <= maxValue + step * 1e-9;
    tick += step
  ) {
    ticks.push(Number(tick.toPrecision(10)))
    if (ticks.length > maxTicks + 1) break
  }
  return ticks.length > 1 ? ticks : [minValue, maxValue]
}
