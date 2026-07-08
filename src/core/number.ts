// Same scale table drives both display and snapping, so a value always formats to
// exactly what it snapped to (e.g. never "$734" once it's already snapped to $700).
const SCALES = [
    { threshold: 1_000_000, divisor: 1_000_000, suffix: 'm' },
    { threshold: 1_000, divisor: 1_000, suffix: 'k' },
];

function scaleFor(value: number) {
    return SCALES.find(scale => value >= scale.threshold);
}

export function format(value: number): string {
    const scale = scaleFor(value);
    if (!scale) return `$${Math.round(value)}`;
    return `$${Math.round(value / (scale.divisor / 10)) / 10}${scale.suffix}`;
}

export function snapPrice(value: number): number {
    const step = scaleFor(value)?.divisor ?? 1_000;
    return Math.round(value / (step / 10)) * (step / 10);
}
