import type { Polygon } from "geojson";
import { GPS_CONE_LENGTH_METERS, GPS_CONE_HALF_ANGLE_DEG, GPS_CONE_SEGMENTS } from "./mapConfig";

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function coerceCoord(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export function getLat(value: any) {
  return coerceCoord(value?.lat ?? value?.latitude ?? value?.latitud ?? value?.y);
}

export function getLng(value: any) {
  return coerceCoord(value?.lng ?? value?.lon ?? value?.long ?? value?.longitude ?? value?.longitud ?? value?.x);
}

export function normalizeBearingDegrees(bearing: number) {
  return ((bearing % 360) + 360) % 360;
}

export function destinationPoint(lng: number, lat: number, bearingDeg: number, distanceMeters: number): [number, number] {
  const earthRadiusMeters = 6371000;
  const angularDistance = distanceMeters / earthRadiusMeters;
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lng * Math.PI) / 180;

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngularDistance = Math.sin(angularDistance);
  const cosAngularDistance = Math.cos(angularDistance);

  const lat2 = Math.asin(
    clamp(
      sinLat1 * cosAngularDistance + cosLat1 * sinAngularDistance * Math.cos(bearingRad),
      -1,
      1
    )
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearingRad) * sinAngularDistance * cosLat1,
      cosAngularDistance - sinLat1 * Math.sin(lat2)
    );

  const lonDeg = (((lon2 * 180) / Math.PI + 540) % 360) - 180;
  return [lonDeg, (lat2 * 180) / Math.PI];
}

export function buildGpsConePolygon(
  lng: number,
  lat: number,
  headingDeg: number,
  distanceMeters = GPS_CONE_LENGTH_METERS,
  halfAngleDeg = GPS_CONE_HALF_ANGLE_DEG,
  segments = GPS_CONE_SEGMENTS
): Polygon {
  const heading = normalizeBearingDegrees(headingDeg);
  const startBearing = heading - halfAngleDeg;
  const endBearing = heading + halfAngleDeg;
  const ring: [number, number][] = [[lng, lat]];

  for (let i = 0; i <= segments; i += 1) {
    const ratio = i / segments;
    const bearing = startBearing + (endBearing - startBearing) * ratio;
    ring.push(destinationPoint(lng, lat, bearing, distanceMeters));
  }

  ring.push([lng, lat]);
  return { type: "Polygon", coordinates: [ring] };
}

export function metersToPixelsAtLat(meters: number, lat: number, zoom: number) {
    const metersPerPixel =
      (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
    return meters / Math.max(0.000001, metersPerPixel);
  }
