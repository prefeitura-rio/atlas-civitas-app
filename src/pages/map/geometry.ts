import type {
  FeatureCollection,
  Feature,
  Polygon,
  MultiPolygon,
  LineString,
  MultiLineString,
  GeometryCollection,
} from "geojson";
import type { Camera, CameraIntel, CameraLpr, Radar } from "./types";
import { getPointCollectionKey } from "./shared";
import type { SecurityAreaKind } from "./mapConfig";

export type BairrosFeature = Feature<Polygon | MultiPolygon, { NOME?: string; nome?: string } & Record<string, any>>;

export type BairrosLineFeature = Feature<LineString | MultiLineString, { NOME?: string; nome?: string } & Record<string, any>>;

export type SecurityAreaFeature = Feature<Polygon | MultiPolygon, { name?: string | number } & Record<string, any>>;

export type GeometryStats = {
  cameras: number;
  inteligentes: number;
  lpr: number;
  radares: number;
};

export type GeometrySelectionIds = {
  cameras: string[];
  super_cameras: string[];
  lpr: string[];
  radar: string[];
};

export type PolygonalGeometry = Polygon | MultiPolygon;

export function closeLinearRing(ring: number[][]) {
  if (!ring.length) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first?.[0] === last?.[0] && first?.[1] === last?.[1]) return ring;
  return [...ring, [...first]];
}

export function sameCoordinate(a: number[] | undefined, b: number[] | undefined) {
  if (!a || !b) return false;
  return Math.abs(Number(a[0]) - Number(b[0])) < 1e-10 && Math.abs(Number(a[1]) - Number(b[1])) < 1e-10;
}

export function isValidLngLat(position: number[] | undefined): position is number[] {
  return Number.isFinite(Number(position?.[0])) && Number.isFinite(Number(position?.[1]));
}

export function splitRingIntoLineStrings(rawRing: number[][]) {
  const ring = rawRing.filter(isValidLngLat);
  if (ring.length < 2) return [];
  return [ring.length >= 3 ? closeLinearRing(ring) : ring];
}

export function geometryToLineStrings(geometry: Polygon | MultiPolygon | null | undefined) {
  if (!geometry) return [];
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) => polygon.flatMap((ring) => splitRingIntoLineStrings(ring)));
}

export function buildBairrosLineGeoData(
  data: FeatureCollection<Polygon | MultiPolygon, any>
): FeatureCollection<LineString | MultiLineString, any> {
  const features = (data.features || [])
    .map((feature) => {
      const lineStrings = geometryToLineStrings(feature.geometry);
      if (!lineStrings.length) return null;

      const properties = { ...(feature.properties || {}) };
      const nome =
        (typeof properties.NOME === "string" && properties.NOME.trim()) ||
        (typeof properties.nome === "string" && properties.nome.trim()) ||
        "";

      if (nome) {
        properties.NOME = nome;
        properties.nome = nome;
      }

      const geometry =
        lineStrings.length === 1
          ? ({ type: "LineString", coordinates: lineStrings[0] } as LineString)
          : ({ type: "MultiLineString", coordinates: lineStrings } as MultiLineString);

      return {
        ...feature,
        geometry,
        properties,
      };
    })
    .filter((feature): feature is BairrosLineFeature => !!feature);

  return {
    type: "FeatureCollection",
    features,
  };
}

export function splitRawRingIntoClosedRings(rawRing: number[][]) {
  const rings: number[][][] = [];
  let current: number[][] = [];

  for (let i = 0; i < rawRing.length; i++) {
    const position = rawRing[i];
    current.push(position);

    if (current.length >= 4 && sameCoordinate(position, current[0])) {
      rings.push(current);
      current = [];
    }
  }

  if (current.length >= 3) {
    rings.push(closeLinearRing(current));
  }

  return rings;
}

export function getRingSamplePoint(ring: number[][]): [number, number] | null {
  for (const position of ring) {
    const lng = Number(position?.[0]);
    const lat = Number(position?.[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }
  return null;
}

export function getRingSignedArea(ring: number[][]) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const current = ring[i];
    const next = ring[i + 1];
    area += Number(current?.[0]) * Number(next?.[1]) - Number(next?.[0]) * Number(current?.[1]);
  }
  return area / 2;
}

export function getRingOrientation(ring: number[][]) {
  const area = getRingSignedArea(ring);
  if (Math.abs(area) < 1e-12) return 0;
  return area > 0 ? 1 : -1;
}

export function splitPolygonRingsIntoPolygons(rings: number[][][]) {
  const polygons: number[][][][] = [];
  const exteriorOrientations: number[] = [];

  for (const rawRing of rings) {
    const closedRings = splitRawRingIntoClosedRings(rawRing);

    for (const closedRing of closedRings) {
      const ring = closeLinearRing(closedRing);
      if (ring.length < 4) continue;

      const sample = getRingSamplePoint(ring);
      const orientation = getRingOrientation(ring);
      let parentIndex = -1;

      if (sample && orientation !== 0) {
        parentIndex = polygons.findIndex(
          (polygon, index) =>
            polygon[0] &&
            exteriorOrientations[index] !== 0 &&
            orientation !== exteriorOrientations[index] &&
            pointInRing(sample, polygon[0])
        );
      }

      if (parentIndex >= 0) {
        polygons[parentIndex].push(ring);
      } else {
        polygons.push([ring]);
        exteriorOrientations.push(orientation);
      }
    }
  }

  return polygons;
}

export function normalizeBairroGeometry(geometry: Polygon | MultiPolygon | null | undefined): Polygon | MultiPolygon | null {
  if (!geometry) return null;

  const polygons =
    geometry.type === "Polygon"
      ? splitPolygonRingsIntoPolygons(geometry.coordinates)
      : geometry.coordinates.flatMap((polygon) => splitPolygonRingsIntoPolygons(polygon));

  if (!polygons.length) return null;
  return polygons.length === 1
    ? ({ type: "Polygon", coordinates: polygons[0] } as Polygon)
    : ({ type: "MultiPolygon", coordinates: polygons } as MultiPolygon);
}

export function mergePolygonalGeometries(geometries: Array<Polygon | MultiPolygon>): Polygon | MultiPolygon | null {
  const coordinates = geometries.flatMap((geometry) => geometryToMultiPolygonCoordinates(geometry));
  if (!coordinates.length) return null;
  return coordinates.length === 1
    ? ({ type: "Polygon", coordinates: coordinates[0] } as Polygon)
    : ({ type: "MultiPolygon", coordinates } as MultiPolygon);
}

export function normalizeBairrosGeoData(
  data: FeatureCollection<Polygon | MultiPolygon, any>
): FeatureCollection<Polygon | MultiPolygon, any> {
  const grouped = new Map<string, Feature<Polygon | MultiPolygon, any>[]>();
  const passthrough: Feature<Polygon | MultiPolygon, any>[] = [];

  for (const feature of data.features || []) {
    const geometry = normalizeBairroGeometry(feature.geometry);
    if (!geometry) continue;

    const properties = { ...(feature.properties || {}) };
    const nome =
      (typeof properties.NOME === "string" && properties.NOME.trim()) ||
      (typeof properties.nome === "string" && properties.nome.trim()) ||
      "";

    if (!nome) {
      passthrough.push({ ...feature, geometry });
      continue;
    }

    properties.NOME = nome;
    properties.nome = nome;

    const nextFeature = {
      ...feature,
      geometry,
      properties,
    };

    const current = grouped.get(nome);
    if (current) {
      current.push(nextFeature);
    } else {
      grouped.set(nome, [nextFeature]);
    }
  }

  const merged = Array.from(grouped.entries()).map(([nome, features]) => {
    const geometries = features
      .map((feature) => feature.geometry)
      .filter((geometry): geometry is Polygon | MultiPolygon => !!geometry);
    const geometry = mergePolygonalGeometries(geometries);
    const base = features[0];

    if (!geometry) return null;

    return {
      ...base,
      geometry,
      properties: {
        ...base.properties,
        NOME: nome,
        nome,
        bairro_parts: features.length,
      },
    };
  }).filter((feature): feature is Feature<Polygon | MultiPolygon, any> => !!feature);

  return {
    ...data,
    features: [...passthrough, ...merged],
  };
}

export function getBairroFeatureName(properties: Record<string, any> | null | undefined): string {
  return (
    (typeof properties?.NOME === "string" && properties.NOME.trim()) ||
    (typeof properties?.nome === "string" && properties.nome.trim()) ||
    ""
  );
}

export function emptyGeometrySelectionIds(): GeometrySelectionIds {
  return {
    cameras: [],
    super_cameras: [],
    lpr: [],
    radar: [],
  };
}

export function buildGeometryStats(
  geom: Polygon | MultiPolygon,
  cameras: Camera[],
  camerasIntel: CameraIntel[],
  camerasLpr: CameraLpr[],
  radares: Radar[]
): GeometryStats | null {
  const bbox = getGeometryBbox(geom);
  if (!bbox) return null;

  const inBbox = (lng: number, lat: number) =>
    lng >= bbox.minX && lng <= bbox.maxX && lat >= bbox.minY && lat <= bbox.maxY;

  const countPoints = (
    points: Array<{ lng?: number | string | null; lat?: number | string | null }>
  ) => {
    let count = 0;
    for (const p of points) {
      const lng = Number(p.lng);
      const lat = Number(p.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      if (!inBbox(lng, lat)) continue;
      if (pointInGeometry([lng, lat], geom)) count++;
    }
    return count;
  };

  return {
    cameras: countPoints(cameras),
    inteligentes: countPoints(camerasIntel),
    lpr: countPoints(camerasLpr),
    radares: countPoints(radares),
  };
}

export function buildGeometrySelectionIds(
  geom: Polygon | MultiPolygon,
  cameras: Camera[],
  camerasIntel: CameraIntel[],
  camerasLpr: CameraLpr[],
  radares: Radar[]
): GeometrySelectionIds {
  const bbox = getGeometryBbox(geom);
  if (!bbox) return emptyGeometrySelectionIds();

  const inBbox = (lng: number, lat: number) =>
    lng >= bbox.minX && lng <= bbox.maxX && lat >= bbox.minY && lat <= bbox.maxY;

  const camerasIds: string[] = [];
  const superCameraIds: string[] = [];
  const lprIds: string[] = [];
  const radarIds: string[] = [];

  for (const c of cameras) {
    const lng = Number(c.lng);
    const lat = Number(c.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (!inBbox(lng, lat)) continue;
    if (!pointInGeometry([lng, lat], geom)) continue;
    const idOrCode = getPointCollectionKey(c);
    if (idOrCode) camerasIds.push(idOrCode);
  }

  for (const c of camerasIntel) {
    const lng = Number(c.lng);
    const lat = Number(c.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (!inBbox(lng, lat)) continue;
    if (!pointInGeometry([lng, lat], geom)) continue;
    const idOrCode = getPointCollectionKey(c);
    if (idOrCode) superCameraIds.push(idOrCode);
  }

  for (const c of camerasLpr) {
    const lng = Number(c.lng);
    const lat = Number(c.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (!inBbox(lng, lat)) continue;
    if (!pointInGeometry([lng, lat], geom)) continue;
    const idOrCode = getPointCollectionKey(c);
    if (idOrCode) lprIds.push(idOrCode);
  }

  for (const r of radares) {
    const lng = Number(r.lng);
    const lat = Number(r.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (!inBbox(lng, lat)) continue;
    if (!pointInGeometry([lng, lat], geom)) continue;
    const idOrCodcet = getPointCollectionKey(r);
    if (idOrCodcet) radarIds.push(idOrCodcet);
  }

  return {
    cameras: camerasIds,
    super_cameras: superCameraIds,
    lpr: lprIds,
    radar: radarIds,
  };
}

export function getSecurityAreaFeatureCode(feature: SecurityAreaFeature | null | undefined) {
  if (!feature) return "";
  const raw = (feature.properties as any)?.name;
  if (raw === null || raw === undefined) return "";
  return String(raw).trim();
}

export function geometryToMultiPolygonCoordinates(
  geom: PolygonalGeometry | GeometryCollection
): number[][][][] {
  if (geom.type === "Polygon") return [geom.coordinates];
  if (geom.type === "MultiPolygon") return geom.coordinates;
  return geom.geometries.flatMap((geometry) => {
    if (geometry.type === "Polygon") return [geometry.coordinates];
    if (geometry.type === "MultiPolygon") return geometry.coordinates;
    return [];
  });
}

export function normalizePolygonalGeometry(
  geom: PolygonalGeometry | GeometryCollection | null | undefined
): PolygonalGeometry | null {
  if (!geom) return null;
  const coordinates = geometryToMultiPolygonCoordinates(geom);
  if (!coordinates.length) return null;
  return coordinates.length === 1
    ? { type: "Polygon", coordinates: coordinates[0] }
    : { type: "MultiPolygon", coordinates };
}

export function mergeSecurityAreaFeatures(features: SecurityAreaFeature[]): SecurityAreaFeature | null {
  if (!features.length) return null;
  const [firstFeature] = features;
  const coordinates = features.flatMap((feature) => geometryToMultiPolygonCoordinates(feature.geometry));

  if (!coordinates.length) return null;
  if (coordinates.length === 1) {
    return {
      ...firstFeature,
      geometry: {
        type: "Polygon",
        coordinates: coordinates[0],
      },
    };
  }

  return {
    ...firstFeature,
    geometry: {
      type: "MultiPolygon",
      coordinates,
    },
  };
}

export function extendBboxFromCoords(coords: any, bbox: { minX: number; minY: number; maxX: number; maxY: number }) {
  if (!coords) return;
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    const x = coords[0];
    const y = coords[1];
    if (x < bbox.minX) bbox.minX = x;
    if (y < bbox.minY) bbox.minY = y;
    if (x > bbox.maxX) bbox.maxX = x;
    if (y > bbox.maxY) bbox.maxY = y;
    return;
  }
  for (const c of coords) extendBboxFromCoords(c, bbox);
}

export function getGeometryBbox(geom: Polygon | MultiPolygon) {
  const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  extendBboxFromCoords(geom.coordinates, bbox);
  if (!Number.isFinite(bbox.minX) || !Number.isFinite(bbox.minY)) return null;
  return bbox;
}

export function pointInRing(point: [number, number], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect = yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point: [number, number], polygon: Polygon) {
  const rings = polygon.coordinates;
  if (!rings.length) return false;
  if (!pointInRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(point, rings[i])) return false;
  }
  return true;
}

export function pointInMultiPolygon(point: [number, number], multi: MultiPolygon) {
  for (const poly of multi.coordinates) {
    if (!poly.length) continue;
    if (!pointInRing(point, poly[0])) continue;
    let inHole = false;
    for (let i = 1; i < poly.length; i++) {
      if (pointInRing(point, poly[i])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

export function pointInGeometry(point: [number, number], geom: Polygon | MultiPolygon) {
  return geom.type === "Polygon" ? pointInPolygon(point, geom) : pointInMultiPolygon(point, geom);
}

export function normalizeCodeGeoByName(
  data: FeatureCollection<PolygonalGeometry | GeometryCollection, any>,
  candidates: string[]
): FeatureCollection<PolygonalGeometry, any> {
  return {
    ...data,
    features: data.features
      .map((feature) => {
        const geometry = normalizePolygonalGeometry(feature.geometry);
        if (!geometry) return null;

        const props: any = { ...(feature.properties || {}) };
        for (const key of candidates) {
          const v = Number(props?.[key]);
          if (Number.isFinite(v)) {
            props.name = v;
            break;
          }
        }
        return { ...feature, geometry, properties: props };
      })
      .filter((feature): feature is Feature<PolygonalGeometry, any> => !!feature),
  };
}

export function keepOnlyCodes(
  data: FeatureCollection<Polygon | MultiPolygon, any>,
  allowed: number[]
) {
  const set = new Set(allowed);
  return {
    ...data,
    features: data.features.filter((feature) => {
      const code = Number((feature.properties as any)?.name);
      return Number.isFinite(code) && set.has(code);
    }),
  };
}

export function formatSecurityAreaLabel(kind: SecurityAreaKind, code: string) {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode) return kind.toUpperCase();
    return `${normalizedCode}ª ${kind.toUpperCase()}`;
  }
