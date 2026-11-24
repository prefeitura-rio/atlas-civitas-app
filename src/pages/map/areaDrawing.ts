import type * as mapboxgl from "mapbox-gl";
import type { FeatureCollection, Feature } from "geojson";
import type { AreaDrawPolygonPoints } from "./mapConfig";
import { clamp } from "./coordinates";
import { pointInRing, type PolygonalGeometry } from "./geometry";

export function closestPointOnSegment2D(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq <= 0) {
    const distX = px - ax;
    const distY = py - ay;
    return { x: ax, y: ay, distanceSq: distX * distX + distY * distY };
  }

  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
  const x = ax + dx * t;
  const y = ay + dy * t;
  const distX = px - x;
  const distY = py - y;

  return { x, y, distanceSq: distX * distX + distY * distY };
}

export const AREA_DRAW_MIN_VERTEX_DISTANCE_PX = 6;

export type AreaDrawInsertCandidate = {
  insertIndex: number;
  projectedPoint: [number, number];
  distanceSq: number;
};

export function getAreaDrawInsertCandidates(
  map: mapboxgl.Map,
  points: Array<[number, number]>,
  target: [number, number]
) {
  if (points.length < 2) return [];

  const targetPx = map.project(target);
  const candidates: AreaDrawInsertCandidate[] = [];

  const inspectSegment = (startIndex: number, endIndex: number) => {
    const startPx = map.project(points[startIndex]);
    const endPx = map.project(points[endIndex]);
    const closest = closestPointOnSegment2D(
      targetPx.x,
      targetPx.y,
      startPx.x,
      startPx.y,
      endPx.x,
      endPx.y
    );

    const lngLat = map.unproject([closest.x, closest.y]);
    candidates.push({
      insertIndex: startIndex + 1,
      projectedPoint: [lngLat.lng, lngLat.lat],
      distanceSq: closest.distanceSq,
    });
  };

  for (let i = 0; i < points.length - 1; i++) {
    inspectSegment(i, i + 1);
  }

  if (points.length >= 3) {
    inspectSegment(points.length - 1, 0);
  }

  return candidates.sort((a, b) => a.distanceSq - b.distanceSq);
}

export function getAreaDrawInsertInfo(
  map: mapboxgl.Map,
  points: Array<[number, number]>,
  target: [number, number]
) {
  const best = getAreaDrawInsertCandidates(map, points, target)[0];
  if (!best) return null;
  return {
    insertIndex: best.insertIndex,
    point: best.projectedPoint,
  };
}

export function areaDrawContainsPoint(points: Array<[number, number]>, target: [number, number]) {
  if (points.length < 3) return false;
  return pointInRing(target, points);
}

export function areaDrawIsNearExistingVertex(
  map: mapboxgl.Map,
  points: Array<[number, number]>,
  target: [number, number],
  minDistancePx = AREA_DRAW_MIN_VERTEX_DISTANCE_PX
) {
  if (!points.length) return false;
  const targetPx = map.project(target);
  const minDistanceSq = minDistancePx * minDistancePx;

  return points.some((point) => {
    const pointPx = map.project(point);
    const dx = targetPx.x - pointPx.x;
    const dy = targetPx.y - pointPx.y;
    return dx * dx + dy * dy <= minDistanceSq;
  });
}

export function getAreaDrawExpandedPoints(
  map: mapboxgl.Map,
  points: Array<[number, number]>,
  target: [number, number]
) {
  const candidates = getAreaDrawInsertCandidates(map, points, target);

  for (const candidate of candidates) {
    const nextPoints = insertAreaDrawPoint(points, candidate.insertIndex, target);
    if (!areaDrawHasSelfIntersection(nextPoints)) return nextPoints;
  }

  return null;
}

export function insertAreaDrawPoint(
  points: Array<[number, number]>,
  insertIndex: number,
  nextPoint: [number, number]
) {
  const next = [...points];
  next.splice(insertIndex, 0, nextPoint);
  return next;
}

export function replaceAreaDrawPoint(
  points: Array<[number, number]>,
  index: number,
  nextPoint: [number, number]
) {
  return points.map((point, pointIndex) =>
    pointIndex === index ? nextPoint : point
  );
}

export function areaDrawOrientation(a: [number, number], b: [number, number], c: [number, number]) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  const epsilon = 1e-12;
  if (Math.abs(value) <= epsilon) return 0;
  return value > 0 ? 1 : 2;
}

export function areaDrawOnSegment(a: [number, number], b: [number, number], c: [number, number]) {
  const epsilon = 1e-12;
  return (
    b[0] <= Math.max(a[0], c[0]) + epsilon &&
    b[0] + epsilon >= Math.min(a[0], c[0]) &&
    b[1] <= Math.max(a[1], c[1]) + epsilon &&
    b[1] + epsilon >= Math.min(a[1], c[1])
  );
}

export function areaDrawSegmentsIntersect(
  a1: [number, number],
  a2: [number, number],
  b1: [number, number],
  b2: [number, number]
) {
  const o1 = areaDrawOrientation(a1, a2, b1);
  const o2 = areaDrawOrientation(a1, a2, b2);
  const o3 = areaDrawOrientation(b1, b2, a1);
  const o4 = areaDrawOrientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && areaDrawOnSegment(a1, b1, a2)) return true;
  if (o2 === 0 && areaDrawOnSegment(a1, b2, a2)) return true;
  if (o3 === 0 && areaDrawOnSegment(b1, a1, b2)) return true;
  if (o4 === 0 && areaDrawOnSegment(b1, a2, b2)) return true;
  return false;
}

export function areaDrawHasSelfIntersection(points: Array<[number, number]>) {
  if (points.length < 4) return false;

  const segments = points.map((point, index) => [point, points[(index + 1) % points.length]] as const);

  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const adjacent = Math.abs(i - j) <= 1;
      const closingAdjacent = i === 0 && j === segments.length - 1;
      if (adjacent || closingAdjacent) continue;
      if (areaDrawSegmentsIntersect(segments[i][0], segments[i][1], segments[j][0], segments[j][1])) {
        return true;
      }
    }
  }

  return false;
}

export function makeAreaDrawGeoJSON(
  polygons: AreaDrawPolygonPoints[],
  currentPoints: AreaDrawPolygonPoints
) {
  const features: Feature<any, any>[] = [];

  polygons.forEach((points, polygonIndex) => {
    if (points.length >= 3) {
      const ring = [...points, points[0]];
      features.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [ring] },
        properties: { kind: "area_polygon_completed", polygon_index: polygonIndex },
      } as any);
    }
  });

  if (currentPoints.length >= 3) {
    const ring = [...currentPoints, currentPoints[0]];
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: { kind: "area_polygon_current" },
    } as any);
  }

  if (currentPoints.length >= 2) {
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: currentPoints },
      properties: { kind: "area_line_current" },
    } as any);
  }

  currentPoints.forEach((pt, index) => {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: pt },
      properties: { kind: "area_point_current", point_index: index },
    } as any);
  });

  return { type: "FeatureCollection", features } as FeatureCollection<any, any>;
}

export function areaGeometryFromPolygons(
    polygons: AreaDrawPolygonPoints[],
    currentPoints: AreaDrawPolygonPoints
  ): PolygonalGeometry | null {
    const validPolygons = [...polygons];
    if (currentPoints.length >= 3 && !areaDrawHasSelfIntersection(currentPoints)) {
      validPolygons.push(currentPoints);
    }
    if (!validPolygons.length) return null;
    if (validPolygons.length === 1) {
      const ring = [...validPolygons[0], validPolygons[0][0]];
      return {
        type: "Polygon",
        coordinates: [ring],
      };
    }
    return {
      type: "MultiPolygon",
      coordinates: validPolygons.map((points) => [[...points, points[0]]]),
    };
  }
