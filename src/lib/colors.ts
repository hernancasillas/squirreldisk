// Each top-level slice of the focused folder gets its own hue (spread with the
// golden angle so neighbours never look alike); deeper rings keep that hue and
// get lighter, so the chart and the file list share one color legend.

const GOLDEN_ANGLE = 137.508;

export function hueFor(index: number): number {
  return (215 + index * GOLDEN_ANGLE) % 360;
}

/**
 * `sibling` is the node's index among its siblings: neighbouring slices in the
 * outer rings get slightly different hue and lightness so they stay distinct
 * even when one folder dominates the whole chart.
 */
export function colorFor(hue: number, depth: number, isDir: boolean, sibling = 0): string {
  const d = Math.max(depth - 1, 0);
  const shift = d === 0 ? 0 : ((sibling % 5) - 2) * 7;
  const saturation = (isDir ? 72 : 50) - d * 5;
  const lightness = 54 + d * 6 + (d > 0 && sibling % 2 === 1 ? -6 : 0);
  return `hsl(${(hue + shift + 360) % 360} ${Math.max(saturation, 28)}% ${Math.min(lightness, 80)}%)`;
}

export const REST_COLOR = "hsl(222 12% 42%)";
export const FREE_COLOR = "hsl(222 14% 24%)";
