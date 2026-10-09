export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface CoordinateValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  crs: "EPSG:4326";
}

const LAT_MIN = -90;
const LAT_MAX = 90;
const LON_MIN = -180;
const LON_MAX = 180;

export function validateCoordinate(
  latitude: number,
  longitude: number,
  options?: { allowNullIsland?: boolean },
): CoordinateValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Number.isFinite(latitude) || latitude < LAT_MIN || latitude > LAT_MAX) {
    errors.push("Latitude must be a finite number from -90 to 90.");
  }
  if (!Number.isFinite(longitude) || longitude < LON_MIN || longitude > LON_MAX) {
    errors.push("Longitude must be a finite number from -180 to 180.");
  }
  if (
    errors.length === 0 &&
    latitude === 0 &&
    longitude === 0 &&
    !options?.allowNullIsland
  ) {
    errors.push(
      "Coordinates 0, 0 are rejected unless the user explicitly accepts that point.",
    );
  }
  return { ok: errors.length === 0, errors, warnings, crs: "EPSG:4326" };
}

/** PostGIS WKT uses longitude then latitude. */
export function toWktPoint(latitude: number, longitude: number): string {
  const check = validateCoordinate(latitude, longitude, { allowNullIsland: true });
  if (!check.ok) {
    throw new Error(check.errors.join(" "));
  }
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

export function boundingBox(
  latitude: number,
  longitude: number,
  bufferMeters: number,
): [number, number, number, number] {
  const check = validateCoordinate(latitude, longitude, { allowNullIsland: true });
  if (!check.ok) throw new Error(check.errors.join(" "));
  if (!Number.isFinite(bufferMeters) || bufferMeters <= 0 || bufferMeters > 50000) {
    throw new Error("Buffer must be between 0 and 50,000 metres.");
  }
  const latDelta = bufferMeters / 111_320;
  const lonScale = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);
  const lonDelta = bufferMeters / (111_320 * lonScale);
  return [
    longitude - lonDelta,
    latitude - latDelta,
    longitude + lonDelta,
    latitude + latDelta,
  ];
}

export function precisionLabel(input: {
  userConfirmed: boolean;
  acceptedLowPrecision: boolean;
  geocoder: string | null;
}): "user_confirmed_point" | "geocoder_candidate" | "low_precision_accepted" | "unconfirmed" {
  if (input.acceptedLowPrecision && !input.userConfirmed) return "low_precision_accepted";
  if (input.userConfirmed) return "user_confirmed_point";
  if (input.geocoder) return "geocoder_candidate";
  return "unconfirmed";
}
