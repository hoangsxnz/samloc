const MIN_TURNS = 5;

function polar(radius: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

/** SVG path for wedge `index` of `count`, centred on the origin; wedge 0 starts at 12 o'clock, clockwise. */
export function segmentPath(index: number, count: number, radius: number): string {
  const step = 360 / count;
  const start = polar(radius, index * step);
  const end = polar(radius, (index + 1) * step);
  const largeArc = step > 180 ? 1 : 0;
  return `M0,0 L${start.x.toFixed(2)},${start.y.toFixed(2)} A${radius},${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)},${end.y.toFixed(2)} Z`;
}

/** Label anchor on the wedge bisector at 62% of the radius; `angle` rotates text to read outward. */
export function labelPosition(index: number, count: number, radius: number): { x: number; y: number; angle: number } {
  const angle = (index + 0.5) * (360 / count);
  const { x, y } = polar(radius * 0.62, angle);
  return { x, y, angle };
}

/**
 * Final rotation (deg) that puts wedge `index`'s bisector under the top pointer. Always at least
 * five full turns past `previousRotation`, so a spin never rewinds and always looks like a spin.
 */
export function rotationFor(index: number, count: number, previousRotation: number): number {
  const bisector = (index + 0.5) * (360 / count);
  const wanted = (360 - bisector) % 360;
  const base = previousRotation + MIN_TURNS * 360;
  const remainder = ((base % 360) + 360) % 360;
  return base + ((wanted - remainder + 360) % 360);
}
