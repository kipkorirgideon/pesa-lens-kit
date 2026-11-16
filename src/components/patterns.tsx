// Second cue for chart series that share a stack: a fill pattern on top of the colour (WCAG 1.4.1).
// Index 0 stays solid; later series get stripes, dots, then a crosshatch. Exports are functions only
// so Recharts can take the <defs> element as a direct child of the chart.
import type { ReactElement } from 'react';

const OVERLAY = '#ffffff';

/** SVG ids must be safe inside url(#…): React's useId() contains colons. */
export function patternId(prefix: string, index: number): string {
  return `pat-${prefix.replace(/[^a-zA-Z0-9_-]/g, '')}-${index}`;
}

/** The <pattern> element for series `index` (callers skip index 0, which is solid). */
export function patternElement(id: string, index: number, color: string): ReactElement {
  const overlay =
    index === 1 ? (
      <line x1="0" y1="0" x2="0" y2="6" stroke={OVERLAY} strokeWidth="2.5" strokeOpacity="0.7" />
    ) : index === 2 ? (
      <circle cx="3" cy="3" r="1.4" fill={OVERLAY} fillOpacity="0.8" />
    ) : (
      <path d="M0 0H6M0 0V6" stroke={OVERLAY} strokeWidth="1.5" strokeOpacity="0.7" fill="none" />
    );
  return (
    <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform={index === 1 ? 'rotate(45)' : undefined}>
      <rect width="6" height="6" fill={color} />
      {overlay}
    </pattern>
  );
}

/** `<defs>` for a chart: one pattern per non-first series. Place it as a child of the Recharts chart. */
export function patternDefs(prefix: string, colors: readonly string[]): ReactElement {
  return <defs>{colors.map((c, i) => (i === 0 ? null : patternElement(patternId(prefix, i), i, c)))}</defs>;
}

/** The `fill` for series `index`: the plain colour for the first series, a pattern reference otherwise. */
export function patternFill(prefix: string, index: number, color: string): string {
  return index === 0 ? color : `url(#${patternId(prefix, index)})`;
}
