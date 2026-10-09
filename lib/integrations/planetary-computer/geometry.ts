const CLOUD_CLASSES = new Set([3, 8, 9, 10]);

/** Share of scene-classification pixels that are cloud shadow, cloud or cirrus. No-data pixels count as cloud. */
export function localCloudPercent(counts: number[], classes: number[]): number {
  let total = 0;
  let cloudy = 0;
  classes.forEach((value, index) => {
    const count = counts[index] ?? 0;
    total += count;
    if (CLOUD_CLASSES.has(Math.round(value)) || Math.round(value) === 0) cloudy += count;
  });
  return total > 0 ? Math.round((cloudy / total) * 1000) / 10 : 100;
}

export function squareAround(latitude: number, longitude: number, halfSideMeters: number) {
  const dLat = halfSideMeters / 111_320;
  const dLon = halfSideMeters / (111_320 * Math.cos((latitude * Math.PI) / 180));
  const ring = [
    [longitude - dLon, latitude - dLat],
    [longitude + dLon, latitude - dLat],
    [longitude + dLon, latitude + dLat],
    [longitude - dLon, latitude + dLat],
    [longitude - dLon, latitude - dLat],
  ];
  return { type: "Polygon" as const, coordinates: [ring] };
}
