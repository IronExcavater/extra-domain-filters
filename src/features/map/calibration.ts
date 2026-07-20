export interface PixelPoint {
    left: number;
    top: number;
}

export interface GeoPoint {
    lat: number;
    lng: number;
}

export interface Calibration {
    toGeo(point: PixelPoint): GeoPoint;
}

interface LinearFit {
    slope: number;
    offset: number;
    residual: number;
}

function fitLinear(xs: readonly number[], ys: readonly number[]): LinearFit {
    const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
    const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
    let numerator = 0;
    let denominator = 0;

    for (let index = 0; index < xs.length; index += 1) {
        numerator += (xs[index] - meanX) * (ys[index] - meanY);
        denominator += (xs[index] - meanX) ** 2;
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const offset = meanY - slope * meanX;
    const residual = Math.sqrt(
        ys.reduce((sum, value, index) => sum + (slope * xs[index] + offset - value) ** 2, 0) / xs.length,
    );

    return { slope, offset, residual };
}

function sampleRange<T>(values: readonly T[], count: number): T[] {
    if (values.length <= count) return [...values];

    return Array.from({ length: count }, (_, index) =>
        values[Math.round((index / (count - 1)) * (values.length - 1))],
    );
}

export function calibrateMap(
    markerPixels: readonly PixelPoint[],
    listingCoordinates: readonly GeoPoint[],
): Calibration | undefined {
    const sampleCount = Math.min(20, markerPixels.length, listingCoordinates.length);
    if (sampleCount < 4) return undefined;

    const xPixels = sampleRange([...markerPixels].sort((a, b) => a.left - b.left), sampleCount)
        .map(point => point.left);
    const longitudes = sampleRange([...listingCoordinates].sort((a, b) => a.lng - b.lng), sampleCount)
        .map(point => point.lng);
    const yPixels = sampleRange([...markerPixels].sort((a, b) => a.top - b.top), sampleCount)
        .map(point => point.top);
    const latitudes = sampleRange([...listingCoordinates].sort((a, b) => b.lat - a.lat), sampleCount)
        .map(point => point.lat);
    const xFit = fitLinear(longitudes, xPixels);
    const yFit = fitLinear(latitudes, yPixels);
    const xRange = Math.max(...xPixels) - Math.min(...xPixels) || 1;
    const yRange = Math.max(...yPixels) - Math.min(...yPixels) || 1;
    const residualRatio = (xFit.residual / xRange + yFit.residual / yRange) / 2;

    if (residualRatio > 0.15) return undefined;

    return {
        toGeo(point): GeoPoint {
            return {
                lat: yFit.slope === 0 ? latitudes[0] : (point.top - yFit.offset) / yFit.slope,
                lng: xFit.slope === 0 ? longitudes[0] : (point.left - xFit.offset) / xFit.slope,
            };
        },
    };
}

export function findNearestPoint<T extends GeoPoint>(
    point: GeoPoint,
    candidates: readonly T[],
): T | undefined {
    let nearest: T | undefined;
    let distance = Infinity;

    for (const candidate of candidates) {
        const candidateDistance = Math.hypot(point.lat - candidate.lat, point.lng - candidate.lng);
        if (candidateDistance >= distance) continue;

        nearest = candidate;
        distance = candidateDistance;
    }

    return distance <= 0.01 ? nearest : undefined;
}
