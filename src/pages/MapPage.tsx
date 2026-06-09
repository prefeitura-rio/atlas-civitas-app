// src/pages/MapPage.tsx
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import type {
  FeatureCollection,
  Feature,
  Point,
  Polygon,
  MultiPolygon,
  LineString,
  MultiLineString,
  GeometryCollection,
} from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import Swal from "sweetalert2";
import {
  Building2,
  ChevronRight,
  Eye,
  EyeOff,
  MapPinned,
  LogOut,
  Menu,
  PenTool,
  Search,
  Satellite,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "../app/auth";
import { fetchJson, inputStyle } from "./map/shared";
import type { Camera, CameraIntel, CameraLpr, Radar, SmartCameraSessionResponse } from "./map/types";
import {
  canAccessAdminBackoffice,
  canAccessSmartCameraStreaming,
  canAccessStreaming,
  normalizeRole,
} from "./map/roles";
import "./map/map.css";
import prefeituraLogo from "@/assets/prefeitura_icon2.png";
import cameraIcon from "@/assets/camera-icon.png";
import cameraIconSatellite from "@/assets/camera-icon-satellite.png";
import radarIcon from "@/assets/radar-icon.png";
import radarIconSatellite from "@/assets/radar-icon-satellite.png";
import cameraIntelIcon from "@/assets/cameras-inteligentes-icon.png";
import cameraIntelIconSatellite from "@/assets/cameras-inteligentes-icon-satellite.png";
import cameraLprIcon from "@/assets/camera-lpr-icon.png";
import cameraLprIconSatellite from "@/assets/camera-lpr-icon-satellite.png";
import mapPinRed from "@/assets/map-pin-red.svg";
import civitasLogo from "@/assets/civitas_icon.png";
import civitasWhatsappIcon from "@/assets/icons/civitas/whatsapp.svg";
import civitasDownloadIcon from "@/assets/icons/civitas/Icon-1.svg";
import civitasInfoIcon from "@/assets/icons/civitas/Icon.svg";
import civitasDetectionIcon from "@/assets/icons/civitas/motion_sensor_active.svg";
import civitasRadarIcon from "@/assets/icons/civitas/radar.svg";
import civitasJointPlatesIcon from "@/assets/icons/civitas/traffic_jam.svg";
import civitasCorrelatesIcon from "@/assets/icons/civitas/car_crash.svg";
import civitasMediaIcon from "@/assets/icons/civitas/videocam.svg";
import { AdminUsersPanel } from "./map/AdminUsersPanel";
import { AdminOrganizationsPanel } from "./map/AdminOrganizationsPanel";
import { AdminCamerasPanel } from "./map/AdminCamerasPanel";
import { AdminRadaresPanel } from "./map/AdminRadaresPanel";
import { AdminLogsPanel } from "./map/AdminLogsPanel";
import { AdminUsageDashboardPanel } from "./map/AdminUsageDashboardPanel";
import {
  cleanString,
  firstNonEmptyString,
  getPointCollectionCode,
  getPointCollectionIdentifiers,
  getPointCollectionKey,
  getPointCollectionTitle,
} from "./map/shared";


type TabKey = "map" | "profile" | "civitas" | "admin";
type PanelKey = TabKey | null;

type AdminTab = "usage" | "users" | "organizations" | "logs" | "cameras" | "radares";
type ListMode = "cameras" | "inteligentes" | "lpr" | "radares";
type SecurityAreaKind = "risp" | "aisp" | "cisp";
type AreaDrawPolygonPoints = Array<[number, number]>;

const ADMIN_TAB_OPTIONS: Array<{ key: AdminTab; label: string }> = [
  { key: "users", label: "Usuários" },
  { key: "organizations", label: "Organizações" },
  { key: "cameras", label: "Câmeras" },
  { key: "radares", label: "Radares" },
  { key: "usage", label: "Métricas" },
  { key: "logs", label: "Logs" },
];

const REPORT_LAYER_RULES = [
  { feature: "cameras", layer: "cameras" },
  { feature: "cameras_inteligentes", layer: "cameras_inteligentes" },
  { feature: "cameras_lpr", layer: "cameras_lpr" },
  { feature: "radares", layer: "radares" },
] as const;

const LIST_MODE_OPTIONS: Array<{ mode: ListMode; feature: string; label: string }> = [
  { mode: "cameras", feature: "cameras", label: "Câmeras" },
  { mode: "inteligentes", feature: "cameras_inteligentes", label: "Super Câmeras Inteligentes" },
  { mode: "lpr", feature: "cameras_lpr", label: "LPR" },
  { mode: "radares", feature: "radares", label: "Radares" },
];

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.toString() ||
  (import.meta as any).env?.VITE_API_BASE_URL?.toString() ||
  "http://localhost:8000";

const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN?.toString() || "";

type MapBaseStyle = "streets" | "satellite";
type CameraMarkerKind = "camera" | "camera_intel";
const CAMERA_MARKER_ICON_SIZE = 0.9;
const CAMERA_INTEL_MARKER_ICON_SIZE = 0.9;
const CAMERA_LPR_MARKER_ICON_SIZE = 1.1;
const RADAR_MARKER_ICON_SIZE = 1;
const GPS_CONE_LENGTH_METERS = 60;
const GPS_CONE_HALF_ANGLE_DEG = 30;
const GPS_CONE_SEGMENTS = 12;

// base atual + satélite
const MAP_STYLE_DARK = "mapbox://styles/mapbox/dark-v11" as const;
const MAP_STYLE_SATELLITE = "mapbox://styles/mapbox/satellite-streets-v12" as const;
const PAGE_SIZE = 50;
const SMART_CAMERA_PREVIEW_DURATION_SECONDS = 60;
const SMART_CAMERA_STREAM_DURATION_SECONDS = 480;

// IDs fixos
const SOURCES = {
  pois: "src-pois",
  gps: "src-gps",
  search: "src-search",
  selection: "src-selection",
  area_draw: "src-area-draw",
  bairros: "src-bairros",
  bairros_lines: "src-bairros-lines",
  risp: "src-risp",
  aisp: "src-aisp",
  cisp: "src-cisp",
} as const;

const LAYERS = {
  clusters: "lyr-pois-clusters",
  cluster_count: "lyr-pois-cluster-count",
  cameras_points: "lyr-cameras-points",
  cameras_intel_points: "lyr-cameras-intel-points",
  cameras_lpr_points: "lyr-cameras-lpr-points",
  radares_points: "lyr-radares-points",
  gps_cone: "lyr-gps-cone",
  gps_point: "lyr-gps-point",
  gps_accuracy: "lyr-gps-accuracy",
  gps_pulse: "lyr-gps-pulse",
  search_pin: "lyr-search-pin",
  selection_ring: "lyr-selection-ring",
  area_draw_fill: "lyr-area-draw-fill",
  area_draw_line: "lyr-area-draw-line",
  area_draw_points: "lyr-area-draw-points",
  bairros_fill: "lyr-bairros-fill",
  bairros_line: "lyr-bairros-line",
  bairros_selected_fill: "lyr-bairros-selected-fill",
  bairros_selected_line: "lyr-bairros-selected-line",
  risp_fill: "lyr-risp-fill",
  risp_line: "lyr-risp-line",
  risp_selected_fill: "lyr-risp-selected-fill",
  risp_selected_line: "lyr-risp-selected-line",
  aisp_fill: "lyr-aisp-fill",
  aisp_line: "lyr-aisp-line",
  aisp_selected_fill: "lyr-aisp-selected-fill",
  aisp_selected_line: "lyr-aisp-selected-line",
  cisp_fill: "lyr-cisp-fill",
  cisp_line: "lyr-cisp-line",
  cisp_selected_fill: "lyr-cisp-selected-fill",
  cisp_selected_line: "lyr-cisp-selected-line",
  risp_label: "lyr-risp-label",
  aisp_label: "lyr-aisp-label",
  cisp_label: "lyr-cisp-label",
} as const;

const IMAGES = {
  radar: "radar_icon",
  camera_lpr: "camera_lpr_icon",
  search_pin: "search_pin_icon",
} as const;

const CAMERA_MARKER_IMAGE_IDS: Record<MapBaseStyle, Record<CameraMarkerKind, string>> = {
  streets: {
    camera: "camera_icon_streets",
    camera_intel: "camera_intel_icon_streets",
  },
  satellite: {
    camera: "camera_icon_satellite",
    camera_intel: "camera_intel_icon_satellite",
  },
} as const;

const CAMERA_MARKER_IMAGE_SOURCES: Record<MapBaseStyle, Record<CameraMarkerKind, string>> = {
  streets: {
    camera: cameraIcon,
    camera_intel: cameraIntelIcon,
  },
  satellite: {
    camera: cameraIcon,
    camera_intel: cameraIntelIcon,
  },
} as const;

function getCameraMarkerImageId(style: MapBaseStyle, kind: CameraMarkerKind) {
  return CAMERA_MARKER_IMAGE_IDS[style][kind];
}

function getCameraMarkerImageSource(style: MapBaseStyle, kind: CameraMarkerKind) {
  return CAMERA_MARKER_IMAGE_SOURCES[style][kind];
}

const POI_MARKER_IMAGE_SOURCES: Record<MapBaseStyle, { radar: string; camera_lpr: string }> = {
  streets: {
    radar: radarIconSatellite,
    camera_lpr: cameraLprIconSatellite,
  },
  satellite: {
    radar: radarIconSatellite,
    camera_lpr: cameraLprIconSatellite,
  },
} as const;

function getRadarMarkerImageSource(style: MapBaseStyle) {
  return POI_MARKER_IMAGE_SOURCES[style].radar;
}

function getCameraLprMarkerImageSource(style: MapBaseStyle) {
  return POI_MARKER_IMAGE_SOURCES[style].camera_lpr;
}


function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeBearingDegrees(bearing: number) {
  return ((bearing % 360) + 360) % 360;
}

function destinationPoint(lng: number, lat: number, bearingDeg: number, distanceMeters: number): [number, number] {
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

function buildGpsConePolygon(
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

function coerceCoord(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function getLat(value: any) {
  return coerceCoord(value?.lat ?? value?.latitude ?? value?.latitud ?? value?.y);
}

function getLng(value: any) {
  return coerceCoord(value?.lng ?? value?.lon ?? value?.long ?? value?.longitude ?? value?.longitud ?? value?.x);
}

function getLprNeighborhood(value: any) {
  const candidates = [
    value?.neighborhood,
    value?.bairro,
    value?.neighbourhood,
    value?.district,
    value?.bairro_nome,
    value?.bairro_name,
    value?.BAIRRO,
    value?.Bairro,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function isEntityActive(value: any) {
  const raw = value?.status_ativo ?? value?.is_active;

  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (["0", "false", "f", "off", "inativo", "inactive", "desligado"].includes(normalized)) return false;
    if (["1", "true", "t", "on", "ativo", "active", "ligado"].includes(normalized)) return true;
  }

  const status = cleanString(value?.status).toLowerCase();
  if (status.includes("inativo") || status.includes("deslig")) return false;
  if (status.includes("ativo") || status.includes("active") || status.includes("ligado")) return true;

  return true;
}

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeExternalUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function normalizeSessionUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith("/") ? `${API_BASE}${raw}` : raw;
}

function getSmartCameraId(value: any) {
  return cleanString(value?.id);
}

function getSmartCameraExternalId(value: any) {
  return cleanString(value?.external_camera_id);
}

function loadImagePromise(map: mapboxgl.Map, url: string) {
  return new Promise<HTMLImageElement | ImageBitmap>((resolve, reject) => {
    map.loadImage(url, (err, image) => {
      if (err || !image) {
        reject(err || new Error(`Falha ao carregar imagem: ${url}`));
        return;
      }
      resolve(image as any);
    });
  });
}

type BairrosFeature = Feature<Polygon | MultiPolygon, { NOME?: string; nome?: string } & Record<string, any>>;
type BairrosLineFeature = Feature<LineString | MultiLineString, { NOME?: string; nome?: string } & Record<string, any>>;
type SecurityAreaFeature = Feature<Polygon | MultiPolygon, { name?: string | number } & Record<string, any>>;
type GeometryStats = {
  cameras: number;
  inteligentes: number;
  lpr: number;
  radares: number;
};
type GeometrySelectionIds = {
  cameras: string[];
  super_cameras: string[];
  lpr: string[];
  radar: string[];
};
type PolygonalGeometry = Polygon | MultiPolygon;

function closeLinearRing(ring: number[][]) {
  if (!ring.length) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first?.[0] === last?.[0] && first?.[1] === last?.[1]) return ring;
  return [...ring, [...first]];
}

function sameCoordinate(a: number[] | undefined, b: number[] | undefined) {
  if (!a || !b) return false;
  return Math.abs(Number(a[0]) - Number(b[0])) < 1e-10 && Math.abs(Number(a[1]) - Number(b[1])) < 1e-10;
}

function isValidLngLat(position: number[] | undefined): position is number[] {
  return Number.isFinite(Number(position?.[0])) && Number.isFinite(Number(position?.[1]));
}

function splitRingIntoLineStrings(rawRing: number[][]) {
  const ring = rawRing.filter(isValidLngLat);
  if (ring.length < 2) return [];
  return [ring.length >= 3 ? closeLinearRing(ring) : ring];
}

function geometryToLineStrings(geometry: Polygon | MultiPolygon | null | undefined) {
  if (!geometry) return [];
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) => polygon.flatMap((ring) => splitRingIntoLineStrings(ring)));
}

function buildBairrosLineGeoData(
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

function splitRawRingIntoClosedRings(rawRing: number[][]) {
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

function getRingSamplePoint(ring: number[][]): [number, number] | null {
  for (const position of ring) {
    const lng = Number(position?.[0]);
    const lat = Number(position?.[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }
  return null;
}

function getRingSignedArea(ring: number[][]) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const current = ring[i];
    const next = ring[i + 1];
    area += Number(current?.[0]) * Number(next?.[1]) - Number(next?.[0]) * Number(current?.[1]);
  }
  return area / 2;
}

function getRingOrientation(ring: number[][]) {
  const area = getRingSignedArea(ring);
  if (Math.abs(area) < 1e-12) return 0;
  return area > 0 ? 1 : -1;
}

function splitPolygonRingsIntoPolygons(rings: number[][][]) {
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

function normalizeBairroGeometry(geometry: Polygon | MultiPolygon | null | undefined): Polygon | MultiPolygon | null {
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

function mergePolygonalGeometries(geometries: Array<Polygon | MultiPolygon>): Polygon | MultiPolygon | null {
  const coordinates = geometries.flatMap((geometry) => geometryToMultiPolygonCoordinates(geometry));
  if (!coordinates.length) return null;
  return coordinates.length === 1
    ? ({ type: "Polygon", coordinates: coordinates[0] } as Polygon)
    : ({ type: "MultiPolygon", coordinates } as MultiPolygon);
}

function normalizeBairrosGeoData(
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

function getBairroFeatureName(properties: Record<string, any> | null | undefined): string {
  return (
    (typeof properties?.NOME === "string" && properties.NOME.trim()) ||
    (typeof properties?.nome === "string" && properties.nome.trim()) ||
    ""
  );
}

function emptyGeometrySelectionIds(): GeometrySelectionIds {
  return {
    cameras: [],
    super_cameras: [],
    lpr: [],
    radar: [],
  };
}

function buildGeometryStats(
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

function buildGeometrySelectionIds(
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

function getSecurityAreaFeatureCode(feature: SecurityAreaFeature | null | undefined) {
  if (!feature) return "";
  const raw = (feature.properties as any)?.name;
  if (raw === null || raw === undefined) return "";
  return String(raw).trim();
}

function geometryToMultiPolygonCoordinates(
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

function normalizePolygonalGeometry(
  geom: PolygonalGeometry | GeometryCollection | null | undefined
): PolygonalGeometry | null {
  if (!geom) return null;
  const coordinates = geometryToMultiPolygonCoordinates(geom);
  if (!coordinates.length) return null;
  return coordinates.length === 1
    ? { type: "Polygon", coordinates: coordinates[0] }
    : { type: "MultiPolygon", coordinates };
}

function mergeSecurityAreaFeatures(features: SecurityAreaFeature[]): SecurityAreaFeature | null {
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

function extendBboxFromCoords(coords: any, bbox: { minX: number; minY: number; maxX: number; maxY: number }) {
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

function getGeometryBbox(geom: Polygon | MultiPolygon) {
  const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  extendBboxFromCoords(geom.coordinates, bbox);
  if (!Number.isFinite(bbox.minX) || !Number.isFinite(bbox.minY)) return null;
  return bbox;
}

function pointInRing(point: [number, number], ring: number[][]) {
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

function pointInPolygon(point: [number, number], polygon: Polygon) {
  const rings = polygon.coordinates;
  if (!rings.length) return false;
  if (!pointInRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(point, rings[i])) return false;
  }
  return true;
}

function pointInMultiPolygon(point: [number, number], multi: MultiPolygon) {
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

function pointInGeometry(point: [number, number], geom: Polygon | MultiPolygon) {
  return geom.type === "Polygon" ? pointInPolygon(point, geom) : pointInMultiPolygon(point, geom);
}

function normalizeCodeGeoByName(
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

function keepOnlyCodes(
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

function colorForIndex(i: number) {
  const palette = [
    "#22c55e",
    "#3b82f6",
    "#f59e0b",
    "#ef4444",
    "#14b8a6",
    "#8b5cf6",
    "#eab308",
    "#06b6d4",
    "#f97316",
    "#10b981",
    "#a855f7",
    "#84cc16",
  ];
  return palette[i % palette.length];
}

function buildMatchExpr(key: string, values: number[]) {
  if (!values.length) return "rgba(0,0,0,0)";
  const expr: any[] = ["match", ["to-number", ["get", key]]];
  values.forEach((v, i) => {
    expr.push(v, colorForIndex(i));
  });
  expr.push("rgba(0,0,0,0)");
  return expr;
}

function applyCodeColors(
  map: mapboxgl.Map,
  rispExpr: any,
  aispExpr: any,
  cispExpr: any
) {
  if (map.getLayer(LAYERS.risp_fill)) map.setPaintProperty(LAYERS.risp_fill, "fill-color", rispExpr);
  if (map.getLayer(LAYERS.risp_line)) map.setPaintProperty(LAYERS.risp_line, "line-color", rispExpr);
  if (map.getLayer(LAYERS.aisp_fill)) map.setPaintProperty(LAYERS.aisp_fill, "fill-color", aispExpr);
  if (map.getLayer(LAYERS.aisp_line)) map.setPaintProperty(LAYERS.aisp_line, "line-color", aispExpr);
  if (map.getLayer(LAYERS.cisp_fill)) map.setPaintProperty(LAYERS.cisp_fill, "fill-color", cispExpr);
  if (map.getLayer(LAYERS.cisp_line)) map.setPaintProperty(LAYERS.cisp_line, "line-color", cispExpr);
}

async function upsertMapImage(map: mapboxgl.Map, id: string, url: string) {
  const image = await loadImagePromise(map, url);
  if (map.hasImage(id)) {
    map.removeImage(id);
  }
  map.addImage(id, image as any, { pixelRatio: 2 });
}

function camerasToFeatures(list: Camera[]): Feature<Point, any>[] {
  return list.map((c) => {
    const rawStreamingUrl = ((c as any).streaming_url ?? c.stream_url ?? "").toString().trim();
    const streamingUrl = normalizeExternalUrl(rawStreamingUrl);

    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      properties: {
        kind: "camera",
        id: c.id ?? "",
        camera_id: c.id ?? "",
        code: c.code,
        name: c.name,
        zona_camera: (c as any).zona_camera ?? (c as any).zone ?? "",
        sistema_origem: (c as any).sistema_origem ?? "",
        responsavel: (c as any).responsavel ?? "",
        streaming_url: streamingUrl,
        streaming_url_raw: rawStreamingUrl,
        city: c.city,
        uf: c.uf,
        address: c.address || "",
        is_active: c.is_active ? 1 : 0,
      },
    };
  });
}

function camerasIntelToFeatures(list: CameraIntel[]): Feature<Point, any>[] {
  return list.map((c) => {
    const smartId = getSmartCameraId(c);
    const externalCameraId = getSmartCameraExternalId(c);

    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      properties: {
        kind: "camera_intel",
        id: smartId,
        code: c.code,
        name: c.name,
        responsavel: c.responsavel ?? (c as any).responsavel ?? "",
        direction: c.direction ?? "",
        external_camera_id: externalCameraId,
        is_active: c.is_active ? 1 : 0,
      },
    };
  });
}

function camerasLprToFeatures(list: CameraLpr[]): Feature<Point, any>[] {
  return list.map((c) => {
    const title = getPointCollectionTitle(c) || c.name;
    const neighborhood = firstNonEmptyString((c as any).bairro, c.neighborhood, getLprNeighborhood(c));
    const direction = firstNonEmptyString((c as any).sentido, c.direction);
    const lat = Number(c.lat);
    const lng = Number(c.lng);

    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        kind: "camera_lpr",
        id_ponto_coleta: c.id_ponto_coleta ?? "",
        origem_equipamento: c.origem_equipamento ?? "",
        local: (c as any).local ?? title ?? "",
        code: c.code,
        name: c.name,
        bairro: neighborhood,
        neighborhood,
        direction,
        sentido: direction,
        latitude: lat,
        longitude: lng,
        status_ativo: c.status_ativo ?? c.is_active ?? null,
        is_active: c.is_active ? 1 : 0,
      },
    };
  });
}

function radaresToFeatures(list: Radar[]): Feature<Point, any>[] {
  const features: Feature<Point, any>[] = [];

  for (const r of list) {
    const lat = Number(r.lat ?? r.latitude);
    const lng = Number(r.lng ?? r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const active = r.is_active !== false;
    const title = getPointCollectionTitle(r) || r.logradouro || r.localidade || "Radar";

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        kind: "radar",
        id_ponto_coleta: r.id_ponto_coleta ?? "",
        origem_equipamento: r.origem_equipamento ?? "",
        codcet: r.codcet,
        local: (r as any).local ?? title ?? "",
        bairro: r.bairro ?? "",
        logradouro: (r.logradouro ?? r.localidade ?? (r as any).local ?? "") || "",
        localidade: r.localidade ?? "",
        sentido: r.sentido ?? "",
        status: r.status ?? (active ? "ATIVO" : "INATIVO"),
        status_ativo: r.status_ativo ?? active,
        latitude: lat,
        longitude: lng,
        is_active: active ? 1 : 0,
      },
    });
  }

  return features;
}

function makePoisGeoJSON(
  cameras: Camera[],
  camerasIntel: CameraIntel[],
  camerasLpr: CameraLpr[],
  radares: Radar[],
  showCameras: boolean,
  showCamerasIntel: boolean,
  showCamerasLpr: boolean,
  showRadares: boolean
): FeatureCollection<Point, any> {
  const features: Feature<Point, any>[] = [];
  if (showCameras) features.push(...camerasToFeatures(cameras));
  if (showCamerasIntel) features.push(...camerasIntelToFeatures(camerasIntel));
  if (showCamerasLpr) features.push(...camerasLprToFeatures(camerasLpr));
  if (showRadares) features.push(...radaresToFeatures(radares));
  return { type: "FeatureCollection", features };
}

type PoiKind = "camera" | "camera_intel" | "camera_lpr" | "radar";

const POI_KIND_ORDER: PoiKind[] = ["camera_intel", "camera_lpr", "camera", "radar"];

function asPoiKind(value: unknown): PoiKind | null {
  if (value === "camera" || value === "camera_intel" || value === "camera_lpr" || value === "radar") {
    return value;
  }
  return null;
}

const POI_KIND_VISUALS: Record<
  PoiKind,
  {
    accent: string;
    border: string;
    soft: string;
    softStrong: string;
    text: string;
  }
> = {
  camera: {
    accent: "#004881",
    border: "rgba(0, 72, 129, 0.35)",
    soft: "rgba(0, 72, 129, 0.14)",
    softStrong: "rgba(0, 72, 129, 0.18)",
    text: "#004881",
  },
  camera_intel: {
    accent: "#ff00ff",
    border: "rgba(255, 0, 255, 0.35)",
    soft: "rgba(255, 0, 255, 0.14)",
    softStrong: "rgba(255, 0, 255, 0.18)",
    text: "#ff00ff",
  },
  camera_lpr: {
    accent: "#6115f9",
    border: "rgba(97, 21, 249, 0.35)",
    soft: "rgba(97, 21, 249, 0.14)",
    softStrong: "rgba(97, 21, 249, 0.18)",
    text: "#6115f9",
  },
  radar: {
    accent: "#f97316",
    border: "rgba(249, 115, 22, 0.35)",
    soft: "rgba(249, 115, 22, 0.14)",
    softStrong: "rgba(249, 115, 22, 0.18)",
    text: "#f97316",
  },
} as const;

function getPoiVisual(kind: PoiKind) {
  return POI_KIND_VISUALS[kind];
}

function getPoiIconSource(style: MapBaseStyle, kind: PoiKind) {
  if (kind === "camera") return getCameraMarkerImageSource(style, "camera");
  if (kind === "camera_intel") return getCameraMarkerImageSource(style, "camera_intel");
  if (kind === "camera_lpr") return getCameraLprMarkerImageSource(style);
  return getRadarMarkerImageSource(style);
}

function getPoiListIconBubbleStyle(kind: PoiKind): CSSProperties {
  const visual = getPoiVisual(kind);
  return {
    width: 18,
    height: 18,
    borderRadius: 999,
    border: `1px solid ${visual.border}`,
    background: visual.soft,
    display: "grid",
    placeItems: "center",
    flex: "0 0 auto",
  };
}

function getPoiListIconStyle(): CSSProperties {
  return {
    width: 10,
    height: 10,
    objectFit: "contain",
    opacity: 1,
  };
}

function getPoiCodePillStyle(kind: PoiKind, compact = false): CSSProperties {
  const visual = getPoiVisual(kind);
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: compact ? "1px 7px" : "2px 8px",
    fontSize: compact ? 10 : 11,
    fontWeight: 800,
    border: `1px solid ${visual.border}`,
    background: visual.softStrong,
    color: visual.text,
  };
}

function poiCoordKey(lng: number, lat: number) {
  return `${lng.toFixed(6)}|${lat.toFixed(6)}`;
}

function closestPointOnSegment2D(
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

const AREA_DRAW_MIN_VERTEX_DISTANCE_PX = 6;

type AreaDrawInsertCandidate = {
  insertIndex: number;
  projectedPoint: [number, number];
  distanceSq: number;
};

function getAreaDrawInsertCandidates(
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

function getAreaDrawInsertInfo(
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

function areaDrawContainsPoint(points: Array<[number, number]>, target: [number, number]) {
  if (points.length < 3) return false;
  return pointInRing(target, points);
}

function areaDrawIsNearExistingVertex(
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

function getAreaDrawExpandedPoints(
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

function insertAreaDrawPoint(
  points: Array<[number, number]>,
  insertIndex: number,
  nextPoint: [number, number]
) {
  const next = [...points];
  next.splice(insertIndex, 0, nextPoint);
  return next;
}

function replaceAreaDrawPoint(
  points: Array<[number, number]>,
  index: number,
  nextPoint: [number, number]
) {
  return points.map((point, pointIndex) =>
    pointIndex === index ? nextPoint : point
  );
}

function areaDrawOrientation(a: [number, number], b: [number, number], c: [number, number]) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  const epsilon = 1e-12;
  if (Math.abs(value) <= epsilon) return 0;
  return value > 0 ? 1 : 2;
}

function areaDrawOnSegment(a: [number, number], b: [number, number], c: [number, number]) {
  const epsilon = 1e-12;
  return (
    b[0] <= Math.max(a[0], c[0]) + epsilon &&
    b[0] + epsilon >= Math.min(a[0], c[0]) &&
    b[1] <= Math.max(a[1], c[1]) + epsilon &&
    b[1] + epsilon >= Math.min(a[1], c[1])
  );
}

function areaDrawSegmentsIntersect(
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

function areaDrawHasSelfIntersection(points: Array<[number, number]>) {
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

function featureCoordKey(feature: Feature<Point, any>): string | null {
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return poiCoordKey(lng, lat);
}

function makeAreaDrawGeoJSON(
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

export default function MapPage() {
  const auth = useAuth();
  const nav = useNavigate();

  const accessToken =
    auth.accessToken ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("access_token") ||
    "";
  const authLoading = auth.loading;
  const me = auth.user;
  const hasFeature = auth.hasFeature;
  const hasAnyFeature = (...codes: string[]) => codes.some((code) => hasFeature(code));
  const hasAnyFeatureAlias = (...codes: string[]) =>
    codes.some((code) => hasFeature(code) || hasFeature(`${code}_com_extracao_dados`) || hasFeature(`${code}_sem_extracao_dados`));
  const canExtractRispData = hasFeature("risp_com_extracao_dados") || hasFeature("risp");
  const canExtractAispData = hasFeature("aisp_com_extracao_dados") || hasFeature("aisp");
  const canExtractCispData = hasFeature("cisp_com_extracao_dados") || hasFeature("cisp");
  const canExtractSecurityAreaData = (kind: SecurityAreaKind) =>
    (kind === "risp" && canExtractRispData) ||
    (kind === "aisp" && canExtractAispData) ||
    (kind === "cisp" && canExtractCispData);

  const canViewCameras = hasFeature("cameras");
  const canViewCamerasIntel = hasFeature("cameras_inteligentes");
  const canViewCamerasLpr = hasFeature("cameras_lpr");
  const canViewRadares = hasFeature("radares");
  const canViewBairros = hasAnyFeature("bairros_com_extracao_dados", "bairros_sem_extracao_dados");
  const canExtractBairroData = hasFeature("bairros_com_extracao_dados");
  const canViewRisp = hasAnyFeatureAlias("risp");
  const canViewAisp = hasAnyFeatureAlias("aisp");
  const canViewCisp = hasAnyFeatureAlias("cisp");
  const canUseGps = hasFeature("gps");
  const canUseAreaDraw = hasFeature("desenhar_area");
  const authorizedReportLayers = useMemo(
    () =>
      REPORT_LAYER_RULES.filter(({ feature }) => hasFeature(feature)).map(
        ({ layer }) => layer
      ),
    [hasFeature]
  );

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const areaDrawModeRef = useRef(false);
  const areaDrawPointsRef = useRef<Array<[number, number]>>([]);
  const areaDrawPolygonsRef = useRef<AreaDrawPolygonPoints[]>([]);
  const draggingAreaPointIndexRef = useRef<number | null>(null);
  const areaPointDragMovedRef = useRef(false);
  const areaPointDragSnapshotRef = useRef<Array<[number, number]> | null>(null);
  const areaPointDragPanWasEnabledRef = useRef(false);
  const suppressAreaDrawClickRef = useRef(false);
  const showBairrosRef = useRef(false);
  const showRispRef = useRef(false);
  const showAispRef = useRef(false);
  const showCispRef = useRef(false);
  const bairrosGeoRef = useRef<FeatureCollection<Polygon | MultiPolygon, any> | null>(null);
  const rispGeoRef = useRef<FeatureCollection<Polygon | MultiPolygon, any> | null>(null);
  const aispGeoRef = useRef<FeatureCollection<Polygon | MultiPolygon, any> | null>(null);
  const cispGeoRef = useRef<FeatureCollection<Polygon | MultiPolygon, any> | null>(null);
  const hasStreamingAccessRef = useRef(false);
  const hasSmartCameraStreamingAccessRef = useRef(false);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const hoverPreviewPopupRef = useRef<mapboxgl.Popup | null>(null);
  const hoverPreviewAnchorRef = useRef<"top" | "bottom">("bottom");
  const hoverPreviewTimerRef = useRef<number | null>(null);
  const hoverPreviewCloseTimerRef = useRef<number | null>(null);
  const hoverPreviewCountdownTimerRef = useRef<number | null>(null);
  const hoverPreviewGenerationRef = useRef(0);
  const poiCoordIndexRef = useRef<Map<string, Feature<Point, any>[]>>(new Map());
  const suppressHoverHideRef = useRef(false);
  const suppressHoverHideTimerRef = useRef<number | null>(null);
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const unavailableSmartCameraIdsRef = useRef<Record<string, true>>({});
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchSubmittingRef = useRef(false);
  const mobileSearchTouchSubmitAtRef = useRef(0);

  const handlersBoundRef = useRef(false);
  const selectionRingTimerRef = useRef<number | null>(null);
  const syncMapStyleStateRef = useRef<(map: mapboxgl.Map) => void | Promise<void>>(() => {});

  const [panel, setPanel] = useState<PanelKey>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchFocused, setMobileSearchFocused] = useState(false);
  const [unavailableSmartCameraIds, setUnavailableSmartCameraIds] = useState<Record<string, true>>({});
  const [mapBaseStyle, setMapBaseStyle] = useState<MapBaseStyle>(() => {
    if (typeof window === "undefined") return "streets";
    try {
      return window.localStorage.getItem("map_base_style") === "satellite" ? "satellite" : "streets";
    } catch {
      return "streets";
    }
  });
  const mapBaseStyleRef = useRef<MapBaseStyle>(mapBaseStyle);
  const isMobileRef = useRef(false);

  useEffect(() => {
    try {
      window.localStorage.setItem("map_base_style", mapBaseStyle);
    } catch {}
  }, [mapBaseStyle]);

  useEffect(() => {
    mapBaseStyleRef.current = mapBaseStyle;
  }, [mapBaseStyle]);

  const [loadingCameras, setLoadingCameras] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loadingCamerasIntel, setLoadingCamerasIntel] = useState(false);
  const [camerasIntel, setCamerasIntel] = useState<CameraIntel[]>([]);
  const [loadingCamerasLpr, setLoadingCamerasLpr] = useState(false);
  const [camerasLpr, setCamerasLpr] = useState<CameraLpr[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const [loadingRadares, setLoadingRadares] = useState(false);
  const [radares, setRadares] = useState<Radar[]>([]);
  const [selectedRadar, setSelectedRadar] = useState<string | null>(null);

  const [showCameras, setShowCameras] = useState(true);
  const [showCamerasIntel, setShowCamerasIntel] = useState(true);
  const [showCamerasLpr, setShowCamerasLpr] = useState(true);
  const [showRadares, setShowRadares] = useState(true);
  const [showBairros, setShowBairros] = useState(false);
  const [showRisp, setShowRisp] = useState(false);
  const [showAisp, setShowAisp] = useState(false);
  const [showCisp, setShowCisp] = useState(false);

  const activeReportLayers = useMemo(
    () =>
      REPORT_LAYER_RULES.filter(({ feature, layer }) => {
        if (!hasFeature(feature)) return false;
        if (layer === "cameras") return showCameras;
        if (layer === "cameras_inteligentes") return showCamerasIntel;
        if (layer === "cameras_lpr") return showCamerasLpr;
        if (layer === "radares") return showRadares;
        return false;
      }).map(({ layer }) => layer),
    [hasFeature, showCameras, showCamerasIntel, showCamerasLpr, showRadares]
  );
  const hasAuthorizedReportLayers = authorizedReportLayers.length > 0;
  const canRequestBairroReport = canExtractBairroData && activeReportLayers.length > 0;

  const [loadingBairros, setLoadingBairros] = useState(false);
  const [bairrosGeo, setBairrosGeo] = useState<FeatureCollection<Polygon | MultiPolygon, any> | null>(null);
  const [bairrosLinesGeo, setBairrosLinesGeo] = useState<FeatureCollection<LineString | MultiLineString, any> | null>(
    null
  );
  const [bairrosErr, setBairrosErr] = useState<string | null>(null);
  const [rispGeo, setRispGeo] = useState<FeatureCollection<Polygon | MultiPolygon, any> | null>(null);
  const [aispGeo, setAispGeo] = useState<FeatureCollection<Polygon | MultiPolygon, any> | null>(null);
  const [cispGeo, setCispGeo] = useState<FeatureCollection<Polygon | MultiPolygon, any> | null>(null);
  const [selectedBairro, setSelectedBairro] = useState<string>("");
  const [selectedSecurityArea, setSelectedSecurityArea] = useState<{
    kind: SecurityAreaKind;
    code: string;
  } | null>(null);
  const [selectedSecurityStatsState, setSelectedSecurityStatsState] = useState<{
    key: string;
    stats: GeometryStats | null;
  }>({ key: "", stats: null });
  const [selectedSecuritySummaryLoading, setSelectedSecuritySummaryLoading] = useState(false);
  const [bairroQuery, setBairroQuery] = useState<string>("");
  const [bairroReportLoading, setBairroReportLoading] = useState(false);
  const [bairroReportMsg, setBairroReportMsg] = useState<string | null>(null);
  const [securityAreaReportLoading, setSecurityAreaReportLoading] = useState(false);
  const [securityAreaReportMsg, setSecurityAreaReportMsg] = useState<string | null>(null);
  const [areaDrawMode, setAreaDrawMode] = useState(false);
  const [areaToolsOpen, setAreaToolsOpen] = useState(false);
  const [areaDrawPoints, setAreaDrawPoints] = useState<Array<[number, number]>>([]);
  const [areaDrawPolygons, setAreaDrawPolygons] = useState<AreaDrawPolygonPoints[]>([]);
  const [areaReportLoading, setAreaReportLoading] = useState(false);
  const [areaReportMsg, setAreaReportMsg] = useState<string | null>(null);
  const canRequestAreaReport = canUseAreaDraw && activeReportLayers.length > 0;

  function clearSelectedSecurityArea() {
    setSelectedSecurityArea(null);
    setSelectedSecurityStatsState({ key: "", stats: null });
    setSelectedSecuritySummaryLoading(false);
    setSecurityAreaReportMsg(null);
  }

  function selectSecurityArea(area: { kind: SecurityAreaKind; code: string }) {
    setSelectedSecurityArea(area);
    setSelectedSecurityStatsState({ key: "", stats: null });
    setSelectedSecuritySummaryLoading(canExtractSecurityAreaData(area.kind));
    setSecurityAreaReportMsg(null);
    setSelectedBairro("");
    setBairroReportMsg(null);
  }

  useEffect(() => {
    areaDrawModeRef.current = areaDrawMode;
  }, [areaDrawMode]);

  useEffect(() => {
    areaDrawPointsRef.current = areaDrawPoints;
  }, [areaDrawPoints]);

  useEffect(() => {
    areaDrawPolygonsRef.current = areaDrawPolygons;
  }, [areaDrawPolygons]);

  useEffect(() => {
    showBairrosRef.current = showBairros;
  }, [showBairros]);

  useEffect(() => {
    showRispRef.current = showRisp;
  }, [showRisp]);

  useEffect(() => {
    showAispRef.current = showAisp;
  }, [showAisp]);

  useEffect(() => {
    showCispRef.current = showCisp;
  }, [showCisp]);

  useEffect(() => {
    bairrosGeoRef.current = bairrosGeo;
  }, [bairrosGeo]);

  useEffect(() => {
    rispGeoRef.current = rispGeo;
  }, [rispGeo]);

  useEffect(() => {
    aispGeoRef.current = aispGeo;
  }, [aispGeo]);

  useEffect(() => {
    cispGeoRef.current = cispGeo;
  }, [cispGeo]);

  const [listMode, setListMode] = useState<ListMode>("cameras");
  const [query, setQuery] = useState("");
  const [pageCameras, setPageCameras] = useState(1);
  const [pageIntel, setPageIntel] = useState(1);
  const [pageLpr, setPageLpr] = useState(1);
  const [pageRadares, setPageRadares] = useState(1);
  const [pagePulse, setPagePulse] = useState(false);
  const [mobileCountCameras, setMobileCountCameras] = useState(PAGE_SIZE);
  const [mobileCountIntel, setMobileCountIntel] = useState(PAGE_SIZE);
  const [mobileCountLpr, setMobileCountLpr] = useState(PAGE_SIZE);
  const [mobileCountRadares, setMobileCountRadares] = useState(PAGE_SIZE);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const listScrollMobileRef = useRef<HTMLDivElement | null>(null);
  const listScrollAnimFrameRef = useRef<number | null>(null);
  const pagePulseTimerRef = useRef<number | null>(null);

  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [showPwOld, setShowPwOld] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);
  const [showPwNew2, setShowPwNew2] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const [adminTab, setAdminTab] = useState<AdminTab>("users");
  const [adminUsersOrgOpen, setAdminUsersOrgOpen] = useState(false);

  const [gpsErr, setGpsErr] = useState<string | null>(null);
  const [gpsOn, setGpsOn] = useState(false);
  const [gps, setGps] = useState<{
    lng: number;
    lat: number;
    accuracy?: number;
    heading?: number | null;
    speed?: number | null;
    ts?: number;
  } | null>(null);

  const gpsDebugHeading = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("gpsHeading");
    if (raw === null) return null;
    const parsed = Number(raw.trim().replace(",", "."));
    return Number.isFinite(parsed) ? normalizeBearingDegrees(parsed) : null;
  }, []);

  const gpsRef = useRef<typeof gps>(null);
  useEffect(() => {
    gpsRef.current = gps;
  }, [gps]);

  const gpsOnRef = useRef<boolean>(false);
  const gpsPulseTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (selectionRingTimerRef.current) window.clearTimeout(selectionRingTimerRef.current);
    };
  }, []);

  const civitasToolsSummary = [
    {
      tool: "Pontos de Detecção",
      what: "Consultar todas as passagens de uma placa e reconstruir deslocamentos e rotas",
      when: "Quando há placa identificada e é preciso analisar trajetos ou presença em locais específicos",
      result: "Mapa com rotas, tabela cronológica de detecções, agrupamento em viagens e possíveis indícios de clonagem",
    },
    {
      tool: "Busca por Radar",
      what: "Identificar veículos que passaram em determinado local e período",
      when: "Quando não há placa definida, mas há local e horário da ocorrência",
      result: "Lista cronológica de placas detectadas em radar ou conjunto de radares",
    },
    {
      tool: "Placas Conjuntas",
      what: "Identificar veículos que trafegam junto com uma placa monitorada",
      when: "Quando suspeita-se de atuação em conjunto, batedores ou acompanhamento de veículos",
      result: "Lista de placas associadas, ranking de recorrência e frequência de passagens conjuntas",
    },
    {
      tool: "Placas Correlatas",
      what: "Identificar padrões entre diferentes veículos monitorados",
      when: "Investigações com múltiplos veículos ou análise de conexões entre ocorrências",
      result: "Grafo de conexões entre veículos e tabela ordenada por nível de correlação",
    },
    {
      tool: "Imagens e Gravações",
      what: "Solicitação de extração de imagens e/ou trechos de vídeo de câmeras específicas em um período e local",
      when: "Quando há necessidade de análise visual detalhada de um evento em ponto e intervalo de tempo",
      result: "Pacote com registros (imagens/gravações) identificados por câmera, data e horário",
    },
  ] as const;
  const civitasTabLabel = "ACIONAR A CIVITAS";
  const developmentTabLabel = "ADMINISTRADOR";
  const civitasPanelTitle = "Ferramentas da CIVITAS e como solicitar informações";
  const civitasPanelSubtitle = "Acesse os recursos disponíveis e saiba como fazer solicitações formais";
  const civitasContactWhatsappHref = "https://wa.me/5521989091247";
  const civitasContactEmail = "civitas@dados.rio";
  const civitasContactEmailHref = `mailto:${civitasContactEmail}`;
  const civitasModelPdfHref = "/Modelo%20Of%C3%ADcio%20CIVITAS%20-%20JAN26.pdf";
  useEffect(() => {
    gpsOnRef.current = gpsOn;
  }, [gpsOn]);

  useEffect(() => {
    if (gpsPulseTimerRef.current) {
      window.clearInterval(gpsPulseTimerRef.current);
      gpsPulseTimerRef.current = null;
    }

    if (!gpsOn || !gps) {
      const map = mapRef.current;
      if (map && map.isStyleLoaded()) updateGpsData(map, gpsRef.current, gpsOnRef.current, 0);
      return;
    }

    const tick = () => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      const phase = (Date.now() % 1600) / 1600;
      updateGpsData(map, gpsRef.current, gpsOnRef.current, phase);
    };

    tick();
    gpsPulseTimerRef.current = window.setInterval(tick, 80);

    return () => {
      if (gpsPulseTimerRef.current) {
        window.clearInterval(gpsPulseTimerRef.current);
        gpsPulseTimerRef.current = null;
      }
    };
  }, [gpsOn, gps]);

  const [dockOpen, setDockOpen] = useState(true);
  const DOCK_AUTOHIDE_MS = 0;
  const dockTimerRef = useRef<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchPin, setSearchPin] = useState<{ lng: number; lat: number } | null>(null);
  const searchTimerRef = useRef<number | null>(null);
  const panelRef = useRef<PanelKey>(null);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const mapResizeFrameRef = useRef<number | null>(null);
  const civitasScrollRef = useRef<HTMLDivElement | null>(null);
  const civitasScrollThumbRef = useRef<HTMLDivElement | null>(null);
  const civitasScrollRailRef = useRef<HTMLDivElement | null>(null);
  const civitasHeroRef = useRef<HTMLElement | null>(null);
  const suppressNextMapClickRef = useRef(false);
  const suppressMapClickTimerRef = useRef<number | null>(null);

  const syncCivitasScrollThumb = () => {
    const scrollEl = civitasScrollRef.current;
    const thumbEl = civitasScrollThumbRef.current;
    const railEl = civitasScrollRailRef.current;
    const heroEl = civitasHeroRef.current;
    if (!scrollEl || !thumbEl || !railEl) return;

    const panelEl = scrollEl.parentElement;
    if (panelEl && heroEl) {
      const panelRect = panelEl.getBoundingClientRect();
      const heroRect = heroEl.getBoundingClientRect();
      const railTop = Math.max(12, heroRect.bottom - panelRect.top + 6);
      railEl.style.top = `${railTop}px`;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollEl;
    if (heroEl) {
      heroEl.classList.toggle("civitasHero--scrolled", scrollTop > 1);
    }
    const canScroll = scrollHeight > clientHeight + 1;
    if (!canScroll) {
      thumbEl.style.opacity = "0";
      return;
    }

    const railHeight = railEl.clientHeight;
    if (railHeight <= 0) {
      thumbEl.style.opacity = "0";
      return;
    }

    const minThumbPx = 28;
    const thumbHeight = Math.max(minThumbPx, (clientHeight / scrollHeight) * railHeight);
    const maxTop = Math.max(0, railHeight - thumbHeight);
    const progress = scrollTop / Math.max(1, scrollHeight - clientHeight);
    const top = maxTop * progress;

    thumbEl.style.height = `${thumbHeight}px`;
    thumbEl.style.transform = `translateY(${top}px)`;
    thumbEl.style.opacity = "1";
  };

  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);

  useEffect(() => {
    const setViewportHeightVar = () => {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      const offsetTop = vv?.offsetTop ?? 0;
      document.documentElement.style.setProperty("--vvh", `${Math.round(height)}px`);
      document.documentElement.style.setProperty("--vv-offset-top", `${Math.round(offsetTop)}px`);
      const map = mapRef.current;
      if (map) {
        window.requestAnimationFrame(() => map.resize());
      }
    };

    setViewportHeightVar();
    window.addEventListener("resize", setViewportHeightVar);
    window.addEventListener("orientationchange", setViewportHeightVar);
    window.visualViewport?.addEventListener("resize", setViewportHeightVar);
    window.visualViewport?.addEventListener("scroll", setViewportHeightVar);

    return () => {
      window.removeEventListener("resize", setViewportHeightVar);
      window.removeEventListener("orientationchange", setViewportHeightVar);
      window.visualViewport?.removeEventListener("resize", setViewportHeightVar);
      window.visualViewport?.removeEventListener("scroll", setViewportHeightVar);
    };
  }, []);

  useEffect(() => {
    if (panel !== "civitas") return;
    const scrollEl = civitasScrollRef.current;
    if (!scrollEl) return;

    const onScroll = () => syncCivitasScrollThumb();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncCivitasScrollThumb()) : null;
    ro?.observe(scrollEl);

    window.addEventListener("resize", syncCivitasScrollThumb);
    window.requestAnimationFrame(syncCivitasScrollThumb);

    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      window.removeEventListener("resize", syncCivitasScrollThumb);
    };
  }, [panel]);

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const triggerMapResize = () => {
      if (mapResizeFrameRef.current) {
        window.cancelAnimationFrame(mapResizeFrameRef.current);
      }
      mapResizeFrameRef.current = window.requestAnimationFrame(() => {
        mapRef.current?.resize();
        mapResizeFrameRef.current = null;
      });
    };

    const ro = new ResizeObserver(() => triggerMapResize());
    ro.observe(el);
    window.addEventListener("orientationchange", triggerMapResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", triggerMapResize);
      if (mapResizeFrameRef.current) {
        window.cancelAnimationFrame(mapResizeFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hoverPreviewTimerRef.current) {
        window.clearTimeout(hoverPreviewTimerRef.current);
      }
      if (hoverPreviewCloseTimerRef.current) {
        window.clearTimeout(hoverPreviewCloseTimerRef.current);
        hoverPreviewCloseTimerRef.current = null;
      }
      if (suppressHoverHideTimerRef.current) {
        window.clearTimeout(suppressHoverHideTimerRef.current);
        suppressHoverHideTimerRef.current = null;
      }
      hoverPreviewPopupRef.current?.remove();
    };
  }, []);

  function bumpDockAutoHide() {
    if (dockTimerRef.current) window.clearTimeout(dockTimerRef.current);
    if (DOCK_AUTOHIDE_MS <= 0) return;
    dockTimerRef.current = window.setTimeout(() => {
      if (isMobileRef.current) setDockOpen(false);
    }, DOCK_AUTOHIDE_MS);
  }

 

  useEffect(() => {
    if (dockOpen) bumpDockAutoHide();
    return () => {
      if (dockTimerRef.current) window.clearTimeout(dockTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockOpen]);

  const role = normalizeRole(me?.role ?? me?.roles?.[0]);
  const canAccessAdmin = canAccessAdminBackoffice(role);
  const hasStreamingAccess = canAccessStreaming(role);
  const hasSmartCameraStreamingAccess = canAccessSmartCameraStreaming(role);
  const adminTabOptions = useMemo(() => {
    if (role === "manager") {
      return ADMIN_TAB_OPTIONS.filter((option) => option.key === "users" || option.key === "organizations");
    }
    return ADMIN_TAB_OPTIONS;
  }, [role]);
  const activeAdminTab = adminTabOptions.some((option) => option.key === adminTab)
    ? adminTab
    : adminTabOptions[0]?.key ?? "users";
  const availableListModes = useMemo(
    () => LIST_MODE_OPTIONS.filter(({ feature }) => hasFeature(feature)),
    [hasFeature]
  );

  useEffect(() => {
    hasStreamingAccessRef.current = hasStreamingAccess;
  }, [hasStreamingAccess]);

  useEffect(() => {
    hasSmartCameraStreamingAccessRef.current = hasSmartCameraStreamingAccess;
  }, [hasSmartCameraStreamingAccess]);

  useEffect(() => {
    unavailableSmartCameraIdsRef.current = unavailableSmartCameraIds;
  }, [unavailableSmartCameraIds]);

  useEffect(() => {
    if (!availableListModes.length) return;
    if (!availableListModes.some(({ mode }) => mode === listMode)) {
      setListMode(availableListModes[0].mode);
    }
  }, [availableListModes, listMode]);

  useEffect(() => {
    if (!canViewCameras) {
      setShowCameras(false);
      setCameras([]);
    }
  }, [canViewCameras]);

  useEffect(() => {
    if (!canViewCamerasIntel) {
      setShowCamerasIntel(false);
      setCamerasIntel([]);
    }
  }, [canViewCamerasIntel]);

  useEffect(() => {
    if (!canViewCamerasLpr) {
      setShowCamerasLpr(false);
      setCamerasLpr([]);
    }
  }, [canViewCamerasLpr]);

  useEffect(() => {
    if (!canViewRadares) {
      setShowRadares(false);
      setRadares([]);
    }
  }, [canViewRadares]);

  useEffect(() => {
    if (!canViewBairros) {
      setShowBairros(false);
      setSelectedBairro("");
      setBairroQuery("");
      setBairroReportMsg(null);
    }
  }, [canViewBairros]);

  useEffect(() => {
    if (!canViewRisp) setShowRisp(false);
  }, [canViewRisp]);

  useEffect(() => {
    if (!canViewAisp) setShowAisp(false);
  }, [canViewAisp]);

  useEffect(() => {
    if (!canViewCisp) setShowCisp(false);
  }, [canViewCisp]);

  useEffect(() => {
    if (!selectedSecurityArea) return;
    if (selectedSecurityArea.kind === "risp" && showRisp) return;
    if (selectedSecurityArea.kind === "aisp" && showAisp) return;
    if (selectedSecurityArea.kind === "cisp" && showCisp) return;
    clearSelectedSecurityArea();
  }, [selectedSecurityArea, showRisp, showAisp, showCisp]);

  useEffect(() => {
    if (!selectedBairro) return;
    clearSelectedSecurityArea();
  }, [selectedBairro]);

  useEffect(() => {
    if (!selectedSecurityArea) return;
    setSelectedBairro("");
    setBairroReportMsg(null);
  }, [selectedSecurityArea]);

  useEffect(() => {
    if (!canUseGps) {
      setGpsOn(false);
      setGps(null);
      setGpsErr(null);
    }
  }, [canUseGps]);

  useEffect(() => {
    if (!canUseAreaDraw) {
      setAreaDrawMode(false);
      setAreaToolsOpen(false);
      setAreaDrawPoints([]);
      setAreaReportMsg(null);
    }
  }, [canUseAreaDraw]);

  function togglePanel(next: TabKey) {
    setPanel((cur) => (cur === next ? null : next));
  }

  function toggleMobilePanel(next: TabKey) {
    setPanel((cur) => {
      const target = cur === next ? null : next;
      if (target === null) setPanelOpen(false);
      return target;
    });
  }

  useEffect(() => {
    if (panel === "admin" && !canAccessAdmin) setPanel(null);
  }, [panel, canAccessAdmin]);

  useEffect(() => {
    if (panel !== "admin") return;
    if (adminTab === activeAdminTab) return;
    setAdminTab(activeAdminTab);
  }, [panel, adminTab, activeAdminTab]);

  function flyToPoint(lng: number, lat: number, zoom?: number) {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [lng, lat],
      zoom: zoom ?? clamp(map.getZoom(), 16, 18),
      speed: 1.2,
      curve: 1.4,
      essential: true,
    });
  }

  function setSelectionRing(lng: number, lat: number) {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(SOURCES.selection) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng, lat] },
          properties: {},
        },
      ],
    } as any);

    if (selectionRingTimerRef.current) {
      window.clearTimeout(selectionRingTimerRef.current);
    }
    selectionRingTimerRef.current = window.setTimeout(() => {
      const currentMap = mapRef.current;
      if (!currentMap) return;
      const currentSrc = currentMap.getSource(SOURCES.selection) as mapboxgl.GeoJSONSource | undefined;
      if (!currentSrc) return;
      currentSrc.setData({ type: "FeatureCollection", features: [] } as any);
      selectionRingTimerRef.current = null;
    }, 5000);
  }

  function focusOnDetection(lng: number, lat: number, zoom = 17.2) {
    setSelectionRing(lng, lat);
    flyToPoint(lng, lat, zoom);
  }

  function ensureSourcesAndLayers(map: mapboxgl.Map, style: MapBaseStyle = mapBaseStyleRef.current) {
    const cameraImageId = getCameraMarkerImageId(style, "camera");
    const cameraIntelImageId = getCameraMarkerImageId(style, "camera_intel");

    if (!map.getSource(SOURCES.pois)) {
      map.addSource(SOURCES.pois, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 60,
        clusterMaxZoom: 14,
      });
    }

    if (!map.getSource(SOURCES.gps)) {
      map.addSource(SOURCES.gps, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getSource(SOURCES.search)) {
      map.addSource(SOURCES.search, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getSource(SOURCES.selection)) {
      map.addSource(SOURCES.selection, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getSource(SOURCES.area_draw)) {
      map.addSource(SOURCES.area_draw, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getSource(SOURCES.bairros)) {
      map.addSource(SOURCES.bairros, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getSource(SOURCES.bairros_lines)) {
      map.addSource(SOURCES.bairros_lines, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getSource(SOURCES.risp)) {
      map.addSource(SOURCES.risp, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getSource(SOURCES.aisp)) {
      map.addSource(SOURCES.aisp, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getSource(SOURCES.cisp)) {
      map.addSource(SOURCES.cisp, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getLayer(LAYERS.clusters)) {
      map.addLayer({
        id: LAYERS.clusters,
        type: "circle",
        source: SOURCES.pois,
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": ["step", ["get", "point_count"], 18, 50, 24, 200, 30, 1000, 36],
          "circle-color": "rgba(0,0,0,0.85)",
          "circle-opacity": 0.92,
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.18)",
        },
      });
    }

    if (!map.getLayer(LAYERS.gps_cone)) {
      map.addLayer({
        id: LAYERS.gps_cone,
        type: "fill",
        source: SOURCES.gps,
        filter: ["==", ["get", "kind"], "gps_cone"],
        paint: {
          "fill-color": "rgba(34,197,94,0.18)",
          "fill-outline-color": "rgba(34,197,94,0.38)",
        },
      });
    }

    if (!map.getLayer(LAYERS.cluster_count)) {
      map.addLayer({
        id: LAYERS.cluster_count,
        type: "symbol",
        source: SOURCES.pois,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        },
        paint: { "text-color": "#ffffff" },
      });
    }

    if (!map.getLayer(LAYERS.cameras_points)) {
      map.addLayer({
        id: LAYERS.cameras_points,
        type: "symbol",
        source: SOURCES.pois,
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "kind"], "camera"]],
        layout: {
          "icon-image": cameraImageId,
          "icon-size": CAMERA_MARKER_ICON_SIZE,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": 1,
        },
      });
    }

    if (!map.getLayer(LAYERS.cameras_intel_points)) {
      map.addLayer({
        id: LAYERS.cameras_intel_points,
        type: "symbol",
        source: SOURCES.pois,
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "kind"], "camera_intel"]],
        layout: {
          "icon-image": cameraIntelImageId,
          "icon-size": CAMERA_INTEL_MARKER_ICON_SIZE,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": 1,
        },
      });
    }

    if (!map.getLayer(LAYERS.cameras_lpr_points)) {
      map.addLayer({
        id: LAYERS.cameras_lpr_points,
        type: "symbol",
        source: SOURCES.pois,
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "kind"], "camera_lpr"]],
        layout: {
          "icon-image": IMAGES.camera_lpr,
          "icon-size": CAMERA_LPR_MARKER_ICON_SIZE,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": 1,
        },
      });
    }

    if (!map.getLayer(LAYERS.radares_points)) {
      map.addLayer({
        id: LAYERS.radares_points,
        type: "symbol",
        source: SOURCES.pois,
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "kind"], "radar"]],
        layout: {
          "icon-image": IMAGES.radar,
          "icon-size": RADAR_MARKER_ICON_SIZE,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": 1,
        },
      });
    }

    if (!map.getLayer(LAYERS.gps_accuracy)) {
      map.addLayer({
        id: LAYERS.gps_accuracy,
        type: "circle",
        source: SOURCES.gps,
        filter: ["==", ["get", "kind"], "gps_accuracy"],
        paint: {
          "circle-radius": ["get", "r_px"],
          "circle-color": "rgba(34,197,94,0.18)",
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(34,197,94,0.45)",
        },
      });
    }

    if (!map.getLayer(LAYERS.gps_pulse)) {
      map.addLayer({
        id: LAYERS.gps_pulse,
        type: "circle",
        source: SOURCES.gps,
        filter: ["==", ["get", "kind"], "gps_point"],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "pulse"], 0, 14, 1, 40],
          "circle-color": "rgba(34,197,94,0.45)",
          "circle-opacity": ["interpolate", ["linear"], ["get", "pulse"], 0, 0.5, 1, 0],
        },
      });
    }

    if (!map.getLayer(LAYERS.gps_point)) {
      map.addLayer({
        id: LAYERS.gps_point,
        type: "circle",
        source: SOURCES.gps,
        filter: ["==", ["get", "kind"], "gps_point"],
        paint: {
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.95)",
          "circle-color": "#22c55e",
        },
      });
    }

    if (map.hasImage(IMAGES.search_pin) && !map.getLayer(LAYERS.search_pin)) {
      map.addLayer({
        id: LAYERS.search_pin,
        type: "symbol",
        source: SOURCES.search,
        layout: {
          "icon-image": IMAGES.search_pin,
          "icon-size": 0.9,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-anchor": "bottom",
        },
      });
    }

    if (!map.getLayer(LAYERS.selection_ring)) {
      map.addLayer({
        id: LAYERS.selection_ring,
        type: "circle",
        source: SOURCES.selection,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 9, 14, 14, 17, 20, 19, 24],
          "circle-color": "rgba(239,68,68,0.08)",
          "circle-stroke-color": "rgba(220,38,38,0.98)",
          "circle-stroke-width": 2.5,
          "circle-opacity": 1,
        },
      });
    }

    if (!map.getLayer(LAYERS.area_draw_fill)) {
      map.addLayer({
        id: LAYERS.area_draw_fill,
        type: "fill",
        source: SOURCES.area_draw,
        filter: [
          "any",
          ["==", ["get", "kind"], "area_polygon_completed"],
          ["==", ["get", "kind"], "area_polygon_current"],
        ],
        paint: {
          "fill-color": "#38bdf8",
          "fill-opacity": 0.18,
        },
      });
    }

    if (!map.getLayer(LAYERS.area_draw_line)) {
      map.addLayer({
        id: LAYERS.area_draw_line,
        type: "line",
        source: SOURCES.area_draw,
        filter: [
          "any",
          ["==", ["get", "kind"], "area_line_current"],
          ["==", ["get", "kind"], "area_polygon_current"],
          ["==", ["get", "kind"], "area_polygon_completed"],
        ],
        paint: {
          "line-color": "#0ea5e9",
          "line-width": 2.5,
          "line-opacity": 0.95,
        },
      });
    }

    if (!map.getLayer(LAYERS.area_draw_points)) {
      map.addLayer({
        id: LAYERS.area_draw_points,
        type: "circle",
        source: SOURCES.area_draw,
        filter: ["==", ["get", "kind"], "area_point_current"],
        paint: {
          "circle-radius": 6,
          "circle-color": "#e0f2fe",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0284c7",
        },
      });
    }

    for (const layerId of [LAYERS.bairros_line, LAYERS.bairros_selected_line]) {
      const layer = map.getLayer(layerId) as mapboxgl.AnyLayer | undefined;
      if (layer && "source" in layer && layer.source !== SOURCES.bairros_lines) {
        map.removeLayer(layerId);
      }
    }

    if (!map.getLayer(LAYERS.bairros_fill)) {
      map.addLayer({
        id: LAYERS.bairros_fill,
        type: "fill",
        source: SOURCES.bairros,
        paint: {
          "fill-color": "#38bdf8",
          // Mantem a camada clicavel sem esconder o mapa base.
          "fill-opacity": 0.01,
        },
      });
    }

    if (!map.getLayer(LAYERS.bairros_line)) {
      map.addLayer({
        id: LAYERS.bairros_line,
        type: "line",
        source: SOURCES.bairros_lines,
        paint: {
          "line-color": "#38bdf8",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.2, 11, 1.8, 14, 2.6],
          "line-opacity": 0.95,
        },
      });
    }

    if (!map.getLayer(LAYERS.bairros_selected_fill)) {
      map.addLayer({
        id: LAYERS.bairros_selected_fill,
        type: "fill",
        source: SOURCES.bairros,
        filter: ["==", ["get", "NOME"], ""],
        paint: {
          "fill-color": "#ef4444",
          "fill-opacity": 0.04,
        },
      });
    }

    if (!map.getLayer(LAYERS.bairros_selected_line)) {
      map.addLayer({
        id: LAYERS.bairros_selected_line,
        type: "line",
        source: SOURCES.bairros_lines,
        filter: ["==", ["get", "NOME"], ""],
        paint: {
          "line-color": "#dc2626",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2.4, 11, 3.8, 14, 5.2],
          "line-opacity": 1,
          "line-blur": 0.25,
        },
      });
    }

    if (map.getLayer(LAYERS.bairros_fill)) map.setPaintProperty(LAYERS.bairros_fill, "fill-opacity", 0.01);
    if (map.getLayer(LAYERS.bairros_selected_fill)) {
      map.setPaintProperty(LAYERS.bairros_selected_fill, "fill-opacity", 0.04);
    }

    if (!map.getLayer(LAYERS.risp_fill)) {
      map.addLayer({
        id: LAYERS.risp_fill,
        type: "fill",
        source: SOURCES.risp,
        layout: { visibility: "none" },
        filter: ["has", "name"],
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0.28,
        },
      });
    }

    if (!map.getLayer(LAYERS.risp_line)) {
      map.addLayer({
        id: LAYERS.risp_line,
        type: "line",
        source: SOURCES.risp,
        layout: { visibility: "none" },
        filter: ["has", "name"],
        paint: {
          "line-color": "#16a34a",
          "line-width": 2,
          "line-opacity": 0.9,
        },
      });
    }

    if (!map.getLayer(LAYERS.risp_label)) {
      map.addLayer({
        id: LAYERS.risp_label,
        type: "symbol",
        source: SOURCES.risp,
        filter: ["has", "name"],
        layout: {
          visibility: "none",
          "text-field": ["concat", ["to-string", ["get", "name"]], "ª RISP"],
          "text-size": 12,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#111827",
          "text-halo-color": "rgba(255,255,255,0.85)",
          "text-halo-width": 1.2,
        },
      });
    }

    if (!map.getLayer(LAYERS.risp_selected_fill)) {
      map.addLayer({
        id: LAYERS.risp_selected_fill,
        type: "fill",
        source: SOURCES.risp,
        layout: { visibility: "none" },
        filter: ["==", ["to-string", ["get", "name"]], ""],
        paint: {
          "fill-color": "#ef4444",
          "fill-opacity": 0.16,
        },
      });
    }

    if (!map.getLayer(LAYERS.risp_selected_line)) {
      map.addLayer({
        id: LAYERS.risp_selected_line,
        type: "line",
        source: SOURCES.risp,
        layout: { visibility: "none" },
        filter: ["==", ["to-string", ["get", "name"]], ""],
        paint: {
          "line-color": "#b91c1c",
          "line-width": 3.5,
          "line-opacity": 1,
        },
      });
    }

    if (!map.getLayer(LAYERS.aisp_fill)) {
      map.addLayer({
        id: LAYERS.aisp_fill,
        type: "fill",
        source: SOURCES.aisp,
        layout: { visibility: "none" },
        filter: ["has", "name"],
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": 0.28,
        },
      });
    }

    if (!map.getLayer(LAYERS.aisp_line)) {
      map.addLayer({
        id: LAYERS.aisp_line,
        type: "line",
        source: SOURCES.aisp,
        layout: { visibility: "none" },
        filter: ["has", "name"],
        paint: {
          "line-color": "#2563eb",
          "line-width": 2,
          "line-opacity": 0.9,
        },
      });
    }

    if (!map.getLayer(LAYERS.aisp_label)) {
      map.addLayer({
        id: LAYERS.aisp_label,
        type: "symbol",
        source: SOURCES.aisp,
        filter: ["has", "name"],
        layout: {
          visibility: "none",
          "text-field": ["concat", ["to-string", ["get", "name"]], "ª AISP"],
          "text-size": 12,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#111827",
          "text-halo-color": "rgba(255,255,255,0.85)",
          "text-halo-width": 1.2,
        },
      });
    }

    if (!map.getLayer(LAYERS.aisp_selected_fill)) {
      map.addLayer({
        id: LAYERS.aisp_selected_fill,
        type: "fill",
        source: SOURCES.aisp,
        layout: { visibility: "none" },
        filter: ["==", ["to-string", ["get", "name"]], ""],
        paint: {
          "fill-color": "#ef4444",
          "fill-opacity": 0.16,
        },
      });
    }

    if (!map.getLayer(LAYERS.aisp_selected_line)) {
      map.addLayer({
        id: LAYERS.aisp_selected_line,
        type: "line",
        source: SOURCES.aisp,
        layout: { visibility: "none" },
        filter: ["==", ["to-string", ["get", "name"]], ""],
        paint: {
          "line-color": "#b91c1c",
          "line-width": 3.5,
          "line-opacity": 1,
        },
      });
    }

    if (!map.getLayer(LAYERS.cisp_fill)) {
      map.addLayer({
        id: LAYERS.cisp_fill,
        type: "fill",
        source: SOURCES.cisp,
        layout: { visibility: "none" },
        filter: ["has", "name"],
        paint: {
          "fill-color": "#f59e0b",
          "fill-opacity": 0.28,
        },
      });
    }

    if (!map.getLayer(LAYERS.cisp_selected_fill)) {
      map.addLayer({
        id: LAYERS.cisp_selected_fill,
        type: "fill",
        source: SOURCES.cisp,
        layout: { visibility: "none" },
        filter: ["==", ["to-string", ["get", "name"]], ""],
        paint: {
          "fill-color": "#ef4444",
          "fill-opacity": 0.16,
        },
      });
    }

    if (!map.getLayer(LAYERS.cisp_selected_line)) {
      map.addLayer({
        id: LAYERS.cisp_selected_line,
        type: "line",
        source: SOURCES.cisp,
        layout: { visibility: "none" },
        filter: ["==", ["to-string", ["get", "name"]], ""],
        paint: {
          "line-color": "#b91c1c",
          "line-width": 3.5,
          "line-opacity": 1,
        },
      });
    }

    if (!map.getLayer(LAYERS.cisp_line)) {
      map.addLayer({
        id: LAYERS.cisp_line,
        type: "line",
        source: SOURCES.cisp,
        layout: { visibility: "none" },
        filter: ["has", "name"],
        paint: {
          "line-color": "#d97706",
          "line-width": 2,
          "line-opacity": 0.9,
        },
      });
    }

    if (!map.getLayer(LAYERS.cisp_label)) {
      map.addLayer({
        id: LAYERS.cisp_label,
        type: "symbol",
        source: SOURCES.cisp,
        filter: ["has", "name"],
        layout: {
          visibility: "none",
          "text-field": ["concat", ["to-string", ["get", "name"]], "ª CISP"],
          "text-size": 12,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#111827",
          "text-halo-color": "rgba(255,255,255,0.85)",
          "text-halo-width": 1.2,
        },
      });
    }

    applyCodeColors(map, rispColorExpr, aispColorExpr, cispColorExpr);

    for (const id of [
      LAYERS.bairros_fill,
      LAYERS.bairros_line,
      LAYERS.bairros_selected_fill,
      LAYERS.bairros_selected_line,
    ]) {
      if (map.getLayer(id)) {
        try {
          map.moveLayer(id);
        } catch {}
      }
    }

    // Garante que pontos e o cone do GPS fiquem acima dos bairros
    const aboveBairros = [
      LAYERS.clusters,
      LAYERS.cluster_count,
      LAYERS.cameras_points,
      LAYERS.cameras_intel_points,
      LAYERS.cameras_lpr_points,
      LAYERS.radares_points,
      LAYERS.search_pin,
      LAYERS.selection_ring,
      LAYERS.area_draw_fill,
      LAYERS.area_draw_line,
      LAYERS.area_draw_points,
      LAYERS.gps_cone,
      LAYERS.gps_accuracy,
      LAYERS.gps_pulse,
      LAYERS.gps_point,
    ];
    for (const id of aboveBairros) {
      if (map.getLayer(id)) {
        try {
          map.moveLayer(id);
        } catch {}
      }
    }
  }

  function updatePoisData(map: mapboxgl.Map, geo: FeatureCollection<Point, any>) {
    const src: any = map.getSource(SOURCES.pois);
    if (src && typeof src.setData === "function") src.setData(geo);
  }

  function updateSearchPin(map: mapboxgl.Map, pin: { lng: number; lat: number } | null) {
    if (!pin) {
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;
      return;
    }

    if (!searchMarkerRef.current) {
      const el = document.createElement("img");
      el.src = mapPinRed;
      el.alt = "Pin";
      el.style.width = "28px";
      el.style.height = "28px";
      el.style.transform = "translateY(-6px)";
      searchMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([pin.lng, pin.lat]).addTo(map);
    } else {
      searchMarkerRef.current.setLngLat([pin.lng, pin.lat]);
    }
  }

  function updateAreaDrawData(
    map: mapboxgl.Map,
    polygons: AreaDrawPolygonPoints[],
    currentPoints: AreaDrawPolygonPoints
  ) {
    const src: any = map.getSource(SOURCES.area_draw);
    if (!src || typeof src.setData !== "function") return;
    src.setData(makeAreaDrawGeoJSON(polygons, currentPoints));
  }

  function updateBairrosData(
    map: mapboxgl.Map,
    data: FeatureCollection<Polygon | MultiPolygon, any>
  ) {
    const src: any = map.getSource(SOURCES.bairros);
    if (src && typeof src.setData === "function") src.setData(data);
  }

  function updateBairrosLineData(
    map: mapboxgl.Map,
    data: FeatureCollection<LineString | MultiLineString, any>
  ) {
    const src: any = map.getSource(SOURCES.bairros_lines);
    if (src && typeof src.setData === "function") src.setData(data);
  }

  function updateRispData(
    map: mapboxgl.Map,
    data: FeatureCollection<Polygon | MultiPolygon, any>
  ) {
    const src: any = map.getSource(SOURCES.risp);
    if (src && typeof src.setData === "function") src.setData(data);
  }

  function updateAispData(
    map: mapboxgl.Map,
    data: FeatureCollection<Polygon | MultiPolygon, any>
  ) {
    const src: any = map.getSource(SOURCES.aisp);
    if (src && typeof src.setData === "function") src.setData(data);
  }

  function updateCispData(
    map: mapboxgl.Map,
    data: FeatureCollection<Polygon | MultiPolygon, any>
  ) {
    const src: any = map.getSource(SOURCES.cisp);
    if (src && typeof src.setData === "function") src.setData(data);
  }

  function applyBairrosVisibility(map: mapboxgl.Map, visible: boolean, selected: string) {
    const baseVisibility = visible ? "visible" : "none";
    if (map.getLayer(LAYERS.bairros_fill)) map.setLayoutProperty(LAYERS.bairros_fill, "visibility", baseVisibility);
    if (map.getLayer(LAYERS.bairros_line)) map.setLayoutProperty(LAYERS.bairros_line, "visibility", baseVisibility);

    const hasSelected = visible && !!selected;
    const selectedVisibility = hasSelected ? "visible" : "none";
    if (map.getLayer(LAYERS.bairros_selected_fill)) {
      map.setLayoutProperty(LAYERS.bairros_selected_fill, "visibility", selectedVisibility);
    }
    if (map.getLayer(LAYERS.bairros_selected_line)) {
      map.setLayoutProperty(LAYERS.bairros_selected_line, "visibility", selectedVisibility);
    }

    const filter = selected ? ["==", ["get", "NOME"], selected] : ["==", ["get", "NOME"], ""];
    if (map.getLayer(LAYERS.bairros_selected_fill)) map.setFilter(LAYERS.bairros_selected_fill, filter as any);
    if (map.getLayer(LAYERS.bairros_selected_line)) map.setFilter(LAYERS.bairros_selected_line, filter as any);
  }

  function applyCodeVisibility(
    map: mapboxgl.Map,
    visible: boolean,
    fillId: string,
    lineId: string,
    labelId?: string,
    selectedFillId?: string,
    selectedLineId?: string,
    selectedCode?: string
  ) {
    const v = visible ? "visible" : "none";
    if (map.getLayer(fillId)) map.setLayoutProperty(fillId, "visibility", v);
    if (map.getLayer(lineId)) map.setLayoutProperty(lineId, "visibility", v);
    if (labelId && map.getLayer(labelId)) map.setLayoutProperty(labelId, "visibility", v);

    const selectedVisibility = visible && selectedCode ? "visible" : "none";
    const selectedFilter = selectedCode
      ? ["==", ["to-string", ["get", "name"]], selectedCode]
      : ["==", ["to-string", ["get", "name"]], ""];

    if (selectedFillId && map.getLayer(selectedFillId)) {
      map.setLayoutProperty(selectedFillId, "visibility", selectedVisibility);
      map.setFilter(selectedFillId, selectedFilter as any);
    }
    if (selectedLineId && map.getLayer(selectedLineId)) {
      map.setLayoutProperty(selectedLineId, "visibility", selectedVisibility);
      map.setFilter(selectedLineId, selectedFilter as any);
    }
  }

  async function syncMapStyleState(map: mapboxgl.Map) {
    const currentStyle = mapBaseStyleRef.current;
    try {
      const cameraImageId = getCameraMarkerImageId(currentStyle, "camera");
      const cameraIntelImageId = getCameraMarkerImageId(currentStyle, "camera_intel");
      const cameraImageSrc = getCameraMarkerImageSource(currentStyle, "camera");
      const cameraIntelImageSrc = getCameraMarkerImageSource(currentStyle, "camera_intel");
      const radarImageSrc = getRadarMarkerImageSource(currentStyle);
      const cameraLprImageSrc = getCameraLprMarkerImageSource(currentStyle);
      await Promise.all([
        upsertMapImage(map, cameraImageId, cameraImageSrc),
        upsertMapImage(map, cameraIntelImageId, cameraIntelImageSrc),
        upsertMapImage(map, IMAGES.radar, radarImageSrc),
        upsertMapImage(map, IMAGES.camera_lpr, cameraLprImageSrc),
        upsertMapImage(map, IMAGES.search_pin, mapPinRed),
      ]);
    } catch (e) {
      console.warn("Falha ao carregar ícones do mapa:", e);
    }

    ensureSourcesAndLayers(map, currentStyle);
    bindInteractionsOnce(map);

    updatePoisData(map, poisGeo);
    if (bairrosGeo) updateBairrosData(map, bairrosGeo);
    if (bairrosLinesGeo) updateBairrosLineData(map, bairrosLinesGeo);
    if (rispGeo) updateRispData(map, rispGeo);
    if (aispGeo) updateAispData(map, aispGeo);
    if (cispGeo) updateCispData(map, cispGeo);

    applyBairrosVisibility(map, showBairros, selectedBairro);
    applyCodeVisibility(
      map,
      showRisp,
      LAYERS.risp_fill,
      LAYERS.risp_line,
      LAYERS.risp_label,
      LAYERS.risp_selected_fill,
      LAYERS.risp_selected_line,
      selectedSecurityArea?.kind === "risp" ? selectedSecurityArea.code : ""
    );
    applyCodeVisibility(
      map,
      showAisp,
      LAYERS.aisp_fill,
      LAYERS.aisp_line,
      LAYERS.aisp_label,
      LAYERS.aisp_selected_fill,
      LAYERS.aisp_selected_line,
      selectedSecurityArea?.kind === "aisp" ? selectedSecurityArea.code : ""
    );
    applyCodeVisibility(
      map,
      showCisp,
      LAYERS.cisp_fill,
      LAYERS.cisp_line,
      LAYERS.cisp_label,
      LAYERS.cisp_selected_fill,
      LAYERS.cisp_selected_line,
      selectedSecurityArea?.kind === "cisp" ? selectedSecurityArea.code : ""
    );

    updateGpsData(map, gps, gpsOnRef.current);
    updateSearchPin(map, searchPin);
    updateAreaDrawData(map, areaDrawPolygonsRef.current, areaDrawPointsRef.current);
    applyCodeColors(map, rispColorExpr, aispColorExpr, cispColorExpr);
  }

  syncMapStyleStateRef.current = syncMapStyleState;

  function switchMapBaseStyle(next: MapBaseStyle) {
    if (mapBaseStyleRef.current === next) return;
    mapBaseStyleRef.current = next;
    setMapBaseStyle(next);
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(next === "satellite" ? MAP_STYLE_SATELLITE : MAP_STYLE_DARK);
  }

  function metersToPixelsAtLat(meters: number, lat: number, zoom: number) {
    const metersPerPixel =
      (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
    return meters / Math.max(0.000001, metersPerPixel);
  }

  function updateGpsData(
    map: mapboxgl.Map,
    gpsData: typeof gps | null,
    isOn: boolean,
    pulse = 0
  ) {
    const src: any = map.getSource(SOURCES.gps);
    if (!src || typeof src.setData !== "function") return;

    if (!isOn || !gpsData) {
      src.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const zoom = map.getZoom();
    const acc = Number(gpsData.accuracy ?? 0);
    const rPx = acc > 0 ? metersToPixelsAtLat(acc, gpsData.lat, zoom) : 0;

    const features: Array<Feature<Point | Polygon, any>> = [];

    const headingValue = gpsDebugHeading ?? gpsData.heading;
    const heading = typeof headingValue === "number" && Number.isFinite(headingValue) ? headingValue : null;

    if (heading !== null) {
      features.push({
        type: "Feature",
        geometry: buildGpsConePolygon(gpsData.lng, gpsData.lat, heading),
        properties: { kind: "gps_cone" },
      });
    }

    if (rPx > 0) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [gpsData.lng, gpsData.lat] },
        properties: { kind: "gps_accuracy", r_px: clamp(rPx, 8, 160) },
      });
    }

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [gpsData.lng, gpsData.lat] },
      properties: { kind: "gps_point", pulse },
    });

    src.setData({ type: "FeatureCollection", features });
  }

  function bindInteractionsOnce(map: mapboxgl.Map) {
    if (handlersBoundRef.current) return;
    handlersBoundRef.current = true;

    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({
        offset: 12,
        closeButton: false,
        closeOnClick: false,
        closeOnMove: false,
        maxWidth: "360px",
      });
    }
    const popup = popupRef.current;

    function ensureHoverPreviewPopup(anchor: "top" | "bottom") {
      if (hoverPreviewPopupRef.current && hoverPreviewAnchorRef.current === anchor) {
        return hoverPreviewPopupRef.current;
      }
      hoverPreviewPopupRef.current?.remove();
      hoverPreviewPopupRef.current = new mapboxgl.Popup({
        offset: 14,
        closeButton: false,
        closeOnClick: false,
        className: "cameraHoverPreviewPopup",
        anchor,
      });
      hoverPreviewAnchorRef.current = anchor;
      return hoverPreviewPopupRef.current;
    }

    function clearHoverPreviewTimer() {
      if (!hoverPreviewTimerRef.current) return;
      window.clearTimeout(hoverPreviewTimerRef.current);
      hoverPreviewTimerRef.current = null;
    }

    function clearHoverPreviewCloseTimer() {
      if (!hoverPreviewCloseTimerRef.current) return;
      window.clearTimeout(hoverPreviewCloseTimerRef.current);
      hoverPreviewCloseTimerRef.current = null;
    }

    function clearHoverPreviewCountdownTimer() {
      if (!hoverPreviewCountdownTimerRef.current) return;
      window.clearInterval(hoverPreviewCountdownTimerRef.current);
      hoverPreviewCountdownTimerRef.current = null;
    }

    function startSmartCameraPreviewCountdown(generation: number, durationSeconds: number) {
      clearHoverPreviewCountdownTimer();
      const endsAt = Date.now() + durationSeconds * 1000;

      const updateCountdown = () => {
        if (generation !== hoverPreviewGenerationRef.current) {
          clearHoverPreviewCountdownTimer();
          return;
        }

        const remaining = clamp(Math.ceil((endsAt - Date.now()) / 1000), 0, durationSeconds);
        const countdownEl = hoverPreviewPopupRef.current
          ?.getElement()
          ?.querySelector<HTMLElement>("[data-smart-preview-countdown]");
        if (countdownEl) countdownEl.textContent = `${remaining}s`;
        if (remaining <= 0) clearHoverPreviewCountdownTimer();
      };

      updateCountdown();
      hoverPreviewCountdownTimerRef.current = window.setInterval(updateCountdown, 1000);
    }

    function hideHoverPreview() {
      if (suppressHoverHideRef.current && hoverPreviewPopupRef.current?.isOpen()) return;
      hoverPreviewGenerationRef.current += 1;
      clearHoverPreviewTimer();
      clearHoverPreviewCloseTimer();
      clearHoverPreviewCountdownTimer();
      hoverPreviewPopupRef.current?.remove();
    }

    function bindPopupCloseButton() {
      if (!popup?.isOpen()) return;
      const btn = popup.getElement()?.querySelector<HTMLButtonElement>("[data-popup-close]");
      if (!btn) return;
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        popup.remove();
      };
    }

    function bindSmartCameraPopupActions() {
      if (!popup?.isOpen()) return;
      const popupEl = popup.getElement();
      if (!popupEl) return;

      popupEl.querySelectorAll<HTMLButtonElement>("[data-smart-camera-stream]").forEach((btn) => {
        btn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const duration = Number(btn.dataset.smartCameraDuration || SMART_CAMERA_STREAM_DURATION_SECONDS);
          void openSmartCameraStreamWindow(
            {
              id: btn.dataset.smartCameraId || "",
              external_camera_id: btn.dataset.smartCameraExternalCameraId || "",
            },
            Number.isFinite(duration) ? duration : SMART_CAMERA_STREAM_DURATION_SECONDS
          );
        };
      });

      popupEl.querySelectorAll<HTMLButtonElement>("[data-camera-stream]").forEach((btn) => {
        btn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const duration = Number(btn.dataset.cameraDuration || 0);
          void openCommonCameraStreamWindow(btn.dataset.cameraId || "", Number.isFinite(duration) ? duration : 0);
        };
      });
    }

    function centerMobilePopup(target?: mapboxgl.Popup | null) {
      const activePopup = target ?? popup;
      if (!isMobileRef.current || !activePopup?.isOpen()) return;
      const popupEl = activePopup.getElement();
      const mapEl = map.getContainer();
      if (!popupEl || !mapEl) return;

      const isHoverPreview = popupEl.classList.contains("cameraHoverPreviewPopup");

      const run = () => {
        const popupRect = popupEl.getBoundingClientRect();
        const mapRect = mapEl.getBoundingClientRect();
        const popupCenterX = popupRect.left + popupRect.width / 2;
        const popupCenterY = popupRect.top + popupRect.height / 2;
        const mapCenterX = mapRect.left + mapRect.width / 2;
        const mapCenterY = mapRect.top + mapRect.height / 2;
        const dx = popupCenterX - mapCenterX;
        const dy = popupCenterY - mapCenterY;

        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        if (isHoverPreview) {
          suppressHoverHideRef.current = true;
          if (suppressHoverHideTimerRef.current) {
            window.clearTimeout(suppressHoverHideTimerRef.current);
          }
          suppressHoverHideTimerRef.current = window.setTimeout(() => {
            suppressHoverHideRef.current = false;
            suppressHoverHideTimerRef.current = null;
          }, 600);
          map.once("moveend", () => {
            suppressHoverHideRef.current = false;
            if (suppressHoverHideTimerRef.current) {
              window.clearTimeout(suppressHoverHideTimerRef.current);
              suppressHoverHideTimerRef.current = null;
            }
          });
        }
        map.panBy([dx, dy], { duration: 240 });
      };

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(run);
      });
    }

    function keepMobileStreamingPopupOpen() {
      if (!hasStreamingAccessRef.current) return false;
      if (!isMobileRef.current || !popup?.isOpen()) return false;
      const popupEl = popup.getElement();
      return Boolean(popupEl?.querySelector(".cameraPopupStreamLink"));
    }

    function getPoiInfo(feature: Feature<Point, any>) {
      const p = feature.properties || {};
      const kind = asPoiKind(p.kind);

      if (kind === "camera") {
        return {
          kind,
          cameraId: cleanString(p.camera_id || p.id),
          title: (p.name || "Câmera sem nome").toString(),
          meta: `Zona: ${(p.zona_camera || "-").toString()}`,
          streamingUrl: normalizeExternalUrl((p.streaming_url || p.stream_url || "").toString()),
        };
      }
      if (kind === "camera_intel") {
        return {
          kind,
          title: (p.name || "Super Câmera Inteligente").toString(),
          meta: `Responsável: ${(p.responsavel || "-").toString()}`,
          smartId: cleanString(p.id),
          externalCameraId: cleanString(p.external_camera_id),
        };
      }
      if (kind === "camera_lpr") {
        return {
          kind,
          title: (getPointCollectionTitle(p) || p.name || "Câmera LPR").toString(),
          meta: `Bairro: ${firstNonEmptyString(p.bairro, p.neighborhood, "-")} • Sentido: ${firstNonEmptyString(
            p.sentido,
            p.direction,
            "-"
          )}`,
          streamingUrl: "",
        };
      }
      if (kind === "radar") {
        return {
          kind,
          title: (getPointCollectionTitle(p) || p.logradouro || "Radar sem logradouro").toString(),
          meta: `Bairro: ${firstNonEmptyString(p.bairro, "-")} • Sentido: ${firstNonEmptyString(
            p.sentido,
            "-"
          )}`,
          streamingUrl: "",
        };
      }
      return null;
    }

    function openStackedPopupIfNeeded(coords: [number, number]) {
      const key = poiCoordKey(Number(coords[0]), Number(coords[1]));
      const stack = (poiCoordIndexRef.current.get(key) || []).slice();
      if (stack.length <= 1) return false;

      const kindLabel: Record<PoiKind, string> = {
        camera: "Câmera",
        camera_intel: "Super Câmera Inteligente",
        camera_lpr: "LPR",
        radar: "Radar",
      };
      const kindChipClass: Record<PoiKind, string> = {
        camera: "stackPopupChip--camera",
        camera_intel: "stackPopupChip--intel",
        camera_lpr: "stackPopupChip--lpr",
        radar: "stackPopupChip--radar",
      };
      const kindItemClass: Record<PoiKind, string> = {
        camera: "stackPopupTag--camera",
        camera_intel: "stackPopupTag--intel",
        camera_lpr: "stackPopupTag--lpr",
        radar: "stackPopupTag--radar",
      };
      const kindItemCardClass: Record<PoiKind, string> = {
        camera: "stackPopupItem--camera",
        camera_intel: "stackPopupItem--intel",
        camera_lpr: "stackPopupItem--lpr",
        radar: "stackPopupItem--radar",
      };
      const kindCodeClass: Record<PoiKind, string> = {
        camera: "stackPopupCode--camera",
        camera_intel: "stackPopupCode--intel",
        camera_lpr: "stackPopupCode--lpr",
        radar: "stackPopupCode--radar",
      };

      stack.sort((a, b) => {
        const aKind = asPoiKind(a.properties?.kind);
        const bKind = asPoiKind(b.properties?.kind);
        const aWeight = aKind ? POI_KIND_ORDER.indexOf(aKind) : 999;
        const bWeight = bKind ? POI_KIND_ORDER.indexOf(bKind) : 999;
        if (aWeight !== bWeight) return aWeight - bWeight;
        const aCode = getPointCollectionCode(a.properties) || "";
        const bCode = getPointCollectionCode(b.properties) || "";
        return String(aCode).localeCompare(String(bCode), "pt-BR", { numeric: true });
      });

      const counts: Record<PoiKind, number> = {
        camera: 0,
        camera_intel: 0,
        camera_lpr: 0,
        radar: 0,
      };

      for (const feature of stack) {
        const kind = asPoiKind(feature.properties?.kind);
        if (kind) counts[kind] += 1;
      }

      const chipsHtml = POI_KIND_ORDER
        .filter((kind) => counts[kind] > 0)
        .map(
          (kind) =>
            `<span class="stackPopupChip ${kindChipClass[kind]}">${escapeHtml(kindLabel[kind])}: ${counts[kind]}</span>`
        )
        .join("");

      const itemsHtml = stack
        .map((feature) => {
          const info = getPoiInfo(feature);
          if (!info || !info.kind) return "";
          const p = feature.properties || {};
          const code = getPointCollectionCode(p) || "-";
          const visual = getPoiVisual(info.kind);
          const iconSrc = getPoiIconSource(mapBaseStyleRef.current, info.kind);
          const streamLink =
            info.kind === "camera_intel"
              ? hasSmartCameraStreamingAccessRef.current && info.smartId && !isSmartCameraStreamingUnavailable(info.smartId)
                ? `<button type="button" class="cameraPopupStreamLink stackPopupStreamLink cameraPopupStreamLink--soft" data-smart-camera-stream data-smart-camera-id="${escapeHtml(
                    info.smartId
                  )}" data-smart-camera-external-camera-id="${escapeHtml(
                    info.externalCameraId || ""
                  )}" data-smart-camera-duration="480" title="Abrir streaming completo">Abrir streaming</button>`
                : ""
              : hasStreamingAccessRef.current && info.streamingUrl && info.cameraId
              ? `<button type="button" class="cameraPopupStreamLink stackPopupStreamLink" data-camera-stream data-camera-id="${escapeHtml(
                  info.cameraId
                )}" data-camera-duration="0">Streaming</button>`
              : "";

          return `
            <div class="stackPopupItem ${kindItemCardClass[info.kind]}">
              <div class="stackPopupItemHead">
                <div class="stackPopupItemHeadLeft">
                  <span
                    class="stackPopupItemIcon"
                    style="border-color:${escapeHtml(visual.border)};background:${escapeHtml(visual.soft)};"
                  >
                    <img src="${escapeHtml(iconSrc)}" alt="" class="stackPopupItemIconImg" />
                  </span>
                  <span class="stackPopupTag ${kindItemClass[info.kind]}">${escapeHtml(kindLabel[info.kind])}</span>
                </div>
                <span class="stackPopupCode ${kindCodeClass[info.kind]}">${escapeHtml(String(code || "-"))}</span>
              </div>
              <div class="stackPopupTitle">${escapeHtml(info.title)}</div>
              <div class="stackPopupMeta">${escapeHtml(info.meta)}</div>
              ${streamLink}
            </div>
          `;
        })
        .join("");

      setSelectedCode(null);
      setSelectedRadar(null);
      setPanelOpen(false);

      popup
        ?.setLngLat(coords)
        .setHTML(`
          <div class="cameraPopup cameraPopup--stack">
            <div class="stackPopupHead">
              <div class="stackPopupHeadRow">
                <div class="stackPopupHeadText">
                  <div class="stackPopupKicker">Mesmo ponto no mapa</div>
                  <div class="stackPopupTitleMain">${stack.length} dispositivos neste local</div>
                </div>
                <button type="button" class="stackPopupCloseBtn" data-popup-close aria-label="Fechar popup">×</button>
              </div>
            </div>
            <div class="stackPopupChips">${chipsHtml}</div>
            <div class="stackPopupList">${itemsHtml}</div>
          </div>
        `)
        .addTo(map);

      stack.forEach((feature) => {
        const info = getPoiInfo(feature);
        if (info?.kind === "camera" && info.cameraId) {
          trackCommonCameraPopupView(info.cameraId);
        }
      });

      bindPopupCloseButton();
      bindSmartCameraPopupActions();
      centerMobilePopup();
      return true;
    }

    function markMobileMapGesture() {
      if (!isMobileRef.current) return;
      suppressNextMapClickRef.current = true;
      if (suppressMapClickTimerRef.current) {
        window.clearTimeout(suppressMapClickTimerRef.current);
      }
      suppressMapClickTimerRef.current = window.setTimeout(() => {
        suppressNextMapClickRef.current = false;
        suppressMapClickTimerRef.current = null;
      }, 380);
    }

    function consumeSuppressedMapClick() {
      if (!suppressNextMapClickRef.current) return false;
      suppressNextMapClickRef.current = false;
      if (suppressMapClickTimerRef.current) {
        window.clearTimeout(suppressMapClickTimerRef.current);
        suppressMapClickTimerRef.current = null;
      }
      return true;
    }

    function consumeSuppressedAreaDrawClick() {
      if (!suppressAreaDrawClickRef.current) return false;
      suppressAreaDrawClickRef.current = false;
      return true;
    }

    function setCursorForIdleMap() {
      if (draggingAreaPointIndexRef.current !== null) {
        map.getCanvas().style.cursor = "grabbing";
        return;
      }
      map.getCanvas().style.cursor = areaDrawModeRef.current ? "crosshair" : "";
    }

    function stopAreaPointDrag() {
      const dragIndex = draggingAreaPointIndexRef.current;
      if (dragIndex === null) return;

      window.removeEventListener("mouseup", stopAreaPointDrag);
      window.removeEventListener("blur", stopAreaPointDrag);

      if (areaPointDragPanWasEnabledRef.current) {
        map.dragPan.enable();
      }

      draggingAreaPointIndexRef.current = null;
      areaPointDragPanWasEnabledRef.current = false;

      if (areaPointDragMovedRef.current) {
        if (areaDrawHasSelfIntersection(areaDrawPointsRef.current) && areaPointDragSnapshotRef.current) {
          areaDrawPointsRef.current = areaPointDragSnapshotRef.current;
          setAreaDrawPoints(areaPointDragSnapshotRef.current);
          setAreaReportMsg("A área não pode se cruzar. O ponto voltou para a posição anterior.");
        } else {
          setAreaDrawPoints(areaDrawPointsRef.current);
          setAreaReportMsg(null);
        }
      }
      areaPointDragMovedRef.current = false;
      areaPointDragSnapshotRef.current = null;
      setCursorForIdleMap();
    }

    function setCursorPointer() {
      if (draggingAreaPointIndexRef.current !== null) {
        map.getCanvas().style.cursor = "grabbing";
        return;
      }
      map.getCanvas().style.cursor = "pointer";
    }
    function setCursorDefault() {
      setCursorForIdleMap();
    }

    function getSecurityAreaKindFromLayerId(layerId: string): SecurityAreaKind | null {
      if (layerId.startsWith("lyr-risp-")) return "risp";
      if (layerId.startsWith("lyr-aisp-")) return "aisp";
      if (layerId.startsWith("lyr-cisp-")) return "cisp";
      return null;
    }

    function findSecurityAreaFromGeometry(point: [number, number]) {
      const collections: Array<{
        kind: SecurityAreaKind;
        enabled: boolean;
        data: FeatureCollection<Polygon | MultiPolygon, any> | null;
      }> = [
        { kind: "risp", enabled: showRispRef.current, data: rispGeoRef.current },
        { kind: "aisp", enabled: showAispRef.current, data: aispGeoRef.current },
        { kind: "cisp", enabled: showCispRef.current, data: cispGeoRef.current },
      ];

      for (const collection of collections) {
        if (!collection.enabled || !collection.data?.features?.length) continue;

        for (const feature of collection.data.features as SecurityAreaFeature[]) {
          if (!feature.geometry) continue;
          const bbox = getGeometryBbox(feature.geometry);
          if (!bbox) continue;
          if (
            point[0] < bbox.minX ||
            point[0] > bbox.maxX ||
            point[1] < bbox.minY ||
            point[1] > bbox.maxY
          ) {
            continue;
          }
          if (!pointInGeometry(point, feature.geometry)) continue;

          const code = getSecurityAreaFeatureCode(feature);
          if (!code) continue;
          return { kind: collection.kind, code };
        }
      }

      return null;
    }

    const hoverLayerIds = [LAYERS.cameras_intel_points, LAYERS.cameras_lpr_points, LAYERS.radares_points, LAYERS.clusters];
    for (const lid of hoverLayerIds) {
      map.on("mouseenter", lid, setCursorPointer);
      map.on("mouseleave", lid, setCursorDefault);
    }

    map.on("mouseenter", LAYERS.area_draw_points, () => {
      map.getCanvas().style.cursor =
        draggingAreaPointIndexRef.current !== null ? "grabbing" : "grab";
    });

    map.on("mouseleave", LAYERS.area_draw_points, () => {
      if (draggingAreaPointIndexRef.current !== null) return;
      setCursorForIdleMap();
    });

    map.on("mouseenter", LAYERS.area_draw_line, () => {
      if (draggingAreaPointIndexRef.current !== null) {
        map.getCanvas().style.cursor = "grabbing";
        return;
      }
      map.getCanvas().style.cursor = "copy";
    });

    map.on("mouseleave", LAYERS.area_draw_line, () => {
      if (draggingAreaPointIndexRef.current !== null) return;
      setCursorForIdleMap();
    });

    map.on("click", LAYERS.area_draw_line, (e) => {
      if (suppressAreaDrawClickRef.current) return;
      const feature: any = e.features?.[0];
      if (feature?.properties?.kind !== "area_line_current" && feature?.properties?.kind !== "area_polygon_current") {
        return;
      }
      if (areaDrawPointsRef.current.length < 2) return;

      const lng = Number(e.lngLat?.lng);
      const lat = Number(e.lngLat?.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

      const insertInfo = getAreaDrawInsertInfo(map, areaDrawPointsRef.current, [lng, lat]);
      if (!insertInfo) return;

      suppressAreaDrawClickRef.current = true;
      if (areaDrawIsNearExistingVertex(map, areaDrawPointsRef.current, insertInfo.point)) {
        setAreaReportMsg("Esse ponto está muito próximo de outro vértice da área.");
        e.preventDefault();
        return;
      }
      const nextPoints = insertAreaDrawPoint(
        areaDrawPointsRef.current,
        insertInfo.insertIndex,
        insertInfo.point
      );
      if (areaDrawHasSelfIntersection(nextPoints)) {
        setAreaReportMsg("A área não pode se cruzar. Ajuste os pontos antes de continuar.");
        return;
      }
      areaDrawPointsRef.current = nextPoints;
      setAreaDrawPoints(nextPoints);
      setAreaReportMsg(null);
      e.preventDefault();
    });

    map.on("mousedown", LAYERS.area_draw_points, (e) => {
      const feature: any = e.features?.[0];
      const dragIndex = Number(feature?.properties?.point_index);
      if (!Number.isInteger(dragIndex) || dragIndex < 0) return;

      suppressAreaDrawClickRef.current = true;
      areaPointDragMovedRef.current = false;
      draggingAreaPointIndexRef.current = dragIndex;
      areaPointDragSnapshotRef.current = [...areaDrawPointsRef.current];
      areaPointDragPanWasEnabledRef.current = map.dragPan.isEnabled();
      if (areaPointDragPanWasEnabledRef.current) {
        map.dragPan.disable();
      }

      map.getCanvas().style.cursor = "grabbing";
      e.preventDefault();
      window.addEventListener("mouseup", stopAreaPointDrag);
      window.addEventListener("blur", stopAreaPointDrag);
    });

    map.on("mousemove", (e) => {
      const dragIndex = draggingAreaPointIndexRef.current;
      if (dragIndex === null) return;

      const lng = Number(e.lngLat?.lng);
      const lat = Number(e.lngLat?.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

      areaPointDragMovedRef.current = true;
      const nextPoints = replaceAreaDrawPoint(areaDrawPointsRef.current, dragIndex, [lng, lat]);
      areaDrawPointsRef.current = nextPoints;
      updateAreaDrawData(map, areaDrawPolygonsRef.current, nextPoints);
      map.getCanvas().style.cursor = "grabbing";
    });

    map.on("mouseup", () => {
      stopAreaPointDrag();
    });

    map.on("mouseenter", LAYERS.cameras_points, (e) => {
      setCursorPointer();
      clearHoverPreviewTimer();
      if (!hasStreamingAccessRef.current) return;
      const f: any = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const streamingUrl = normalizeExternalUrl(p.streaming_url || p.stream_url || "");
      if (!streamingUrl) return;
      const coords = (f.geometry as any).coordinates as [number, number];
      const pointY = e.point?.y ?? map.project({ lng: coords[0], lat: coords[1] }).y;
      const navSafeTop = 96;
      const previewHeight = 240;
      const minTop = navSafeTop + 6;
      const isNearTop = pointY < minTop + previewHeight;
      const offsetY = isNearTop ? Math.max(14, minTop - pointY + 14) : 14;
      const hoverPreviewPopup = ensureHoverPreviewPopup(isNearTop ? "top" : "bottom");

      hoverPreviewTimerRef.current = window.setTimeout(() => {
        trackCommonCameraPopupView(cleanString(p.camera_id || p.id));
        hoverPreviewPopup
          ?.setLngLat(coords)
          .setOffset(isNearTop ? [0, offsetY] : 14)
          .setHTML(`
            <div style="width:360px;background:#000;">
              <div style="width:360px;height:203px;overflow:hidden;position:relative;background:#000;">
                <iframe
                  src="${escapeHtml(streamingUrl)}"
                  title="Preview câmera"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  scrolling="no"
                  style="position:absolute;top:0;left:0;width:1600px;height:900px;border:0;background:#000;transform:scale(0.225);transform-origin:top left;"
                ></iframe>
              </div>
              <div style="padding:6px 8px;color:#fff;font-size:11px;line-height:1.3;opacity:.92;">
                Para abrir a imagem maior, clique na c&acirc;mera e abra o link.
              </div>
            </div>
          `)
          .addTo(map);
        centerMobilePopup(hoverPreviewPopup);
      }, 120);
    });

    map.on("mouseleave", LAYERS.cameras_points, () => {
      setCursorDefault();
      hideHoverPreview();
    });

    function showSmartCameraHoverPreview(e: mapboxgl.MapLayerMouseEvent) {
      clearHoverPreviewTimer();
      clearHoverPreviewCloseTimer();
      clearHoverPreviewCountdownTimer();
      setCursorPointer();

      if (!hasSmartCameraStreamingAccessRef.current) return;
      const f: any = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const smartId = cleanString(p.id);
      if (!smartId) return;
      if (isSmartCameraStreamingUnavailable(smartId)) return;

      const coords = (f.geometry as any).coordinates as [number, number];
      const pointY = e.point?.y ?? map.project({ lng: coords[0], lat: coords[1] }).y;
      const navSafeTop = 96;
      const previewHeight = 240;
      const minTop = navSafeTop + 6;
      const isNearTop = pointY < minTop + previewHeight;
      const offsetY = isNearTop ? Math.max(14, minTop - pointY + 14) : 14;
      const hoverPreviewPopup = ensureHoverPreviewPopup(isNearTop ? "top" : "bottom");
      const requestGeneration = hoverPreviewGenerationRef.current;

      hoverPreviewTimerRef.current = window.setTimeout(async () => {
        hoverPreviewPopup
          ?.setLngLat(coords)
          .setOffset(isNearTop ? [0, offsetY] : 14)
          .setHTML(`
            <div style="width:360px;background:#000;">
              <div style="width:360px;height:203px;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-size:12px;letter-spacing:.02em;">
                Abrindo preview...
              </div>
            </div>
          `)
          .addTo(map);
        centerMobilePopup(hoverPreviewPopup);

        try {
          const session = await requestSmartCameraSession(smartId, SMART_CAMERA_PREVIEW_DURATION_SECONDS);
          if (requestGeneration !== hoverPreviewGenerationRef.current) return;

          hoverPreviewPopup
            ?.setLngLat(coords)
            .setOffset(isNearTop ? [0, offsetY] : 14)
            .setHTML(`
              <div style="width:360px;background:#000;">
                <div style="width:360px;height:203px;overflow:hidden;position:relative;background:#000;">
                  <iframe
                    src="${escapeHtml(session.sessionUrl)}"
                    title="Preview câmera"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    scrolling="no"
                    style="position:absolute;top:0;left:0;width:1600px;height:900px;border:0;background:#000;transform:scale(0.225);transform-origin:top left;"
                  ></iframe>
                  <div class="smartPreviewCountdown" data-smart-preview-countdown>
                    ${SMART_CAMERA_PREVIEW_DURATION_SECONDS}s
                  </div>
                </div>
                <div style="padding:6px 8px;color:#fff;font-size:11px;line-height:1.3;opacity:.92;">
                  Para abrir a imagem maior, clique na c&acirc;mera e abra o link.
                </div>
              </div>
            `);
          centerMobilePopup(hoverPreviewPopup);
          startSmartCameraPreviewCountdown(requestGeneration, SMART_CAMERA_PREVIEW_DURATION_SECONDS);

          clearHoverPreviewCloseTimer();
          hoverPreviewCloseTimerRef.current = window.setTimeout(() => {
            if (requestGeneration !== hoverPreviewGenerationRef.current) return;
            hoverPreviewPopupRef.current?.remove();
            clearHoverPreviewCloseTimer();
            clearHoverPreviewCountdownTimer();
          }, SMART_CAMERA_PREVIEW_DURATION_SECONDS * 1000);
        } catch (error) {
          if (requestGeneration !== hoverPreviewGenerationRef.current) return;
          if (shouldDisableSmartCameraStreaming(error)) {
            markSmartCameraStreamingUnavailable(smartId);
            clearHoverPreviewCountdownTimer();
            hoverPreviewPopup
              ?.setLngLat(coords)
              .setOffset(isNearTop ? [0, offsetY] : 14)
              .setHTML(`
                <div style="width:360px;background:#000;">
                  <div style="width:360px;height:203px;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-size:13px;line-height:1.5;text-align:center;padding:20px;box-sizing:border-box;">
                    Streaming indispon&iacute;vel. Para acessar mais informa&ccedil;&otilde;es, clique na c&acirc;mera.
                  </div>
                </div>
              `)
              .addTo(map);
            return;
          }
          clearHoverPreviewCountdownTimer();
          hoverPreviewPopup
            ?.setLngLat(coords)
            .setOffset(isNearTop ? [0, offsetY] : 14)
            .setHTML(`
              <div style="width:360px;background:#000;">
                <div style="width:360px;height:203px;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-size:13px;line-height:1.5;text-align:center;padding:20px;box-sizing:border-box;">
                  Streaming indispon&iacute;vel. Para acessar mais informa&ccedil;&otilde;es, clique na c&acirc;mera.
                </div>
              </div>
            `)
            .addTo(map);
          await Swal.fire({
            icon: "warning",
            title: "Preview indisponível",
            text: getSmartCameraSessionErrorMessage(error, "preview"),
            confirmButtonText: "Entendi",
          });
        }
      }, 120);
    }

    map.on("mouseenter", LAYERS.cameras_intel_points, showSmartCameraHoverPreview);
    map.on("mouseleave", LAYERS.cameras_intel_points, () => {
      setCursorDefault();
      hideHoverPreview();
    });

    map.on("click", LAYERS.clusters, (e) => {
      hideHoverPreview();
      const f: any = e.features?.[0];
      if (!f) return;
      const coords = (f.geometry as any).coordinates;
      const clusterId = f.properties?.cluster_id;
      const source: any = map.getSource(SOURCES.pois);
      if (!source || clusterId === undefined || clusterId === null) return;

      source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
        if (err) return;
        map.easeTo({ center: coords, zoom: zoom + 0.5 });
      });
    });

    map.on("click", LAYERS.cameras_points, (e) => {
      hideHoverPreview();
      const f: any = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const coords = (f.geometry as any).coordinates as [number, number];
      const streamingUrl = normalizeExternalUrl(p.streaming_url || p.stream_url || "");
      const allowStreaming = hasStreamingAccessRef.current;
      setSelectionRing(coords[0], coords[1]);
      if (openStackedPopupIfNeeded(coords)) return;

      setSelectedCode(p.code || null);
      setSelectedRadar(null);
      setPanelOpen(false);

      popup
        ?.setLngLat(coords)
        .setHTML(`
          <div class="cameraPopup">
            <button type="button" class="cameraPopupCloseBtn" data-popup-close aria-label="Fechar popup">×</button>
            <div class="cameraPopupHead">
              <div class="cameraPopupTitleWrap">
                <div class="cameraPopupKickerRow">
                  <span class="cameraPopupIconBubble">
                  <img src="${getPoiIconSource(mapBaseStyleRef.current, "camera")}" alt="" class="cameraPopupIcon" />
                  </span>
                  <div class="cameraPopupKicker">Câmera</div>
                </div>
                <div class="cameraPopupTitle">${escapeHtml(p.name || "Câmera sem nome")}</div>
              </div>
              <span class="cameraPopupCode">${escapeHtml(p.code || "-")}</span>
            </div>

            <div class="cameraPopupInfoGrid">
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Código</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.code || "-")}</span>
              </div>
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Zona</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.zona_camera || "-")}</span>
              </div>
            </div>

            <div class="cameraPopupStreamBlock">
              ${allowStreaming && streamingUrl && cleanString(p.camera_id || p.id)
                ? `<button type="button" class="cameraPopupStreamLink" data-camera-stream data-camera-id="${escapeHtml(
                    cleanString(p.camera_id || p.id)
                  )}" data-camera-duration="0">Abrir streaming</button>`
                : ""}
            </div>
          </div>
        `)
        .addTo(map);
      trackCommonCameraPopupView(cleanString(p.camera_id || p.id));
      bindPopupCloseButton();
      bindSmartCameraPopupActions();
      if (allowStreaming && streamingUrl) centerMobilePopup();
    });

    map.on("click", LAYERS.cameras_intel_points, (e) => {
      hideHoverPreview();
      const f: any = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const coords = (f.geometry as any).coordinates as [number, number];
      const smartId = cleanString(p.id);
      const allowStreaming =
        hasSmartCameraStreamingAccessRef.current && Boolean(smartId) && !isSmartCameraStreamingUnavailable(smartId);
      setSelectionRing(coords[0], coords[1]);
      if (openStackedPopupIfNeeded(coords)) return;

      setSelectedCode(null);
      setSelectedRadar(null);
      setPanelOpen(false);

      popup
        ?.setLngLat(coords)
        .setHTML(`
          <div class="cameraPopup cameraPopup--intel">
            <button type="button" class="cameraPopupCloseBtn" data-popup-close aria-label="Fechar popup">×</button>
            <div class="cameraPopupHead">
              <div class="cameraPopupTitleWrap">
                <div class="cameraPopupKickerRow">
                  <span class="cameraPopupIconBubble">
                    <img src="${getPoiIconSource(mapBaseStyleRef.current, "camera_intel")}" alt="" class="cameraPopupIcon" />
                  </span>
                  <div class="cameraPopupKicker">Super Câmera Inteligente</div>
                </div>
                <div class="cameraPopupTitle">${escapeHtml(p.name || "Super Câmera Inteligente")}</div>
              </div>
              <span class="cameraPopupCode">${escapeHtml(p.code || "-")}</span>
            </div>

            <div class="cameraPopupInfoGrid">
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Responsável</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.responsavel || "-")}</span>
              </div>
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Direção</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.direction || "-")}</span>
              </div>
            </div>

            <div class="cameraPopupStreamBlock">
              ${allowStreaming
                ? `<button
                    type="button"
                    class="cameraPopupStreamLink cameraPopupStreamLink--soft"
                    data-smart-camera-stream
                    data-smart-camera-id="${escapeHtml(smartId)}"
                    data-smart-camera-external-camera-id="${escapeHtml(
                      cleanString(p.external_camera_id)
                    )}"
                    data-smart-camera-duration="480"
                    title="Abrir streaming completo"
                  >Abrir streaming</button>`
                : ""}
            </div>
          </div>
        `)
        .addTo(map);
      bindPopupCloseButton();
      bindSmartCameraPopupActions();
      if (allowStreaming) centerMobilePopup();
    });

    map.on("click", LAYERS.cameras_lpr_points, (e) => {
      hideHoverPreview();
      const f: any = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const coords = (f.geometry as any).coordinates as [number, number];
      setSelectionRing(coords[0], coords[1]);
      if (openStackedPopupIfNeeded(coords)) return;

      setSelectedCode(null);
      setSelectedRadar(null);
      setPanelOpen(false);

      popup
        ?.setLngLat(coords)
        .setHTML(`
          <div class="cameraPopup cameraPopup--lpr">
            <button type="button" class="cameraPopupCloseBtn" data-popup-close aria-label="Fechar popup">×</button>
            <div class="cameraPopupHead">
              <div class="cameraPopupTitleWrap">
                <div class="cameraPopupKickerRow">
                  <span class="cameraPopupIconBubble">
                    <img src="${getPoiIconSource(mapBaseStyleRef.current, "camera_lpr")}" alt="" class="cameraPopupIcon" />
                  </span>
                  <div class="cameraPopupKicker">Câmera LPR</div>
                </div>
                <div class="cameraPopupTitle">${escapeHtml(p.local || p.name || "Câmera LPR")}</div>
              </div>
              <span class="cameraPopupCode">${escapeHtml(getPointCollectionCode(p) || "-")}</span>
            </div>

            <div class="cameraPopupInfoGrid">
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Local</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.local || p.name || "-")}</span>
              </div>
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Bairro</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.bairro || p.neighborhood || getLprNeighborhood(p) || "-")}</span>
              </div>
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Sentido</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.sentido || p.direction || "-")}</span>
              </div>
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Origem</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.origem_equipamento || "-")}</span>
              </div>
            </div>
          </div>
        `)
        .addTo(map);
      bindPopupCloseButton();
    });

    map.on("click", LAYERS.radares_points, (e) => {
      hideHoverPreview();
      const f: any = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const coords = (f.geometry as any).coordinates as [number, number];
      setSelectionRing(coords[0], coords[1]);
      if (openStackedPopupIfNeeded(coords)) return;

      setSelectedRadar(getPointCollectionKey(p) || p.codcet || null);
      setSelectedCode(null);
      setPanelOpen(false);

      popup
        ?.setLngLat(coords)
        .setHTML(`
          <div class="cameraPopup cameraPopup--radar">
            <button type="button" class="cameraPopupCloseBtn" data-popup-close aria-label="Fechar popup">×</button>
            <div class="cameraPopupHead">
              <div class="cameraPopupTitleWrap">
                <div class="cameraPopupKickerRow">
                  <span class="cameraPopupIconBubble">
                    <img src="${getPoiIconSource(mapBaseStyleRef.current, "radar")}" alt="" class="cameraPopupIcon" />
                  </span>
                  <div class="cameraPopupKicker">Radar</div>
                </div>
                <div class="cameraPopupTitle">${escapeHtml(p.local || p.logradouro || p.localidade || "Radar")}</div>
              </div>
              <span class="cameraPopupCode">${escapeHtml(getPointCollectionCode(p) || "-")}</span>
            </div>

            <div class="cameraPopupInfoGrid">
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Local</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.local || p.logradouro || p.localidade || "-")}</span>
              </div>
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Bairro</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.bairro || "-")}</span>
              </div>
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Sentido</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.sentido || "-")}</span>
              </div>
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Origem</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.origem_equipamento || "-")}</span>
              </div>
            </div>
          </div>
        `)
        .addTo(map);
      bindPopupCloseButton();
    });

    map.on("click", (e) => {
      hideHoverPreview();
      if (consumeSuppressedAreaDrawClick()) return;
      if (areaDrawModeRef.current) {
        const lng = Number(e.lngLat?.lng);
        const lat = Number(e.lngLat?.lat);
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          const target = [lng, lat] as [number, number];
          const currentPoints = areaDrawPointsRef.current;

          if (areaDrawIsNearExistingVertex(map, currentPoints, target)) {
            setAreaReportMsg("Esse ponto está muito próximo de outro vértice da área.");
            return;
          }

          const next =
            currentPoints.length >= 3
              ? areaDrawContainsPoint(currentPoints, target)
                ? null
                : getAreaDrawExpandedPoints(map, currentPoints, target)
              : [...currentPoints, target];

          if (!next) {
            setAreaReportMsg(
              currentPoints.length >= 3 && areaDrawContainsPoint(currentPoints, target)
                ? "Esse ponto já está dentro da área. Clique fora para expandir ou arraste os vértices para ajustar."
                : "Não foi possível agregar esse ponto sem cruzar a área. Tente clicar mais perto da borda."
            );
          } else if (areaDrawHasSelfIntersection(next)) {
            setAreaReportMsg("A área não pode se cruzar. Ajuste os pontos antes de continuar.");
          } else {
            areaDrawPointsRef.current = next;
            setAreaDrawPoints(next);
            setAreaReportMsg(null);
          }
        }
        return;
      }
      if (consumeSuppressedMapClick()) return;
      const features = map.queryRenderedFeatures(e.point, {
        layers: [
          LAYERS.cameras_points,
          LAYERS.cameras_intel_points,
          LAYERS.cameras_lpr_points,
          LAYERS.radares_points,
          LAYERS.clusters,
        ],
      });
      if (!features || features.length === 0) {
        let clickedBairro = "";

        if (showBairrosRef.current) {
          const bairroLayers = [
            LAYERS.bairros_selected_fill,
            LAYERS.bairros_selected_line,
            LAYERS.bairros_fill,
            LAYERS.bairros_line,
          ];
          const renderedBairroFeatures = map.queryRenderedFeatures(e.point, { layers: bairroLayers });
          const bairroFeature = renderedBairroFeatures.find((f: any) => {
            return getBairroFeatureName(f?.properties).length > 0;
          }) as any;
          clickedBairro = getBairroFeatureName(bairroFeature?.properties);

          if (!clickedBairro) {
            const lng = Number(e.lngLat?.lng);
            const lat = Number(e.lngLat?.lat);
            const data = bairrosGeoRef.current;
            if (Number.isFinite(lng) && Number.isFinite(lat) && data?.features?.length) {
              const point: [number, number] = [lng, lat];
              for (const feature of data.features as BairrosFeature[]) {
                const nome = getBairroFeatureName(feature.properties);
                if (!nome || !feature.geometry) continue;
                const bbox = getGeometryBbox(feature.geometry);
                if (!bbox) continue;
                if (
                  point[0] < bbox.minX ||
                  point[0] > bbox.maxX ||
                  point[1] < bbox.minY ||
                  point[1] > bbox.maxY
                ) {
                  continue;
                }
                if (pointInGeometry(point, feature.geometry)) {
                  clickedBairro = nome;
                  break;
                }
              }
            }
          }
        }

        if (clickedBairro) {
          clearSelectedSecurityArea();
          setSelectedBairro(clickedBairro);
          setBairroQuery("");
          setBairroReportMsg(null);
          return;
        }

        const codeFeature = map
          .queryRenderedFeatures(e.point, {
            layers: [
              LAYERS.risp_selected_fill,
              LAYERS.risp_selected_line,
              LAYERS.risp_fill,
              LAYERS.risp_line,
              LAYERS.risp_label,
              LAYERS.aisp_selected_fill,
              LAYERS.aisp_selected_line,
              LAYERS.aisp_fill,
              LAYERS.aisp_line,
              LAYERS.aisp_label,
              LAYERS.cisp_selected_fill,
              LAYERS.cisp_selected_line,
              LAYERS.cisp_fill,
              LAYERS.cisp_line,
              LAYERS.cisp_label,
            ],
          })
          .find((feature: any) => {
            const code = feature?.properties?.name;
            return code !== undefined && code !== null && String(code).trim().length > 0;
          }) as any;

        if (codeFeature) {
          const kind = getSecurityAreaKindFromLayerId(codeFeature.layer?.id || "");
          const code = String(codeFeature.properties?.name || "").trim();
          if (kind && code) {
            selectSecurityArea({ kind, code });
            return;
          }
        }

        const lng = Number(e.lngLat?.lng);
        const lat = Number(e.lngLat?.lat);
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          const geometryMatch = findSecurityAreaFromGeometry([lng, lat]);
          if (geometryMatch) {
            selectSecurityArea(geometryMatch);
            return;
          }
        }

        if (showBairrosRef.current) {
          setSelectedBairro("");
          setBairroReportMsg(null);
        }

        if (!keepMobileStreamingPopupOpen()) popup?.remove();
      }

      if (panelRef.current !== null) {
        setPanel(null);
        setPanelOpen(false);
      }

      setDockOpen(false);
    });

    const closeDockOnMove = () => {
      hideHoverPreview();
      markMobileMapGesture();
      if (isMobileRef.current) setDockOpen(false);
    };
    map.on("dragstart", closeDockOnMove);
    map.on("zoomstart", closeDockOnMove);
    map.on("pitchstart", closeDockOnMove);
    map.on("rotatestart", closeDockOnMove);

    map.on("zoom", () => {
      updateGpsData(map, gpsRef.current, gpsOnRef.current);
    });
  }

  function toggleGps() {
    if (!canUseGps) return;

    setGpsOn((prev) => {
      const next = !prev;

      if (!next) {
        setGps(null);
        const map = mapRef.current;
        if (map && map.isStyleLoaded()) updateGpsData(map, null, false);
      } else {
        const map = mapRef.current;
        if (map && map.isStyleLoaded()) updateGpsData(map, gpsRef.current, true);
      }

      return next;
    });

    setDockOpen(true);
    bumpDockAutoHide();
  }

  useEffect(() => {
    if (!canViewBairros) {
      setLoadingBairros(false);
      setBairrosGeo(null);
      setBairrosLinesGeo(null);
      setBairrosErr(null);
      return;
    }

    if (authLoading || !accessToken) {
      return;
    }

    let active = true;
    async function loadBairros() {
      setLoadingBairros(true);
      setBairrosErr(null);

      try {
        const data = await fetchJson<FeatureCollection<Polygon | MultiPolygon, any>>(
          `${API_BASE}/bairros/geojson`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        if (!active) return;
        setBairrosGeo(normalizeBairrosGeoData(data));
        setBairrosLinesGeo(buildBairrosLineGeoData(data));
        setLoadingBairros(false);
      } catch (e) {
        console.warn("Falha ao carregar bairros da API. Tentando fallback local.", e);

        const baseUrl = (import.meta as any).env?.BASE_URL?.toString() || "/";
        const candidates = [
          `${baseUrl}GeojsonBairros.geojson`,
          "/GeojsonBairros.geojson",
          "./GeojsonBairros.geojson",
        ];

        for (const url of candidates) {
          try {
            const fallbackRes = await fetch(url);
            if (!fallbackRes.ok) {
              throw new Error(`${fallbackRes.status} - ${fallbackRes.statusText || "Erro"}`);
            }
            const fallbackData = (await fallbackRes.json()) as FeatureCollection<Polygon | MultiPolygon, any>;
            if (!active) return;
            setBairrosGeo(normalizeBairrosGeoData(fallbackData));
            setBairrosLinesGeo(buildBairrosLineGeoData(fallbackData));
            setBairrosErr(null);
            setLoadingBairros(false);
            return;
          } catch (fallbackError) {
            console.warn("Falha ao carregar fallback local de bairros em", url, fallbackError);
          }
        }

        if (!active) return;
        setBairrosErr("Não foi possível carregar os bairros pela API nem pelo arquivo local.");
        setBairrosLinesGeo(null);
        setLoadingBairros(false);
      }
    }

    loadBairros();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading, canViewBairros]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !canViewBairros || !bairrosGeo || !bairrosLinesGeo) return;

    const syncBairros = () => {
      ensureSourcesAndLayers(map);
      updateBairrosData(map, bairrosGeo);
      updateBairrosLineData(map, bairrosLinesGeo);
      applyBairrosVisibility(map, showBairros, selectedBairro);
    };

    if (map.isStyleLoaded()) {
      syncBairros();
      return;
    }

    map.once("load", syncBairros);
    return () => {
      map.off("load", syncBairros);
    };
  }, [bairrosGeo, bairrosLinesGeo, canViewBairros, showBairros, selectedBairro]);

  useEffect(() => {
    if (!canViewRisp) {
      setRispGeo(null);
      return;
    }

    let active = true;
    async function loadRisp() {
      const baseUrl = (import.meta as any).env?.BASE_URL?.toString() || "/";
      const candidates = [`${baseUrl}risp.geojson`, "/risp.geojson", "./risp.geojson"];

      for (const url of candidates) {
        try {
          const data = await fetchJson<FeatureCollection<Polygon | MultiPolygon, any>>(url);
          if (!active) return;
          const normalized = normalizeCodeGeoByName(data, ["name", "risp", "RISP"]);
          setRispGeo(keepOnlyCodes(normalized, [1, 2]));
          return;
        } catch (e) {
          console.warn("Falha ao carregar RISP de", url, e);
        }
      }
    }

    loadRisp();
    return () => {
      active = false;
    };
  }, [canViewRisp]);

  useEffect(() => {
    if (!canViewAisp) {
      setAispGeo(null);
      return;
    }

    let active = true;
    async function loadAisp() {
      const baseUrl = (import.meta as any).env?.BASE_URL?.toString() || "/";
      const candidates = [`${baseUrl}aisp.geojson`, "/aisp.geojson", "./aisp.geojson"];

      for (const url of candidates) {
        try {
          const data = await fetchJson<FeatureCollection<Polygon | MultiPolygon, any>>(url);
          if (!active) return;
          setAispGeo(normalizeCodeGeoByName(data, ["name", "aisp", "AISP"]));
          return;
        } catch (e) {
          console.warn("Falha ao carregar AISP de", url, e);
        }
      }
    }

    loadAisp();
    return () => {
      active = false;
    };
  }, [canViewAisp]);

  useEffect(() => {
    if (!canViewCisp) {
      setCispGeo(null);
      return;
    }

    let active = true;
    async function loadCisp() {
      const baseUrl = (import.meta as any).env?.BASE_URL?.toString() || "/";
      const candidates = [`${baseUrl}cisp.geojson`, "/cisp.geojson", "./cisp.geojson"];

      for (const url of candidates) {
        try {
          const data = await fetchJson<FeatureCollection<Polygon | MultiPolygon, any>>(url);
          if (!active) return;
          setCispGeo(normalizeCodeGeoByName(data, ["name", "cisp", "CISP"]));
          return;
        } catch (e) {
          console.warn("Falha ao carregar CISP de", url, e);
        }
      }
    }

    loadCisp();
    return () => {
      active = false;
    };
  }, [canViewCisp]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapBaseStyle === "satellite" ? MAP_STYLE_SATELLITE : MAP_STYLE_DARK,
      center: [-43.2096, -22.9035],
      zoom: 11,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    mapRef.current = map;

    const handleStyleLoad = () => {
      void syncMapStyleStateRef.current(map);
    };
    map.on("style.load", handleStyleLoad);
    if (map.isStyleLoaded()) handleStyleLoad();

    return () => {
      map.off("style.load", handleStyleLoad);
      popupRef.current?.remove();
      popupRef.current = null;
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
      if (suppressMapClickTimerRef.current) {
        window.clearTimeout(suppressMapClickTimerRef.current);
        suppressMapClickTimerRef.current = null;
      }
      handlersBoundRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCameras() {
    if (!canViewCameras) {
      setCameras([]);
      setLoadingCameras(false);
      return;
    }

    setLoadingCameras(true);
    try {
      const data = await fetchJson<any>(`${API_BASE}/cameras`, {
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      const list: Camera[] = Array.isArray(data) ? data : [];

      const normalized = list
        .map((c) => {
          const lat = getLat(c);
          const lng = getLng(c);
          return { ...c, lat: lat ?? NaN, lng: lng ?? NaN };
        })
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
        .filter((c) => isEntityActive(c));

      setCameras(normalized);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.startsWith("401") || msg.startsWith("403")) {
        setCameras([]);
        return;
      }
      console.error(e);
      alert(e?.message || "Falha ao carregar câmeras");
    } finally {
      setLoadingCameras(false);
    }
  }

  async function loadCamerasIntel() {
    if (!canViewCamerasIntel) {
      setCamerasIntel([]);
      setLoadingCamerasIntel(false);
      return;
    }

    setLoadingCamerasIntel(true);
    try {
      const data = await fetchJson<any>(`${API_BASE}/cameras-inteligentes`, {
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      const list: CameraIntel[] = Array.isArray(data) ? data : [];

      const normalized = list
        .map((c) => {
          const lat = getLat(c);
          const lng = getLng(c);
          return {
            ...c,
            id: cleanString(c.id) || undefined,
            external_camera_id: cleanString(c.external_camera_id) || null,
            lat: lat ?? NaN,
            lng: lng ?? NaN,
          };
        })
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
        .filter((c) => isEntityActive(c));

      setCamerasIntel(normalized);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.startsWith("401") || msg.startsWith("403")) {
        setCamerasIntel([]);
        return;
      }
      console.error(e);
      alert(e?.message || "Falha ao carregar câmeras inteligentes");
    } finally {
      setLoadingCamerasIntel(false);
    }
  }

  type SmartCameraSessionSource = Pick<CameraIntel, "id" | "external_camera_id">;

  function markSmartCameraStreamingUnavailable(smartId: string) {
    const normalizedId = cleanString(smartId);
    if (!normalizedId) return;
    setUnavailableSmartCameraIds((prev) => (prev[normalizedId] ? prev : { ...prev, [normalizedId]: true }));
  }

  function clearSmartCameraStreamingUnavailable(smartId: string) {
    const normalizedId = cleanString(smartId);
    if (!normalizedId) return;
    setUnavailableSmartCameraIds((prev) => {
      if (!prev[normalizedId]) return prev;
      const next = { ...prev };
      delete next[normalizedId];
      return next;
    });
  }

  function isSmartCameraStreamingUnavailable(source: SmartCameraSessionSource | string | null | undefined) {
    const smartId = typeof source === "string" ? cleanString(source) : getSmartCameraId(source);
    if (!smartId) return false;
    return Boolean(unavailableSmartCameraIdsRef.current[smartId]);
  }

  function shouldDisableSmartCameraStreaming(error: unknown) {
    const rawMessage = String((error as any)?.message || "").trim();
    const match = rawMessage.match(/^(\d{3})\s*-\s*(.*)$/);
    const status = match ? Number(match[1]) : null;
    return status === 403 || status === 404 || status === 409 || rawMessage.includes("URL de sessão válida");
  }

  function getSmartCameraSessionErrorMessage(error: unknown, action: "preview" | "stream") {
    const rawMessage = String((error as any)?.message || "").trim();
    const match = rawMessage.match(/^(\d{3})\s*-\s*(.*)$/);
    if (match) {
      const status = Number(match[1]);
      if (status === 403) {
        return "Seu perfil não tem permissão para abrir o streaming desta super câmera.";
      }
      if (status === 404) {
        return "A super câmera inteligente não foi encontrada.";
      }
      if (status === 409) {
        return "Esta super câmera ainda não possui integração de streaming.";
      }
    }

    if (rawMessage) return rawMessage;

    return action === "preview"
      ? "Não foi possível abrir o preview da super câmera inteligente."
      : "Não foi possível abrir o streaming da super câmera inteligente.";
  }

  async function requestSmartCameraSession(smartId: string, durationSeconds: number) {
    const trimmedSmartId = cleanString(smartId);
    if (!trimmedSmartId) {
      throw new Error("ID da super câmera inteligente indisponível.");
    }

    const data = await fetchJson<SmartCameraSessionResponse>(`${API_BASE}/cameras-inteligentes/${encodeURIComponent(trimmedSmartId)}/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ durationSeconds }),
    });

    const sessionUrl = normalizeSessionUrl(data?.session_url);
    if (!sessionUrl) {
      throw new Error("O backend não retornou uma URL de sessão válida.");
    }

    clearSmartCameraStreamingUnavailable(trimmedSmartId);

    return {
      ...data,
      sessionUrl,
    };
  }

  async function requestCommonCameraSession(cameraId: string, durationSeconds: number) {
    const trimmedCameraId = cleanString(cameraId);
    if (!trimmedCameraId) {
      throw new Error("ID da câmera indisponível.");
    }

    const data = await fetchJson<any>(`${API_BASE}/cameras/${encodeURIComponent(trimmedCameraId)}/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ durationSeconds }),
    });

    const sessionUrl = normalizeSessionUrl(data?.session_url);
    if (!sessionUrl) {
      throw new Error("O backend não retornou uma URL de sessão válida.");
    }

    return {
      ...data,
      sessionUrl,
    };
  }

  async function requestCommonCameraView(cameraId: string) {
    const trimmedCameraId = cleanString(cameraId);
    if (!trimmedCameraId) return;

    await fetchJson<any>(`${API_BASE}/cameras/${encodeURIComponent(trimmedCameraId)}/view`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
  }

  async function openSmartCameraStreamWindow(source: SmartCameraSessionSource, durationSeconds: number) {
    if (!hasSmartCameraStreamingAccessRef.current) {
      await Swal.fire({
        icon: "warning",
        title: "Streaming indisponível",
        text: "Seu perfil não pode abrir streaming desta super câmera.",
        confirmButtonText: "Entendi",
      });
      return;
    }

    const smartId = getSmartCameraId(source);
    if (!smartId) {
      await Swal.fire({
        icon: "warning",
        title: "Streaming indisponível",
        text: "Esta super câmera não possui um ID válido para streaming.",
        confirmButtonText: "Entendi",
      });
      return;
    }

    const streamWindow = window.open("about:blank", "_blank");
    if (streamWindow) {
      try {
        streamWindow.opener = null;
      } catch {}
    }

    try {
      const session = await requestSmartCameraSession(smartId, durationSeconds);
      if (streamWindow && !streamWindow.closed) {
        streamWindow.location.href = session.sessionUrl;
      } else {
        window.location.href = session.sessionUrl;
      }
    } catch (error) {
      if (shouldDisableSmartCameraStreaming(error)) {
        markSmartCameraStreamingUnavailable(smartId);
      }
      if (streamWindow) {
        streamWindow.close();
      }
      await Swal.fire({
        icon: "warning",
        title: "Streaming indisponível",
        text: getSmartCameraSessionErrorMessage(error, "stream"),
        confirmButtonText: "Entendi",
      });
    }
  }

  async function openCommonCameraStreamWindow(cameraId: string, durationSeconds: number) {
    if (!hasStreamingAccessRef.current) {
      await Swal.fire({
        icon: "warning",
        title: "Streaming indisponível",
        text: "Seu perfil não pode abrir streaming desta câmera.",
        confirmButtonText: "Entendi",
      });
      return;
    }

    const trimmedCameraId = cleanString(cameraId);
    if (!trimmedCameraId) {
      await Swal.fire({
        icon: "warning",
        title: "Streaming indisponível",
        text: "Esta câmera não possui um ID válido para streaming.",
        confirmButtonText: "Entendi",
      });
      return;
    }

    const streamWindow = window.open("about:blank", "_blank");
    if (streamWindow) {
      try {
        streamWindow.opener = null;
      } catch {}
    }

    try {
      const session = await requestCommonCameraSession(trimmedCameraId, durationSeconds);
      if (streamWindow && !streamWindow.closed) {
        streamWindow.location.href = session.sessionUrl;
      } else {
        window.location.href = session.sessionUrl;
      }
    } catch (error) {
      if (streamWindow) {
        streamWindow.close();
      }
      await Swal.fire({
        icon: "warning",
        title: "Streaming indisponível",
        text: String((error as any)?.message || "Não foi possível abrir o streaming da câmera."),
        confirmButtonText: "Entendi",
      });
    }
  }

  function trackCommonCameraPopupView(cameraId: string) {
    const trimmedCameraId = cleanString(cameraId);
    if (!trimmedCameraId) return;

    void requestCommonCameraView(trimmedCameraId).catch((error) => {
      console.warn("Falha ao registrar visualização da câmera.", error);
    });
  }

  async function loadCamerasLpr() {
    if (!canViewCamerasLpr) {
      setCamerasLpr([]);
      setLoadingCamerasLpr(false);
      return;
    }

    setLoadingCamerasLpr(true);
    try {
      const data = await fetchJson<any>(`${API_BASE}/cameras-lpr?only_active=true`, {
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      const list: CameraLpr[] = Array.isArray(data) ? data : [];

      const normalized = list
        .map((c) => {
          const lat = getLat(c);
          const lng = getLng(c);
          const neighborhood = getLprNeighborhood(c);
          return { ...c, neighborhood, lat: lat ?? NaN, lng: lng ?? NaN };
        })
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
        .filter((c) => isEntityActive(c));

      setCamerasLpr(normalized);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.startsWith("401") || msg.startsWith("403")) {
        setCamerasLpr([]);
        return;
      }
      console.error(e);
      alert(e?.message || "Falha ao carregar câmeras LPR");
    } finally {
      setLoadingCamerasLpr(false);
    }
  }

  async function loadRadares() {
    if (!canViewRadares) {
      setRadares([]);
      setLoadingRadares(false);
      return;
    }

    setLoadingRadares(true);
    try {
      const data = await fetchJson<any>(`${API_BASE}/radares?only_active=true`, {
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      const list: Radar[] = Array.isArray(data) ? data : [];

      const normalized = list
        .map((r) => {
          const lat = getLat(r);
          const lng = getLng(r);
          return {
            ...r,
            lat: lat ?? NaN,
            lng: lng ?? NaN,
          };
        })
        .filter((r) => Number.isFinite(r.lat as any) && Number.isFinite(r.lng as any))
        .filter((r) => isEntityActive(r));

      setRadares(normalized);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.startsWith("401") || msg.startsWith("403")) {
        setRadares([]);
        return;
      }
      console.error(e);
      alert(e?.message || "Falha ao carregar radares");
    } finally {
      setLoadingRadares(false);
    }
  }

  function resolveApiUrl(pathOrUrl: string) {
    if (!pathOrUrl) return "";
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    return `${API_BASE}${normalizedPath}`;
  }

  async function downloadReportFile(pathOrUrl: string, fallbackName: string) {
    const url = resolveApiUrl(pathOrUrl);
    if (!url) throw new Error("URL de download inválida.");

    const liveAccessToken =
      sessionStorage.getItem("access_token") || localStorage.getItem("access_token") || accessToken;
    const res = await fetch(url, {
      headers: {
        ...(liveAccessToken ? { Authorization: `Bearer ${liveAccessToken}` } : {}),
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Falha no download (${res.status}) ${txt || res.statusText}`);
    }

    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
    const filename = match ? decodeURIComponent(match[1].replace(/"/g, "").trim()) : fallbackName;

    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename || fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  }

  async function waitForReportCompletion(reportId: string, maxAttempts = 20, intervalMs = 1500) {
    for (let i = 0; i < maxAttempts; i++) {
      const detail = await fetchJson<any>(`${API_BASE}/reports/${reportId}`, {
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      const status = String(detail?.status || "").toLowerCase();
      if (status === "completed" && detail?.download_url) return detail;
      if (status === "failed" || status === "error") {
        throw new Error(detail?.message || "Falha ao gerar relatório.");
      }
      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }
    throw new Error("Relatório ainda em processamento. Tente novamente em instantes.");
  }

  async function downloadBairroReport() {
    if (!canRequestBairroReport) {
      setBairroReportMsg(
        hasAuthorizedReportLayers
          ? "Ative pelo menos uma camada para gerar o relatório do bairro."
          : "Seu perfil não possui camadas autorizadas para este relatório."
      );
      return;
    }
    if (!selectedBairro) return;
    if (!selectedBairroFeature?.geometry) {
      setBairroReportMsg("Geometria do bairro não disponível para gerar relatório.");
      return;
    }
    setBairroReportLoading(true);
    setBairroReportMsg("Solicitando geração do relatório...");
    try {
      const payload = {
        name: `Relatório Bairro ${selectedBairro} - ${new Date().toISOString()}`,
        bairro: selectedBairro,
        geometry: selectedBairroFeature.geometry,
        selected_ids: selectedBairroReportSelectionIds,
        layers: activeReportLayers,
        include_inactive: false,
        format: "pdf",
      };

      const created = await fetchJson<any>(`${API_BASE}/reports/bairros`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      let downloadUrl = created?.download_url as string | undefined;

      if (!downloadUrl && created?.id) {
        setBairroReportMsg("Gerando PDF no servidor...");
        const detail = await waitForReportCompletion(String(created.id));
        downloadUrl = detail?.download_url;
      }

      if (!downloadUrl) {
        throw new Error("Relatório criado, mas sem URL de download.");
      }

      const safeBairro = selectedBairro.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").toLowerCase();
      await downloadReportFile(downloadUrl, `relatorio_bairro_${safeBairro}.pdf`);
      setBairroReportMsg("PDF baixado com sucesso.");
    } catch (e: any) {
      setBairroReportMsg(e?.message || "Falha ao gerar relatório.");
    } finally {
      setBairroReportLoading(false);
    }
  }

  function areaGeometryFromPolygons(
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

  function clearAreaDrawing() {
    areaDrawPointsRef.current = [];
    areaDrawPolygonsRef.current = [];
    setAreaDrawPoints([]);
    setAreaDrawPolygons([]);
    setAreaReportMsg(null);
  }

  function toggleAreaDrawing() {
    if (!canUseAreaDraw) return;
    setAreaToolsOpen(true);
    setAreaDrawMode((prev) => !prev);
    setAreaReportMsg(null);
  }

  function removeLastAreaPoint() {
    setAreaDrawPoints((prev) => {
      const next = prev.slice(0, -1);
      areaDrawPointsRef.current = next;
      return next;
    });
    setAreaReportMsg(null);
  }

  function finalizeCurrentAreaPolygon() {
    if (areaDrawPointsRef.current.length < 3) {
      setAreaReportMsg("Adicione pelo menos 3 pontos para concluir este polígono.");
      return;
    }
    if (areaDrawHasSelfIntersection(areaDrawPointsRef.current)) {
      setAreaReportMsg("A área não pode se cruzar. Ajuste os pontos antes de concluir o polígono.");
      return;
    }

    const nextPolygons = [...areaDrawPolygonsRef.current, [...areaDrawPointsRef.current]];
    areaDrawPolygonsRef.current = nextPolygons;
    areaDrawPointsRef.current = [];
    setAreaDrawPolygons(nextPolygons);
    setAreaDrawPoints([]);
    setAreaReportMsg("Polígono concluído. Você pode iniciar outro desenho.");
  }

  async function downloadAreaReport() {
    if (!canRequestAreaReport) {
      setAreaReportMsg(
        hasAuthorizedReportLayers
          ? "Ative pelo menos uma camada para gerar o relatório por área."
          : "Seu perfil não possui camadas autorizadas para este relatório."
      );
      return;
    }
    const geometry = areaGeometryFromPolygons(areaDrawPolygons, areaDrawPoints);
    if (!geometry) {
      setAreaReportMsg("Desenhe pelo menos um polígono com 3 pontos.");
      return;
    }
    if (areaDrawHasSelfIntersection(areaDrawPoints)) {
      setAreaReportMsg("O polígono em edição não pode se cruzar. Ajuste os pontos antes de gerar o PDF.");
      return;
    }

    setAreaReportLoading(true);
    setAreaReportMsg("Solicitando geração do relatório...");
    try {
      const selectionIds = buildGeometrySelectionIds(
        geometry,
        cameras,
        camerasIntel,
        camerasLpr,
        radares
      );
      const payload = {
        name: `Relatório de Área - ${new Date().toISOString()}`,
        geometry,
        selected_ids: {
          cameras: showCameras ? selectionIds.cameras : [],
          super_cameras: showCamerasIntel ? selectionIds.super_cameras : [],
          lpr: showCamerasLpr ? selectionIds.lpr : [],
          radar: showRadares ? selectionIds.radar : [],
        },
        layers: activeReportLayers,
        include_inactive: false,
        format: "pdf",
      };

      const created = await fetchJson<any>(`${API_BASE}/reports/areas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      let downloadUrl = created?.download_url as string | undefined;
      if (!downloadUrl && created?.id) {
        setAreaReportMsg("Gerando PDF no servidor...");
        const detail = await waitForReportCompletion(String(created.id));
        downloadUrl = detail?.download_url;
      }
      if (!downloadUrl) {
        throw new Error("Relatório criado, mas sem URL de download.");
      }

      await downloadReportFile(downloadUrl, "relatorio_area_desenhada.pdf");
      setAreaReportMsg("PDF baixado com sucesso.");
    } catch (e: any) {
      setAreaReportMsg(e?.message || "Falha ao gerar relatório da área.");
    } finally {
      setAreaReportLoading(false);
    }
  }

  function formatSecurityAreaLabel(kind: SecurityAreaKind, code: string) {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode) return kind.toUpperCase();
    return `${normalizedCode}ª ${kind.toUpperCase()}`;
  }

  async function downloadSecurityAreaReport() {
    if (!selectedSecurityFeature?.geometry || !selectedSecurityArea) {
      setSecurityAreaReportMsg("Geometria da área selecionada não está disponível.");
      return;
    }
    if (activeReportLayers.length === 0) {
      setSecurityAreaReportMsg(
        hasAuthorizedReportLayers
          ? "Ative pelo menos uma camada para gerar o relatório desta área."
          : "Seu perfil não possui camadas autorizadas para este relatório."
      );
      return;
    }

    const areaLabel = formatSecurityAreaLabel(
      selectedSecurityArea.kind,
      selectedSecurityArea.code
    );

    setSecurityAreaReportLoading(true);
    setSecurityAreaReportMsg("Solicitando geração do relatório...");
    try {
      const payload = {
        name: `Relatório de ${areaLabel} - ${new Date().toISOString()}`,
        geometry: selectedSecurityFeature.geometry,
        selected_ids: selectedSecurityReportSelectionIds,
        layers: activeReportLayers,
        include_inactive: false,
        format: "pdf",
      };

      const created = await fetchJson<any>(`${API_BASE}/reports/areas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      let downloadUrl = created?.download_url as string | undefined;
      if (!downloadUrl && created?.id) {
        setSecurityAreaReportMsg("Gerando PDF no servidor...");
        const detail = await waitForReportCompletion(String(created.id));
        downloadUrl = detail?.download_url;
      }
      if (!downloadUrl) {
        throw new Error("Relatório criado, mas sem URL de download.");
      }

      const safeArea = areaLabel
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .toLowerCase();
      await downloadReportFile(downloadUrl, `relatorio_${safeArea}.pdf`);
      setSecurityAreaReportMsg("PDF baixado com sucesso.");
    } catch (e: any) {
      setSecurityAreaReportMsg(e?.message || "Falha ao gerar relatório da área.");
    } finally {
      setSecurityAreaReportLoading(false);
    }
  }

  useEffect(() => {
    if (canViewCameras) {
      void loadCameras();
    } else {
      setCameras([]);
    }
    if (canViewRadares) {
      void loadRadares();
    } else {
      setRadares([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewCameras, canViewRadares]);

  useEffect(() => {
    if (!accessToken) {
      setCamerasIntel([]);
      setCamerasLpr([]);
      return;
    }
    if (canViewCamerasIntel) {
      void loadCamerasIntel();
    } else {
      setCamerasIntel([]);
    }
    if (canViewCamerasLpr) {
      void loadCamerasLpr();
    } else {
      setCamerasLpr([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, canViewCamerasIntel, canViewCamerasLpr]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    if (
      canViewCamerasIntel &&
      listMode === "inteligentes" &&
      !loadingCamerasIntel &&
      camerasIntel.length === 0
    ) {
      void loadCamerasIntel();
    }
    if (canViewCamerasLpr && listMode === "lpr" && !loadingCamerasLpr && camerasLpr.length === 0) {
      void loadCamerasLpr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    listMode,
    authLoading,
    accessToken,
    canViewCamerasIntel,
    canViewCamerasLpr,
    loadingCamerasIntel,
    loadingCamerasLpr,
    camerasIntel.length,
    camerasLpr.length,
  ]);

  useEffect(() => {
    if (!canUseGps || !gpsOn) return;

    if (!("geolocation" in navigator)) {
      setGpsErr("Geolocalização não suportada nesse navegador.");
      return;
    }

    setGpsErr(null);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
          accuracy: pos.coords.accuracy,
          heading: gpsDebugHeading ?? pos.coords.heading,
          speed: pos.coords.speed,
          ts: pos.timestamp,
        });
      },
      (err) => {
        setGpsErr(err?.message || "Erro ao obter localização.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1500,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [canUseGps, gpsOn]);

  const poisGeo = useMemo(
    () =>
      makePoisGeoJSON(
        cameras,
        camerasIntel,
        camerasLpr,
        radares,
        showCameras,
        showCamerasIntel,
        showCamerasLpr,
        showRadares
      ),
    [cameras, camerasIntel, camerasLpr, radares, showCameras, showCamerasIntel, showCamerasLpr, showRadares]
  );

  useEffect(() => {
    const index = new Map<string, Feature<Point, any>[]>();
    for (const feature of poisGeo.features) {
      const key = featureCoordKey(feature);
      if (!key) continue;
      const atCoord = index.get(key);
      if (atCoord) {
        atCoord.push(feature);
      } else {
        index.set(key, [feature]);
      }
    }
    poiCoordIndexRef.current = index;
  }, [poisGeo]);

  const bairrosList = useMemo(() => {
    if (!bairrosGeo?.features?.length) return [];
    const names = new Set<string>();
    for (const f of bairrosGeo.features as BairrosFeature[]) {
      const nome = getBairroFeatureName(f.properties);
      if (nome) names.add(nome);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [bairrosGeo]);

  const rispValues = useMemo(() => {
    const set = new Set<number>();
    const feats = rispGeo?.features as Feature<Polygon | MultiPolygon, any>[] | undefined;
    if (!feats) return [];
    for (const f of feats) {
      const v = Number((f.properties as any)?.name ?? (f.properties as any)?.RISP ?? (f.properties as any)?.risp);
      if (Number.isFinite(v)) set.add(v);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [rispGeo]);

  const aispValues = useMemo(() => {
    const set = new Set<number>();
    const feats = aispGeo?.features as Feature<Polygon | MultiPolygon, any>[] | undefined;
    if (!feats) return [];
    for (const f of feats) {
      const v = Number((f.properties as any)?.name ?? (f.properties as any)?.AISP ?? (f.properties as any)?.aisp);
      if (Number.isFinite(v)) set.add(v);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [aispGeo]);

  const cispValues = useMemo(() => {
    const set = new Set<number>();
    const feats = cispGeo?.features as Feature<Polygon | MultiPolygon, any>[] | undefined;
    if (!feats) return [];
    for (const f of feats) {
      const v = Number((f.properties as any)?.name ?? (f.properties as any)?.CISP ?? (f.properties as any)?.cisp);
      if (Number.isFinite(v)) set.add(v);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [cispGeo]);

  const multiCodeWarnings = useMemo(() => {
    const risp: string[] = [];
    const aisp: string[] = [];
    const cisp: string[] = [];
    return { risp, aisp, cisp };
  }, []);

  const rispColorExpr = useMemo(() => buildMatchExpr("name", rispValues), [rispValues]);
  const aispColorExpr = useMemo(() => buildMatchExpr("name", aispValues), [aispValues]);
  const cispColorExpr = useMemo(() => buildMatchExpr("name", cispValues), [cispValues]);

  const bairrosFiltered = useMemo(() => {
    if (!bairroQuery) return bairrosList;
    const q = bairroQuery.trim().toLowerCase();
    if (!q) return bairrosList;
    return bairrosList.filter((nome) => nome.toLowerCase().includes(q));
  }, [bairrosList, bairroQuery]);

  const selectedBairroFeature = useMemo(() => {
    if (!selectedBairro || !bairrosGeo) return null;
    const matches = (bairrosGeo.features as BairrosFeature[]).filter(
      (f) => getBairroFeatureName(f.properties) === selectedBairro
    );
    if (!matches.length) return null;
    if (matches.length === 1) return matches[0];

    const geometries = matches
      .map((feature) => feature.geometry)
      .filter((geometry): geometry is Polygon | MultiPolygon => !!geometry);
    const geometry = mergePolygonalGeometries(geometries);
    if (!geometry) return null;

    return {
      ...matches[0],
      geometry,
      properties: {
        ...matches[0].properties,
        bairro_parts: matches.length,
      },
    };
  }, [bairrosGeo, selectedBairro]);

  const selectedBairroStats = useMemo(() => {
    if (!selectedBairroFeature?.geometry) return null;
    return buildGeometryStats(
      selectedBairroFeature.geometry,
      cameras,
      camerasIntel,
      camerasLpr,
      radares
    );
  }, [selectedBairroFeature, cameras, camerasIntel, camerasLpr, radares]);

  const bairroSummaryItems = useMemo(() => {
    if (!selectedBairroStats) return [];

    return [
      canViewCameras && showCameras
        ? { label: "Câmeras", value: selectedBairroStats.cameras }
        : null,
      canViewCamerasIntel && showCamerasIntel
        ? { label: "Super Câmeras Inteligentes", value: selectedBairroStats.inteligentes }
        : null,
      canViewCamerasLpr && showCamerasLpr ? { label: "LPR", value: selectedBairroStats.lpr } : null,
      canViewRadares && showRadares ? { label: "Radares", value: selectedBairroStats.radares } : null,
    ].filter((item): item is { label: string; value: number } => !!item);
  }, [
    selectedBairroStats,
    canViewCameras,
    canViewCamerasIntel,
    canViewCamerasLpr,
    canViewRadares,
    showCameras,
    showCamerasIntel,
    showCamerasLpr,
    showRadares,
  ]);

  const selectedBairroTotal = bairroSummaryItems.reduce((total, item) => total + item.value, 0);

  const selectedBairroSelectionIds = useMemo(() => {
    if (!selectedBairroFeature?.geometry) return emptyGeometrySelectionIds();
    return buildGeometrySelectionIds(
      selectedBairroFeature.geometry,
      cameras,
      camerasIntel,
      camerasLpr,
      radares
    );
  }, [selectedBairroFeature, cameras, camerasIntel, camerasLpr, radares]);

  const selectedBairroReportSelectionIds = useMemo(
    () => ({
      cameras: showCameras ? selectedBairroSelectionIds.cameras : [],
      super_cameras: showCamerasIntel ? selectedBairroSelectionIds.super_cameras : [],
      lpr: showCamerasLpr ? selectedBairroSelectionIds.lpr : [],
      radar: showRadares ? selectedBairroSelectionIds.radar : [],
    }),
    [selectedBairroSelectionIds, showCameras, showCamerasIntel, showCamerasLpr, showRadares]
  );

  const selectedSecurityFeature = useMemo(() => {
    if (!selectedSecurityArea) return null;

    const canExtractSelectedSecurityArea =
      (selectedSecurityArea.kind === "risp" && canExtractRispData) ||
      (selectedSecurityArea.kind === "aisp" && canExtractAispData) ||
      (selectedSecurityArea.kind === "cisp" && canExtractCispData);
    if (!canExtractSelectedSecurityArea) return null;

    const collection =
      selectedSecurityArea.kind === "risp"
        ? rispGeo
        : selectedSecurityArea.kind === "aisp"
        ? aispGeo
        : cispGeo;

    if (!collection) return null;

    const matches = (collection.features as SecurityAreaFeature[]).filter(
      (feature) => getSecurityAreaFeatureCode(feature) === selectedSecurityArea.code
    );

    return mergeSecurityAreaFeatures(matches);
  }, [selectedSecurityArea, rispGeo, aispGeo, cispGeo, canExtractRispData, canExtractAispData, canExtractCispData]);

  const selectedSecurityStatsKey = selectedSecurityArea
    ? `${selectedSecurityArea.kind}:${selectedSecurityArea.code}`
    : "";

  useEffect(() => {
    if (!selectedSecurityFeature?.geometry || !selectedSecurityArea) {
      setSelectedSecurityStatsState({ key: "", stats: null });
      setSelectedSecuritySummaryLoading(false);
      return;
    }

    const key = `${selectedSecurityArea.kind}:${selectedSecurityArea.code}`;
    let cancelled = false;

    const finish = (stats: GeometryStats | null) => {
      if (cancelled) return;
      setSelectedSecurityStatsState({ key, stats });
      setSelectedSecuritySummaryLoading(false);
    };

    setSelectedSecuritySummaryLoading(false);
    finish(
      buildGeometryStats(
        selectedSecurityFeature.geometry,
        cameras,
        camerasIntel,
        camerasLpr,
        radares
      )
    );

    return () => {
      cancelled = true;
    };
  }, [selectedSecurityArea, selectedSecurityFeature, cameras, camerasIntel, camerasLpr, radares]);

  const selectedSecurityStats =
    selectedSecurityStatsState.key === selectedSecurityStatsKey
      ? selectedSecurityStatsState.stats
      : null;

  const selectedSecuritySummaryItems = useMemo(() => {
    if (!selectedSecurityStats) return [];

    return [
      canViewCameras && showCameras
        ? { label: "Câmeras", value: selectedSecurityStats.cameras }
        : null,
      canViewCamerasIntel && showCamerasIntel
        ? { label: "Super Câmeras Inteligentes", value: selectedSecurityStats.inteligentes }
        : null,
      canViewCamerasLpr && showCamerasLpr ? { label: "LPR", value: selectedSecurityStats.lpr } : null,
      canViewRadares && showRadares ? { label: "Radares", value: selectedSecurityStats.radares } : null,
    ].filter((item): item is { label: string; value: number } => !!item);
  }, [
    selectedSecurityStats,
    canViewCameras,
    canViewCamerasIntel,
    canViewCamerasLpr,
    canViewRadares,
    showCameras,
    showCamerasIntel,
    showCamerasLpr,
    showRadares,
  ]);

  const selectedSecurityTotal = selectedSecuritySummaryItems.reduce(
    (total, item) => total + item.value,
    0
  );

  const selectedSecuritySelectionIds = useMemo(() => {
    if (!selectedSecurityFeature?.geometry) return emptyGeometrySelectionIds();
    return buildGeometrySelectionIds(
      selectedSecurityFeature.geometry,
      cameras,
      camerasIntel,
      camerasLpr,
      radares
    );
  }, [selectedSecurityFeature, cameras, camerasIntel, camerasLpr, radares]);

  const selectedSecurityReportSelectionIds = useMemo(
    () => ({
      cameras: showCameras ? selectedSecuritySelectionIds.cameras : [],
      super_cameras: showCamerasIntel ? selectedSecuritySelectionIds.super_cameras : [],
      lpr: showCamerasLpr ? selectedSecuritySelectionIds.lpr : [],
      radar: showRadares ? selectedSecuritySelectionIds.radar : [],
    }),
    [selectedSecuritySelectionIds, showCameras, showCamerasIntel, showCamerasLpr, showRadares]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      ensureSourcesAndLayers(map);
      updatePoisData(map, poisGeo);
      return;
    }

    const handleLoad = () => {
      ensureSourcesAndLayers(map);
      updatePoisData(map, poisGeo);
    };
    map.once("load", handleLoad);
    return () => {
      map.off("load", handleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poisGeo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!bairrosGeo || !bairrosLinesGeo) return;

    if (map.isStyleLoaded()) {
      ensureSourcesAndLayers(map);
      updateBairrosData(map, bairrosGeo);
      updateBairrosLineData(map, bairrosLinesGeo);
      return;
    }

    const handleLoad = () => {
      ensureSourcesAndLayers(map);
      updateBairrosData(map, bairrosGeo);
      updateBairrosLineData(map, bairrosLinesGeo);
    };
    map.once("load", handleLoad);
    return () => {
      map.off("load", handleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bairrosGeo, bairrosLinesGeo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!rispGeo) return;

    if (map.isStyleLoaded()) {
      ensureSourcesAndLayers(map);
      updateRispData(map, rispGeo);
      return;
    }

    const handleLoad = () => {
      ensureSourcesAndLayers(map);
      updateRispData(map, rispGeo);
    };
    map.once("load", handleLoad);
    return () => {
      map.off("load", handleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rispGeo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!aispGeo) return;

    if (map.isStyleLoaded()) {
      ensureSourcesAndLayers(map);
      updateAispData(map, aispGeo);
      return;
    }

    const handleLoad = () => {
      ensureSourcesAndLayers(map);
      updateAispData(map, aispGeo);
    };
    map.once("load", handleLoad);
    return () => {
      map.off("load", handleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aispGeo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!cispGeo) return;

    if (map.isStyleLoaded()) {
      ensureSourcesAndLayers(map);
      updateCispData(map, cispGeo);
      return;
    }

    const handleLoad = () => {
      ensureSourcesAndLayers(map);
      updateCispData(map, cispGeo);
    };
    map.once("load", handleLoad);
    return () => {
      map.off("load", handleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cispGeo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      ensureSourcesAndLayers(map);
      applyBairrosVisibility(map, showBairros, selectedBairro);
      applyCodeVisibility(
        map,
        showRisp,
        LAYERS.risp_fill,
        LAYERS.risp_line,
        LAYERS.risp_label,
        LAYERS.risp_selected_fill,
        LAYERS.risp_selected_line,
        selectedSecurityArea?.kind === "risp" ? selectedSecurityArea.code : ""
      );
      applyCodeVisibility(
        map,
        showAisp,
        LAYERS.aisp_fill,
        LAYERS.aisp_line,
        LAYERS.aisp_label,
        LAYERS.aisp_selected_fill,
        LAYERS.aisp_selected_line,
        selectedSecurityArea?.kind === "aisp" ? selectedSecurityArea.code : ""
      );
      applyCodeVisibility(
        map,
        showCisp,
        LAYERS.cisp_fill,
        LAYERS.cisp_line,
        LAYERS.cisp_label,
        LAYERS.cisp_selected_fill,
        LAYERS.cisp_selected_line,
        selectedSecurityArea?.kind === "cisp" ? selectedSecurityArea.code : ""
      );
      return;
    }

    const handleLoad = () => {
      ensureSourcesAndLayers(map);
      applyBairrosVisibility(map, showBairros, selectedBairro);
      applyCodeVisibility(
        map,
        showRisp,
        LAYERS.risp_fill,
        LAYERS.risp_line,
        LAYERS.risp_label,
        LAYERS.risp_selected_fill,
        LAYERS.risp_selected_line,
        selectedSecurityArea?.kind === "risp" ? selectedSecurityArea.code : ""
      );
      applyCodeVisibility(
        map,
        showAisp,
        LAYERS.aisp_fill,
        LAYERS.aisp_line,
        LAYERS.aisp_label,
        LAYERS.aisp_selected_fill,
        LAYERS.aisp_selected_line,
        selectedSecurityArea?.kind === "aisp" ? selectedSecurityArea.code : ""
      );
      applyCodeVisibility(
        map,
        showCisp,
        LAYERS.cisp_fill,
        LAYERS.cisp_line,
        LAYERS.cisp_label,
        LAYERS.cisp_selected_fill,
        LAYERS.cisp_selected_line,
        selectedSecurityArea?.kind === "cisp" ? selectedSecurityArea.code : ""
      );
    };
    map.once("load", handleLoad);
    return () => {
      map.off("load", handleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBairros, selectedBairro, showRisp, showAisp, showCisp, selectedSecurityArea]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) return;

    ensureSourcesAndLayers(map);
    updateGpsData(map, gps, gpsOn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps, gpsOn]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!selectedBairro || !bairrosGeo) return;

    const feature = (bairrosGeo.features as BairrosFeature[]).find(
      (f) => getBairroFeatureName(f.properties) === selectedBairro
    );
    if (!feature || !feature.geometry) return;

    const bbox = getGeometryBbox(feature.geometry);
    if (!bbox) return;

    map.fitBounds(
      [
        [bbox.minX, bbox.minY],
        [bbox.maxX, bbox.maxY],
      ],
      { padding: 40, duration: 700, maxZoom: 14 }
    );
  }, [selectedBairro, bairrosGeo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!selectedSecurityFeature?.geometry) return;

    const bbox = getGeometryBbox(selectedSecurityFeature.geometry);
    if (!bbox) return;

    map.fitBounds(
      [
        [bbox.minX, bbox.minY],
        [bbox.maxX, bbox.maxY],
      ],
      { padding: 40, duration: 700, maxZoom: 14 }
    );
  }, [selectedSecurityFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.isStyleLoaded()) {
      ensureSourcesAndLayers(map);
      applyCodeColors(map, rispColorExpr, aispColorExpr, cispColorExpr);
      return;
    }

    const handleLoad = () => {
      ensureSourcesAndLayers(map);
      applyCodeColors(map, rispColorExpr, aispColorExpr, cispColorExpr);
    };
    map.once("load", handleLoad);
    return () => {
      map.off("load", handleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rispColorExpr, aispColorExpr, cispColorExpr]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    updateSearchPin(map, searchPin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchPin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      ensureSourcesAndLayers(map);
      updateAreaDrawData(map, areaDrawPolygons, areaDrawPoints);
      return;
    }
    const handleLoad = () => {
      ensureSourcesAndLayers(map);
      updateAreaDrawData(map, areaDrawPolygons, areaDrawPoints);
    };
    map.once("load", handleLoad);
    return () => {
      map.off("load", handleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaDrawPolygons, areaDrawPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = areaDrawMode ? "crosshair" : "";
    return () => {
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
    };
  }, [areaDrawMode]);

  async function changePassword() {
    setPwMsg(null);

    if (!pwOld || !pwNew || !pwNew2) return setPwMsg("Preencha todos os campos.");
    if (pwNew !== pwNew2) return setPwMsg("As senhas novas não batem.");
    if (pwNew.length < 8) return setPwMsg("Senha muito curta (mínimo 8).");

    setPwLoading(true);
    try {
      await fetchJson(`${API_BASE}/users/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ old_password: pwOld, new_password: pwNew }),
      });

      setPwOld("");
      setPwNew("");
      setPwNew2("");
      setPwMsg("Senha alterada com sucesso.");
    } catch (e: any) {
      console.error(e);
      setPwMsg(e?.message || "Erro ao trocar senha.");
    } finally {
      setPwLoading(false);
    }
  }

  async function handleSearch(queryOverride?: string): Promise<boolean> {
    const q = (queryOverride ?? searchQuery).trim();
    if (!q) return false;
    setSearchErr(null);
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);

    const rioPolygon: Array<[number, number]> = [
      [-43.96293645275085, -22.666692475162534],
      [-43.884929495808876, -22.718091155985434],
      [-43.888946945991904, -22.926195556353818],
      [-43.85791336804897, -23.065250194960612],
      [-43.39949819817687, -23.13645724119617],
      [-43.05720475179976, -23.03661712622869],
      [-43.146005892019474, -22.905245763708123],
      [-43.164977854649806, -22.772348252429836],
      [-43.25074750522708, -22.67994636421203],
      [-43.964442925943644, -22.665299931237172],
      [-43.949320000203244, -22.67576140032547],
    ];

    const rioBbox = rioPolygon.reduce(
      (acc, [lng, lat]) => ({
        west: Math.min(acc.west, lng),
        south: Math.min(acc.south, lat),
        east: Math.max(acc.east, lng),
        north: Math.max(acc.north, lat),
      }),
      { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity }
    );

    function isInRio(lat: number, lng: number) {
      // Ray-casting point in polygon
      let inside = false;
      for (let i = 0, j = rioPolygon.length - 1; i < rioPolygon.length; j = i++) {
        const [xi, yi] = rioPolygon[i];
        const [xj, yj] = rioPolygon[j];
        const intersect =
          yi > lat !== yj > lat &&
          lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }

    const coordMatch = q.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/i);
    if (coordMatch) {
      const lat = Number(coordMatch[1]);
      const lng = Number(coordMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        if (!isInRio(lat, lng)) {
          setSearchErr("Somente município do Rio de Janeiro.");
          return false;
        }
        setSearchPin({ lng, lat });
        flyToPoint(lng, lat, 16);
        searchTimerRef.current = window.setTimeout(() => setSearchPin(null), 4000);
        return true;
      }
    }

    if (!MAPBOX_TOKEN) {
      setSearchErr("Sem token do Mapbox.");
      return false;
    }

    try {
      const baseUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`;
      const proximity = "-43.2096,-22.9035";
      const commonParams = {
        access_token: MAPBOX_TOKEN,
        language: "pt",
        country: "BR",
        bbox: `${rioBbox.west},${rioBbox.south},${rioBbox.east},${rioBbox.north}`,
        proximity,
      } as const;

      const buildUrl = (params: Record<string, string | number | boolean>) => {
        const search = new URLSearchParams();
        for (const [k, v] of Object.entries({ ...commonParams, ...params })) {
          if (typeof v === "boolean") search.set(k, v ? "true" : "false");
          else search.set(k, String(v));
        }
        return `${baseUrl}?${search.toString()}`;
      };

      const looksLikeAddressWithNumber = /\d/.test(q) && /[A-Za-zÀ-ÿ]/.test(q);

      const fetchFeatures = async (params: Record<string, string | number | boolean>) => {
        const data = await fetchJson<any>(buildUrl(params));
        return Array.isArray(data?.features) ? data.features : [];
      };

      const pickFeature = (features: any[]) => {
        if (!features.length) return null;
        const byType = (t: string) => features.find((f) => Array.isArray(f.place_type) && f.place_type.includes(t));
        return byType("address") || byType("poi") || byType("street") || features[0];
      };

      let features: any[] = [];
      if (looksLikeAddressWithNumber) {
        features = await fetchFeatures({ types: "address", autocomplete: false, limit: 5 });
        if (!features.length) features = await fetchFeatures({ types: "address", autocomplete: true, limit: 5 });
        if (!features.length) features = await fetchFeatures({ limit: 5 });
      } else {
        features = await fetchFeatures({ limit: 3 });
      }

      const f = pickFeature(features);
      const center = Array.isArray(f?.center)
        ? f.center
        : Array.isArray(f?.geometry?.coordinates)
        ? f.geometry.coordinates
        : null;

      if (!f || !Array.isArray(center)) {
        setSearchErr("Nenhum resultado.");
        return false;
      }
      const [lng, lat] = center;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setSearchErr("Resultado inválido.");
        return false;
      }
      if (!isInRio(lat, lng)) {
        setSearchErr("Somente município do Rio de Janeiro.");
        return false;
      }
      setSearchPin({ lng, lat });
      const isAddress =
        Array.isArray(f.place_type) && (f.place_type.includes("address") || f.place_type.includes("poi"));
      flyToPoint(lng, lat, isAddress ? 17.5 : 16);
      searchTimerRef.current = window.setTimeout(() => setSearchPin(null), 4000);
      return true;
    } catch (e: any) {
      setSearchErr(e?.message || "Falha ao buscar endereço.");
      return false;
    }
  }

  async function submitMobileSearch(queryOverride?: string) {
    if (mobileSearchSubmittingRef.current) return;
    mobileSearchSubmittingRef.current = true;
    try {
      const ok = await handleSearch(queryOverride);
      if (ok) setMobileSearchOpen(false);
    } finally {
      mobileSearchSubmittingRef.current = false;
    }
  }

  function submitMobileSearchFromTouch(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "touch") return;
    event.preventDefault();
    event.stopPropagation();
    mobileSearchTouchSubmitAtRef.current = Date.now();
    void submitMobileSearch();
  }

  function submitMobileSearchFromClick() {
    if (Date.now() - mobileSearchTouchSubmitAtRef.current < 700) return;
    void submitMobileSearch();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (listMode === "cameras") {
      if (!q) return cameras;
      return cameras.filter((c) => {
        const hay = `${c.name} ${c.code} ${c.city} ${c.uf} ${c.address}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (listMode === "inteligentes") {
      if (!q) return camerasIntel;
      return camerasIntel.filter((c) => {
        const hay = `${c.name} ${c.code} ${c.responsavel ?? ""} ${(c as any).responsavel ?? ""} ${c.direction ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (listMode === "lpr") {
      if (!q) return camerasLpr;
      return camerasLpr.filter((c) => {
        const hay = `${getPointCollectionCode(c)} ${c.name} ${(c as any).local ?? ""} ${c.bairro ?? ""} ${
          c.neighborhood ?? ""
        } ${(c as any).sentido ?? ""} ${c.direction ?? ""} ${c.origem_equipamento ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (!q) return radares;
    return radares.filter((r) => {
      const hay = `${getPointCollectionCode(r)} ${r.bairro ?? ""} ${r.local ?? ""} ${r.logradouro ?? ""} ${
        r.localidade ?? ""
      } ${r.sentido ?? ""} ${r.origem_equipamento ?? ""} ${r.status ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [cameras, camerasIntel, camerasLpr, radares, query, listMode]);

  const { page, setPage, totalPages, pagedItems } = useMemo(() => {
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const current =
      listMode === "cameras"
        ? pageCameras
        : listMode === "inteligentes"
        ? pageIntel
        : listMode === "lpr"
        ? pageLpr
        : pageRadares;
    const safe = clamp(current, 1, pages);
    const sliceStart = (safe - 1) * PAGE_SIZE;
    const sliceEnd = sliceStart + PAGE_SIZE;
    const setter =
      listMode === "cameras"
        ? setPageCameras
        : listMode === "inteligentes"
        ? setPageIntel
        : listMode === "lpr"
        ? setPageLpr
        : setPageRadares;

    return {
      page: safe,
      setPage: setter,
      totalPages: pages,
      pagedItems: filtered.slice(sliceStart, sliceEnd),
    };
  }, [filtered, listMode, pageCameras, pageIntel, pageLpr, pageRadares]);

  function triggerPagePulse() {
    if (pagePulseTimerRef.current) {
      window.clearTimeout(pagePulseTimerRef.current);
    }
    setPagePulse(true);
    pagePulseTimerRef.current = window.setTimeout(() => {
      setPagePulse(false);
      pagePulseTimerRef.current = null;
    }, 700);
  }

  const mobileCount =
    listMode === "cameras"
      ? mobileCountCameras
      : listMode === "inteligentes"
      ? mobileCountIntel
      : listMode === "lpr"
      ? mobileCountLpr
      : mobileCountRadares;

  const listItems = isMobile ? filtered.slice(0, mobileCount) : pagedItems;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1210px), (max-height: 500px) and (pointer: coarse)");
    const update = () => setIsMobile(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  useEffect(() => {
    isMobileRef.current = isMobile;
    if (isMobile) setDockOpen(false);
  }, [isMobile]);

  useEffect(() => {
    setMobileSearchFocused(false);
  }, [mobileSearchOpen]);

  useEffect(() => {
    if (listMode === "cameras") setPageCameras(1);
    if (listMode === "inteligentes") setPageIntel(1);
    if (listMode === "lpr") setPageLpr(1);
    if (listMode === "radares") setPageRadares(1);
  }, [listMode, query]);

  useEffect(() => {
    setMobileCountCameras(PAGE_SIZE);
    setMobileCountIntel(PAGE_SIZE);
    setMobileCountLpr(PAGE_SIZE);
    setMobileCountRadares(PAGE_SIZE);
  }, [listMode, query]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);

  function animateListScrollToTop(el: HTMLDivElement) {
    if (listScrollAnimFrameRef.current) {
      window.cancelAnimationFrame(listScrollAnimFrameRef.current);
      listScrollAnimFrameRef.current = null;
    }

    const startTop = el.scrollTop;
    if (startTop <= 0) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion) {
      el.scrollTop = 0;
      return;
    }

    const durationMs = 180;
    const startedAt = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      el.scrollTop = Math.round(startTop * (1 - eased));

      if (t < 1) {
        listScrollAnimFrameRef.current = window.requestAnimationFrame(step);
      } else {
        el.scrollTop = 0;
        listScrollAnimFrameRef.current = null;
      }
    };

    listScrollAnimFrameRef.current = window.requestAnimationFrame(step);
  }

  useEffect(() => {
    const el = isMobile ? listScrollMobileRef.current : listScrollRef.current;
    if (!el) return;
    animateListScrollToTop(el);
  }, [page, listMode, isMobile]);

  useEffect(() => {
    return () => {
      if (listScrollAnimFrameRef.current) {
        window.cancelAnimationFrame(listScrollAnimFrameRef.current);
      }
    };
  }, []);

  useMemo(() => {
    if (!selectedCode) return null;
    return cameras.find((c) => getPointCollectionIdentifiers(c).includes(selectedCode)) || null;
  }, [selectedCode, cameras]);

  useMemo(() => {
    if (!selectedRadar) return null;
    return radares.find((r) => getPointCollectionIdentifiers(r).includes(selectedRadar)) || null;
  }, [selectedRadar, radares]);

  useEffect(() => {
    if (panel !== "admin" || activeAdminTab !== "users") {
      setAdminUsersOrgOpen(false);
    }
  }, [panel, activeAdminTab]);

  const panelWidth =
    panel === "admin"
      ? activeAdminTab === "usage"
        ? 1240
        : 860
      : panel === "civitas"
        ? 1120
        : 560;
  const panelSideInset = 16;
  const panelShiftRight = panel === "civitas" ? 190 : 0;
  const panelMaxHeight =
    panel === "admin"
      ? activeAdminTab === "usage"
        ? "82vh"
        : activeAdminTab === "organizations"
          ? "84vh"
          : activeAdminTab === "users" && adminUsersOrgOpen
            ? "84vh"
            : "74vh"
      : "56vh";
  const currentListOption =
    availableListModes.find(({ mode }) => mode === listMode) ||
    LIST_MODE_OPTIONS.find(({ mode }) => mode === listMode) ||
    LIST_MODE_OPTIONS[0];
  const listTitle = currentListOption?.label || "Camadas";
  const listCountLabel =
    listMode === "cameras"
      ? loadingCameras
        ? "Carregando..."
        : `${cameras.length}`
      : listMode === "inteligentes"
      ? loadingCamerasIntel
        ? "Carregando..."
        : `${camerasIntel.length}`
      : listMode === "lpr"
      ? loadingCamerasLpr
        ? "Carregando..."
        : `${camerasLpr.length}`
      : loadingRadares
      ? "Carregando..."
      : `${radares.length}`;
  const listHeaderLabel = `${listTitle} - ${listCountLabel}`;
  const selectedSecurityAreaLabel = selectedSecurityArea
    ? formatSecurityAreaLabel(selectedSecurityArea.kind, selectedSecurityArea.code)
    : "";
  const canRequestSecurityAreaReport =
    !!selectedSecurityFeature?.geometry && activeReportLayers.length > 0;
  const totalAreaPolygonCount =
    areaDrawPolygons.length + (areaDrawPoints.length >= 3 ? 1 : 0);
  const totalAreaPointCount =
    areaDrawPolygons.reduce((total, points) => total + points.length, 0) + areaDrawPoints.length;

  const renderGeometrySummaryCard = ({
    title,
    total,
    items,
    onClose,
    onDownload,
    reportLoading,
    reportMsg,
    canRequest,
    loading = false,
    loadingText = "Carregando resumo...",
  }: {
    title: string;
    total: number;
    items: Array<{ label: string; value: number }>;
    onClose: () => void;
    onDownload: () => void;
    reportLoading: boolean;
    reportMsg: string | null;
    canRequest: boolean;
    loading?: boolean;
    loadingText?: string;
  }) => (
    <div
      className="dock"
      style={
        isMobile
          ? { width: "100%", maxWidth: 360, padding: 8, gap: 4 }
          : { minWidth: 220 }
      }
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="dockTitle" style={{ marginBottom: 0 }}>
          Resumo
        </div>
        <button
          className="btnGhost"
          onClick={onClose}
          style={{
            width: isMobile ? 24 : 28,
            height: isMobile ? 24 : 28,
            padding: 0,
            borderRadius: 999,
            lineHeight: 1,
          }}
          title="Fechar resumo"
        >
          ✕
        </button>
      </div>
      <div
        className="dockNote"
        style={{ lineHeight: isMobile ? 1.25 : 1.4, marginTop: isMobile ? 2 : 6, fontSize: isMobile ? 9 : undefined }}
      >
        <div style={{ fontSize: isMobile ? 11 : 13, marginBottom: isMobile ? 3 : 4 }}>
          <strong>{loading ? title : `${title} - Total: ${total}`}</strong>
        </div>
        {loading ? (
          <div className="summaryLoadingRow" style={{ marginTop: isMobile ? 6 : 8 }}>
            <span className="summaryLoadingSpinner" aria-hidden="true" />
            <span>{loadingText}</span>
          </div>
        ) : (
          <>
            {isMobile ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "2px 8px",
                  fontSize: 9,
                }}
              >
                {items.map((item) => (
                  <div key={item.label}>
                    {item.label}: {item.value}
                  </div>
                ))}
              </div>
            ) : (
              items.map((item) => (
                <div key={item.label}>
                  {item.label}: {item.value}
                </div>
              ))
            )}
            <div style={{ marginTop: isMobile ? 6 : 10 }}>
              <button
                className="btnGhost"
                onClick={onDownload}
                disabled={!canRequest || reportLoading}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  minHeight: isMobile ? 30 : undefined,
                  padding: isMobile ? "6px 8px" : undefined,
                  fontSize: isMobile ? 11 : undefined,
                  opacity: !canRequest || reportLoading ? 0.7 : 1,
                }}
              >
                {reportLoading ? "Gerando PDF..." : "Baixar PDF"}
              </button>
              {reportMsg && (
                <div style={{ marginTop: 6, fontSize: 10, color: "rgba(15,23,42,0.8)" }}>
                  {reportMsg}
                </div>
              )}
              {!canRequest && (
                <div style={{ marginTop: 6, fontSize: 10, color: "rgba(15,23,42,0.72)" }}>
                  {hasAuthorizedReportLayers
                    ? "Ative pelo menos uma camada para incluir neste relatório."
                    : "Nenhuma camada autorizada para incluir neste relatório."}
                </div>
              )}
            </div>
            {isMobile ? (
              <div style={{ marginTop: 6, fontSize: 8.5, lineHeight: 1.2, color: "rgba(15,23,42,0.72)" }}>
                * O total pode não refletir pontos únicos no mapa.
              </div>
            ) : (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 4,
                  fontSize: 9,
                  lineHeight: 1.35,
                  color: "rgba(15,23,42,0.75)",
                }}
              >
                <span
                  title="Alguns equipamentos podem compartilhar a mesma coordenada."
                  style={{
                    display: "inline-block",
                    marginTop: 1,
                    fontWeight: 900,
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  *
                </span>
                <div>
                  Podem existir câmeras, radares, LPR e Super Câmeras Inteligentes na mesma coordenada.
                  <br />
                  Por isso, o total pode não refletir pontos únicos no mapa.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderCivitasPanel = () => {
    const civitasToolIcons = [
      civitasDetectionIcon,
      civitasRadarIcon,
      civitasJointPlatesIcon,
      civitasCorrelatesIcon,
      civitasMediaIcon,
    ] as const;

    return (
      <div className="civitasPanelLayout">
        <div ref={civitasScrollRef} className="civitasPanelScroll">
          <header ref={civitasHeroRef} className="civitasHero">
            <div className="civitasHeroText">
              <div className="civitasHeroTitle">{civitasPanelTitle}</div>
              <div className="civitasHeroSubtitle">{civitasPanelSubtitle}</div>
            </div>
            <div className="civitasHeroActions">
              <a href={civitasContactWhatsappHref} className="civitasActionBtn civitasActionBtnGhost">
                <span className="civitasActionBtnIcon">
                  <img src={civitasWhatsappIcon} alt="" className="civitasActionBtnIconImg" />
                </span>
                Entrar em contato
              </a>
              <a href={civitasModelPdfHref} download className="civitasActionBtn civitasActionBtnPrimary">
                <span className="civitasActionBtnIcon">
                  <img src={civitasDownloadIcon} alt="" className="civitasActionBtnIconImg" />
                </span>
                Modelo de ofício (PDF)
              </a>
            </div>
          </header>

          <section className="civitasSection">
            <div className="civitasSectionTitle">
              <span className="civitasSectionBar" />
              Resumo das ferramentas da CIVITAS
            </div>

            {!isMobile ? (
              <div className="civitasSummaryList">
                {civitasToolsSummary.map((row, idx) => {
                  const toolIcon = civitasToolIcons[idx] ?? civitasDetectionIcon;
                  return (
                    <article key={row.tool} className="civitasSummaryRow">
                      <div className="civitasSummaryCol civitasSummaryToolCol">
                        <div className="civitasSummaryLabel">Ferramenta</div>
                        <div className="civitasSummaryToolLine">
                          <span className="civitasSummaryToolIcon">
                            <img src={toolIcon} alt="" className="civitasSummaryToolIconImg" />
                          </span>
                          <div className="civitasSummaryToolName">{row.tool}</div>
                        </div>
                      </div>
                      <div className="civitasSummaryCol">
                        <div className="civitasSummaryLabel">O que é</div>
                        <div className="civitasSummaryText">{row.what}</div>
                      </div>
                      <div className="civitasSummaryCol">
                        <div className="civitasSummaryLabel">Quando utilizar</div>
                        <div className="civitasSummaryText">{row.when}</div>
                      </div>
                      <div className="civitasSummaryCol">
                        <div className="civitasSummaryLabel">Resultado</div>
                        <div className="civitasSummaryText">{row.result}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="civitasSummaryMobileList">
                {civitasToolsSummary.map((row, idx) => {
                  const toolIcon = civitasToolIcons[idx] ?? civitasDetectionIcon;
                  return (
                    <article key={row.tool} className="civitasSummaryMobileCard">
                      <div className="civitasSummaryToolLine">
                        <span className="civitasSummaryToolIcon">
                          <img src={toolIcon} alt="" className="civitasSummaryToolIconImg" />
                        </span>
                        <div className="civitasSummaryToolName">{row.tool}</div>
                      </div>
                      <div className="civitasSummaryMobileBlock">
                        <div className="civitasSummaryLabel">O que é</div>
                        <div className="civitasSummaryText">{row.what}</div>
                      </div>
                      <div className="civitasSummaryMobileBlock">
                        <div className="civitasSummaryLabel">Quando utilizar</div>
                        <div className="civitasSummaryText">{row.when}</div>
                      </div>
                      <div className="civitasSummaryMobileBlock">
                        <div className="civitasSummaryLabel">Resultado</div>
                        <div className="civitasSummaryText">{row.result}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="civitasGuide">
            <div className="civitasGuideTitleRow">
              <span className="civitasGuideBadge">
                <img src={civitasInfoIcon} alt="" className="civitasGuideBadgeIcon" />
              </span>
              <div className="civitasGuideTitle">Como solicitar o uso das funcionalidades da CIVITAS</div>
            </div>
            <p className="civitasGuideText">
              Para usufruir das funcionalidades disponíveis no App CIVITAS e dos relatórios analíticos associados ao cerco
              eletrônico, a solicitação deve ser iniciada formalmente por meio de ofício, conforme previsto em lei,{" "}
              <a
                href="https://leis.org/municipais/rj/rio-de-janeiro/lei/decreto/2026/57481/decreto-n-57481-2026-dispoe-sobre-o-compartilhamento-tratamento-e-protecao-de-dados-e-imagens-no-ambito-da-central-de-inteligencia-vigilancia-e-tecnologia-de-apoio-a-seguranca-publica-civitas-e-da-outras-providencias"
                target="_blank"
                rel="noreferrer"
              >
                DECRETO RIO Nº 57.481, DE 12 DE JANEIRO DE 2026
              </a>
              .
            </p>

            <div className="civitasGuideRequirements">
              <div className="civitasGuideRequirementsTitle">Requisitos para a solicitação</div>
              <ul className="civitasGuideList">
                <li>
                  As solicitações devem ser encaminhadas por <strong>ofício eletrônico</strong>, assinado digitalmente pela
                  autoridade competente do órgão.
                </li>
                <li>
                Enviar ao endereço:{" "}
                  <a href={civitasContactEmailHref} style={{ fontWeight: 800 }}>
                    {civitasContactEmail}
                  </a>
                  .
                </li>
                <li>O documento deve conter: número e data do ofício, identificação do órgão requerente.</li>
                <li>Contatos do ponto focal responsável (e-mail e telefone).</li>
                <li>
                  Descrição objetiva da informação solicitada, incluindo local, data, horário, dinâmica e demais elementos
                  relevantes para análise.
                </li>
              </ul>
            </div>
          </section>
        </div>
        <div ref={civitasScrollRailRef} className="civitasScrollRail" aria-hidden="true">
          <div ref={civitasScrollThumbRef} className="civitasScrollThumb" />
        </div>
      </div>
    );
  };

  return (
    <div className={`mapRoot ${panelOpen || mobileMenuOpen ? "menuOpen" : ""}`}>
      <div
        ref={mapContainerRef}
        onClick={() => {
          if (panel !== null) setPanel(null);
          if (panelOpen) setPanelOpen(false);
          if (mobileMenuOpen) setMobileMenuOpen(false);
          if (mobileSearchOpen) setMobileSearchOpen(false);
        }}
        style={{ position: "absolute", inset: 0, background: "#0b0b0f" }}
      />

      {!MAPBOX_TOKEN && (
        <div
          className="glassStrong"
          style={{
            position: "absolute",
            inset: 16,
            display: "grid",
            placeItems: "center",
            color: "#111",
            padding: 18,
            zIndex: 30,
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>
              Falta o Mapbox token.
            </div>
            <div style={{ opacity: 0.85, lineHeight: 1.4 }}>
              Coloque <span className="kbd">VITE_MAPBOX_TOKEN</span> no{" "}
              <span className="kbd">.env</span> e reinicie{" "}
              <span className="kbd">npm run dev</span>.
            </div>
          </div>
        </div>
      )}

      {/* DOCK */}
      <div
        className="dockWrap"
        style={
          isMobile
            ? {
                display: mobileMenuOpen ? "none" : undefined,
                flexDirection: "column",
                alignItems: "stretch",
              }
            : undefined
        }
        onMouseEnter={() => {
          if (isMobile) return;
          setDockOpen(true);
          bumpDockAutoHide();
        }}
        onMouseMove={() => {
          if (isMobile) return;
          bumpDockAutoHide();
        }}
      >
        {showBairros &&
          canExtractBairroData &&
          selectedBairro &&
          selectedBairroStats &&
          renderGeometrySummaryCard({
            title: selectedBairro,
            total: selectedBairroTotal,
            items: bairroSummaryItems,
            onClose: () => {
              setSelectedBairro("");
              setBairroReportMsg(null);
            },
            onDownload: downloadBairroReport,
            reportLoading: bairroReportLoading,
            reportMsg: bairroReportMsg,
            canRequest: canRequestBairroReport,
          })}

        {selectedSecurityArea &&
          (selectedSecuritySummaryLoading || selectedSecurityStats) &&
          renderGeometrySummaryCard({
            title: selectedSecurityAreaLabel,
            total: selectedSecurityTotal,
            items: selectedSecuritySummaryItems,
            onClose: clearSelectedSecurityArea,
            onDownload: downloadSecurityAreaReport,
            reportLoading: securityAreaReportLoading,
            reportMsg: securityAreaReportMsg,
            canRequest: canRequestSecurityAreaReport,
            loading: selectedSecuritySummaryLoading,
            loadingText:
              selectedSecurityArea.kind === "risp"
                ? "Carregando resumo da RISP..."
                : "Carregando resumo...",
          })}

        {!dockOpen && (
          <div
            className="dockHandle"
            title="Abrir camadas"
            onClick={() => {
              setDockOpen(true);
              bumpDockAutoHide();
            }}
          >
            CAMADAS
          </div>
        )}

        {dockOpen && (
          <>
            <div className="dock">
              <div className="dockSectionLabel">Base do mapa</div>
              <div className="dockBase">
                <div className="dockBaseToggle">
                  <button
                    type="button"
                    className={`dockBaseOption ${mapBaseStyle === "streets" ? "dockBaseOptionActive" : ""}`}
                    onClick={() => switchMapBaseStyle("streets")}
                    aria-pressed={mapBaseStyle === "streets"}
                  >
                    <span className="dockBaseIcon" aria-hidden="true">
                      <MapPinned size={15} strokeWidth={2.1} />
                    </span>
                    <span className="dockBaseText">
                      <span className="dockBaseTextMain">Mapa</span>
                      <span className="dockBaseTextSub">Visual escuro</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`dockBaseOption ${mapBaseStyle === "satellite" ? "dockBaseOptionActive" : ""}`}
                    onClick={() => switchMapBaseStyle("satellite")}
                    aria-pressed={mapBaseStyle === "satellite"}
                  >
                    <span className="dockBaseIcon" aria-hidden="true">
                      <Satellite size={15} strokeWidth={2.1} />
                    </span>
                    <span className="dockBaseText">
                      <span className="dockBaseTextMain">Satélite</span>
                      <span className="dockBaseTextSub">Imagem aérea</span>
                    </span>
                  </button>
                </div>
              </div>

              <div className="dockDivider" />
              <div className="dockTitle">Camadas</div>

            {canViewCameras && (
              <button
                className={`dockChip ${showCameras ? "dockChipOn" : ""}`}
                onClick={() => {
                  setShowCameras((v) => !v);
                  bumpDockAutoHide();
                }}
                title={showCameras ? "Câmeras ON" : "Câmeras OFF"}
              >
                <span className="chipLeft">
                  <span className="chipIcon">
                    <img src={cameraIconSatellite} alt="" />
                  </span>
                  <span className="chipText">
                    <span>Câmeras</span>
                    <span className="chipLegend">Gravação de imagens</span>
                  </span>
                  <span className="chipDot" style={{ background: showCameras ? "#22c55e" : "#9ca3af" }} />
                </span>
                <span className="chipState">{showCameras ? "ON" : "OFF"}</span>
              </button>
            )}

            {canViewCamerasIntel && (
              <button
                className={`dockChip ${showCamerasIntel ? "dockChipOn" : ""}`}
                onClick={() => {
                  setShowCamerasIntel((v) => !v);
                  bumpDockAutoHide();
                }}
                title={showCamerasIntel ? "Inteligentes ON" : "Inteligentes OFF"}
              >
                <span className="chipLeft">
                  <span className="chipIcon">
                    <img src={cameraIntelIconSatellite} alt="" />
                  </span>
                  <span className="chipText">
                    <span>Super Câmeras Inteligentes</span>
                    <span className="chipLegend">Gravações e analíticos de IA</span>
                  </span>
                  <span className="chipDot" style={{ background: showCamerasIntel ? "#22c55e" : "#9ca3af" }} />
                </span>
                <span className="chipState">{showCamerasIntel ? "ON" : "OFF"}</span>
              </button>
            )}

            {canViewCamerasLpr && (
              <button
                className={`dockChip ${showCamerasLpr ? "dockChipOn" : ""}`}
                onClick={() => {
                  setShowCamerasLpr((v) => !v);
                  bumpDockAutoHide();
                }}
                title={showCamerasLpr ? "LPR ON" : "LPR OFF"}
              >
                <span className="chipLeft">
                  <span className="chipIcon">
                    <img src={cameraLprIcon} alt="" />
                  </span>
                  <span className="chipText">
                    <span>LPR</span>
                    <span className="chipLegend">Leitura de radar</span>
                  </span>
                  <span className="chipDot" style={{ background: showCamerasLpr ? "#22c55e" : "#9ca3af" }} />
                </span>
                <span className="chipState">{showCamerasLpr ? "ON" : "OFF"}</span>
              </button>
            )}

            {canViewRadares && (
              <button
                className={`dockChip ${showRadares ? "dockChipOn" : ""}`}
                onClick={() => {
                  setShowRadares((v) => !v);
                  bumpDockAutoHide();
                }}
                title={showRadares ? "Radares ON" : "Radares OFF"}
              >
                <span className="chipLeft">
                  <span className="chipIcon">
                    <img src={radarIcon} alt="" />
                  </span>
                  <span className="chipText">
                    <span>Radares</span>
                    <span className="chipLegend">Leitura de radar</span>
                  </span>
                  <span className="chipDot" style={{ background: showRadares ? "#22c55e" : "#9ca3af" }} />
                </span>
                <span className="chipState">{showRadares ? "ON" : "OFF"}</span>
              </button>
            )}

            {canViewBairros && (
              <button
                className={`dockChip ${showBairros ? "dockChipOn" : ""}`}
                onClick={() => {
                  setShowBairros((prev) => {
                    const next = !prev;
                    if (next) {
                      setSelectedBairro("");
                      setBairroQuery("");
                      setBairroReportMsg(null);
                    }
                    return next;
                  });
                  bumpDockAutoHide();
                }}
                title={showBairros ? "Bairros ON" : "Bairros OFF"}
              >
                <span className="chipLeft">
                  <span className="chipIcon" aria-hidden="true">
                    <Building2 size={15} strokeWidth={2.1} />
                  </span>
                  <span>Bairros</span>
                  <span className="chipDot" style={{ background: showBairros ? "#22c55e" : "#9ca3af" }} />
                </span>
                <span className="chipState">{showBairros ? "ON" : "OFF"}</span>
              </button>
            )}

            {canViewBairros && showBairros && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: "rgba(0,0,0,0.65)" }}>
                  Buscar bairro
                </label>
                <input
                  value={bairroQuery}
                  onChange={(e) => setBairroQuery(e.target.value)}
                  placeholder="Digite para buscar..."
                  style={{ ...inputStyle(), padding: "8px 10px", borderRadius: 12 }}
                />
                <div
                  className="scrollbarHidden"
                  style={{
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.85)",
                    maxHeight: 180,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: 6,
                  }}
                >
                  <button
                    className="btnGhost"
                    onClick={() => {
                      setSelectedBairro("");
                    }}
                    style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      borderRadius: 10,
                      fontWeight: 800,
                      background: selectedBairro ? "transparent" : "rgba(0,0,0,0.08)",
                    }}
                  >
                    Todos os bairros
                  </button>
                  {bairrosFiltered.length === 0 && (
                    <div className="dockNote" style={{ padding: "4px 6px" }}>
                      Nenhum bairro encontrado
                    </div>
                  )}
                  {bairrosFiltered.map((nome) => (
                    <button
                      key={nome}
                      className="btnGhost"
                      onClick={() => {
                        setSelectedBairro(nome);
                        setBairroQuery("");
                      }}
                      style={{
                        textAlign: "left",
                        padding: "6px 8px",
                        borderRadius: 10,
                        fontWeight: 800,
                        background: selectedBairro === nome ? "rgba(0,0,0,0.08)" : "transparent",
                      }}
                    >
                      {nome}
                    </button>
                  ))}
                </div>
                {bairrosGeo?.features?.length ? (
                  <div className="dockNote">Bairros carregados: {bairrosGeo.features.length}</div>
                ) : null}
                {loadingBairros && <div className="dockNote">Carregando bairros...</div>}
                {bairrosErr && <div className="dockNote">{bairrosErr}</div>}
                {!canExtractBairroData && selectedBairro && (
                  <div className="dockNote">
                    Esta camada exibe somente o contorno do bairro, sem resumo e sem download de PDF.
                  </div>
                )}
              </div>
            )}

            {canUseAreaDraw && (
              <button
                className="dockChip"
                onClick={() => {
                  if (areaDrawMode) {
                    setAreaDrawMode(false);
                    areaDrawPolygonsRef.current = [];
                    setAreaDrawPoints([]);
                    setAreaDrawPolygons([]);
                    setAreaToolsOpen(false);
                    setAreaReportMsg(null);
                    return;
                  }
                  setAreaToolsOpen(true);
                  setAreaDrawMode(true);
                  setAreaReportMsg(null);
                }}
                title="Desenhar área"
              >
                <span className="chipLeft">
                  <span className="chipIcon" aria-hidden="true">
                    <PenTool size={15} strokeWidth={2.1} />
                  </span>
                  <span className="chipText">
                    <span>Desenhar área</span>
                    <span className="chipLegend">Abrir relatório por área</span>
                  </span>
                  <span className="chipDot" style={{ background: areaDrawMode ? "#22c55e" : "#9ca3af" }} />
                </span>
                <span className="chipState">{areaDrawMode ? "ON" : "OFF"}</span>
              </button>
            )}

            {canUseAreaDraw && areaToolsOpen && (
              <div
                style={{
                  marginTop: 6,
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.85)",
                  padding: 8,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.8)" }}>
                    Relatório por Área Desenhada
                  </div>
                </div>
                <div className="dockNote" style={{ margin: 0 }}>
                  Polígonos: {totalAreaPolygonCount} • Pontos: {totalAreaPointCount}
                </div>
                <div className="dockNote" style={{ margin: 0 }}>
                  Polígono em edição: {areaDrawPoints.length} ponto(s)
                </div>
                {areaDrawPoints.length >= 3 && areaDrawMode && (
                  <div className="dockNote" style={{ margin: 0, fontSize: 10 }}>
                    Clique fora da área para expandir pelo trecho de borda mais próximo.
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <button
                    className="btnGhost"
                    onClick={toggleAreaDrawing}
                    style={{
                      borderRadius: 10,
                      fontWeight: 800,
                      background: areaDrawMode ? "rgba(239, 68, 68, 0.16)" : undefined,
                      borderColor: areaDrawMode ? "rgba(239, 68, 68, 0.35)" : undefined,
                      color: areaDrawMode ? "#b91c1c" : undefined,
                    }}
                  >
                    {areaDrawMode ? "Parar desenho" : "Desenhar área"}
                  </button>
                  <button
                    className="btnGhost"
                    onClick={removeLastAreaPoint}
                    disabled={areaDrawPoints.length === 0 || areaReportLoading}
                    style={{ borderRadius: 10, opacity: areaDrawPoints.length === 0 || areaReportLoading ? 0.5 : 1 }}
                  >
                    Desfazer ponto
                  </button>
                  <button
                    className="btnGhost"
                    onClick={finalizeCurrentAreaPolygon}
                    disabled={areaDrawPoints.length < 3 || areaReportLoading}
                    style={{
                      borderRadius: 10,
                      opacity: areaDrawPoints.length < 3 || areaReportLoading ? 0.5 : 1,
                      background: "rgba(34, 197, 94, 0.14)",
                      borderColor: "rgba(34, 197, 94, 0.32)",
                      color: "#166534",
                    }}
                  >
                    Novo polígono
                  </button>
                  <button
                    className="btnGhost"
                    onClick={clearAreaDrawing}
                    disabled={(areaDrawPoints.length === 0 && areaDrawPolygons.length === 0) || areaReportLoading}
                    style={{
                      borderRadius: 10,
                      opacity:
                        (areaDrawPoints.length === 0 && areaDrawPolygons.length === 0) || areaReportLoading ? 0.5 : 1,
                    }}
                  >
                    Limpar tudo
                  </button>
                  <button
                    className="btnGhost"
                    onClick={downloadAreaReport}
                    disabled={!canRequestAreaReport || totalAreaPolygonCount === 0 || areaReportLoading}
                    style={{
                      borderRadius: 10,
                      opacity: !canRequestAreaReport || totalAreaPolygonCount === 0 || areaReportLoading ? 0.5 : 1,
                      background: "rgba(56, 189, 248, 0.16)",
                      borderColor: "rgba(56, 189, 248, 0.35)",
                      color: "#075985",
                    }}
                  >
                    {areaReportLoading ? "Gerando..." : "Baixar PDF"}
                  </button>
                </div>
                {areaReportMsg && (
                  <div className="dockNote" style={{ margin: 0, fontSize: 10 }}>
                    {areaReportMsg}
                  </div>
                )}
                {!canRequestAreaReport && (
                  <div className="dockNote" style={{ margin: 0, fontSize: 10 }}>
                    {hasAuthorizedReportLayers
                      ? "Ative pelo menos uma camada para incluir neste relatório."
                      : "Nenhuma camada autorizada para incluir neste relatório."}
                  </div>
                )}
              </div>
            )}

            {canViewRisp && (
              <button
                className={`dockChip ${showRisp ? "dockChipOn" : ""}`}
                onClick={() => {
                  setShowRisp((v) => {
                    const next = !v;
                    if (next) {
                      setShowAisp(false);
                      setShowCisp(false);
                    }
                    return next;
                  });
                  bumpDockAutoHide();
                }}
                title={showRisp ? "RISP ON" : "RISP OFF"}
              >
                <span className="chipLeft">
                  <span className="chipIcon" aria-hidden="true">
                    <Shield size={15} strokeWidth={2.1} />
                  </span>
                  <span className="chipText">
                    <span>RISP</span>
                    <span className="chipLegend">Regiões Integradas de Segurança Pública</span>
                  </span>
                  <span className="chipDot" style={{ background: showRisp ? "#22c55e" : "#9ca3af" }} />
                </span>
                <span className="chipState">{showRisp ? "ON" : "OFF"}</span>
              </button>
            )}
            {canViewRisp && showRisp && multiCodeWarnings.risp.length > 0 && (
              <div className="dockNote">
                Aviso: {multiCodeWarnings.risp.length} bairros com mais de uma RISP não foram coloridos. Ex.:{" "}
                {multiCodeWarnings.risp.slice(0, 4).join(", ")}
              </div>
            )}

            {canViewAisp && (
              <button
                className={`dockChip ${showAisp ? "dockChipOn" : ""}`}
                onClick={() => {
                  setShowAisp((v) => {
                    const next = !v;
                    if (next) {
                      setShowRisp(false);
                      setShowCisp(false);
                    }
                    return next;
                  });
                  bumpDockAutoHide();
                }}
                title={showAisp ? "AISP ON" : "AISP OFF"}
              >
                <span className="chipLeft">
                  <span className="chipIcon" aria-hidden="true">
                    <ShieldAlert size={15} strokeWidth={2.1} />
                  </span>
                  <span className="chipText">
                    <span>AISP</span>
                    <span className="chipLegend">Áreas Integradas de Segurança Pública</span>
                  </span>
                  <span className="chipDot" style={{ background: showAisp ? "#22c55e" : "#9ca3af" }} />
                </span>
                <span className="chipState">{showAisp ? "ON" : "OFF"}</span>
              </button>
            )}
            {canViewAisp && showAisp && multiCodeWarnings.aisp.length > 0 && (
              <div className="dockNote">
                Aviso: {multiCodeWarnings.aisp.length} bairros com mais de uma AISP não foram coloridos. Ex.:{" "}
                {multiCodeWarnings.aisp.slice(0, 4).join(", ")}
              </div>
            )}

            {canViewCisp && (
              <button
                className={`dockChip ${showCisp ? "dockChipOn" : ""}`}
                onClick={() => {
                  setShowCisp((v) => {
                    const next = !v;
                    if (next) {
                      setShowRisp(false);
                      setShowAisp(false);
                    }
                    return next;
                  });
                  bumpDockAutoHide();
                }}
                title={showCisp ? "CISP ON" : "CISP OFF"}
              >
                <span className="chipLeft">
                  <span className="chipIcon" aria-hidden="true">
                    <ShieldCheck size={15} strokeWidth={2.1} />
                  </span>
                  <span className="chipText">
                    <span>CISP</span>
                    <span className="chipLegend">Circunscrições Integradas de Segurança Pública</span>
                  </span>
                  <span className="chipDot" style={{ background: showCisp ? "#22c55e" : "#9ca3af" }} />
                </span>
                <span className="chipState">{showCisp ? "ON" : "OFF"}</span>
              </button>
            )}
            {canViewCisp && showCisp && multiCodeWarnings.cisp.length > 0 && (
              <div className="dockNote">
                Aviso: {multiCodeWarnings.cisp.length} bairros com mais de uma CISP não foram coloridos. Ex.:{" "}
                {multiCodeWarnings.cisp.slice(0, 4).join(", ")}
              </div>
            )}

            {canUseGps && (
              <button
                className={`dockChip ${gpsOn ? "dockChipOn" : ""} ${gpsErr ? "dockChipDisabled" : ""}`}
                onClick={() => {
                  if (gpsErr) return;
                  toggleGps();
                }}
                title={gpsOn ? "GPS ON" : "GPS OFF"}
              >
                <span className="chipLeft">
                  <span className="chipIcon">
                    <img src={mapPinRed} alt="" />
                  </span>
                  <span>GPS</span>
                  <span
                    className={`chipDot ${gpsOn ? "gpsPulse" : ""}`}
                    style={{ background: gpsOn ? "#22c55e" : "#9ca3af" }}
                  />
                </span>
                <span className="chipState">{gpsOn ? "ON" : "OFF"}</span>
              </button>
            )}

            {canUseGps && gpsOn && gps && !gpsErr && (
              <button
                className="dockCenterBtn"
                onClick={() => {
                  flyToPoint(gps.lng, gps.lat, 16);
                  bumpDockAutoHide();
                }}
                title="Centralizar no GPS"
              >
                Centralizar GPS
              </button>
            )}

            {canUseGps && gpsErr && <div className="dockNote">GPS com erro</div>}

            <div className="dockDivider" />

            <button
              className="btnGhost"
              onClick={() => setDockOpen(false)}
              style={{ borderRadius: 999, padding: "8px 10px" }}
              title="Esconder"
            >
              Esconder
            </button>
          </div>
          </>
        )}
      </div>

      {/* Header (desktop) */}
      <div
        className="desktopPanels"
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "#0b0b0f",
        }}
      >
        <div
          className="glass"
          style={{
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            width: 160,
            height: 50,
          }}
        >
          <img src={civitasLogo} alt="Civitas" style={{ height: 34, width: 145 }} />
        </div>

        <div
          className="glass"
          style={{
            flex: 1,
            padding: "0 10px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            height: 53,
          }}
        >
          <button
            className={`tabBtn ${panel === "map" ? "tabBtnActive" : ""}`}
            onClick={() => togglePanel("map")}
            title="Clique de novo pra fechar"
          >
            CENTRAL
          </button>

          <button
            className={`tabBtn ${panel === "profile" ? "tabBtnActive" : ""}`}
            onClick={() => togglePanel("profile")}
            title="Clique de novo pra fechar"
          >
            PERFIL
          </button>

          {canAccessAdmin && (
            <button
              className={`tabBtn ${panel === "admin" ? "tabBtnActive" : ""}`}
              onClick={() => togglePanel("admin")}
              title="Clique de novo pra fechar"
            >
              {developmentTabLabel}
            </button>
          )}

          <div style={{ flex: 1 }} />

          <button
            type="button"
            className="civitasSearchBtn"
            onClick={() => togglePanel("civitas")}
            title={panel === "civitas" ? "Fechar CIVITAS" : "Abrir CIVITAS"}
          >
            {civitasTabLabel}
          </button>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap", minWidth: 0 }}>
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchErr(null);
                setSearchQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearch();
              }}
              placeholder="Buscar rua ou coordenadas no RJ"
              style={{ ...inputStyle(), flex: "1 1 240px", minWidth: 240, maxWidth: 320, padding: "8px 10px" }}
            />
            <button className="btnGhost" onClick={() => void handleSearch()} title="Buscar">
              BUSCAR
            </button>
          </div>
          {searchErr && <div style={{ fontSize: 11, color: "#991b1b" }}>{searchErr}</div>}
        </div>

        <div
          className="glass"
          style={{
            padding: "0 8px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 50
          }}
        >
          <div style={{ width: 72, height: 48, display: "grid", placeItems: "center" }}>
            <img src={prefeituraLogo} alt="Prefeitura" style={{ height: 28, width: "auto" }} />
          </div>
          <button
            className="btnGhost"
            onClick={() => {
              auth?.logout?.();
              try {
                nav("/login", { replace: true });
              } catch {
                window.location.href = "/login";
              }
            }}
          >
            SAIR
          </button>
        </div>
      </div>

      {/* LEFT PANEL (desktop) */}
      {panel !== null && (
        <div
          className={`desktopPanels ${panel === "civitas" ? "" : "panelCard"}`.trim()}
          style={{
            position: "absolute",
            top: 90,
            left: panelSideInset + panelShiftRight,
            width: panelWidth,
            maxWidth: `calc(100vw - ${panelSideInset * 2}px)`,
            zIndex: 20,
            padding: panel === "civitas" ? 0 : 14,
            color: "#0b0b0f",
            marginLeft: 0,
          }}
        >
          {panel === "map" && (
            <>
              <div style={{ marginBottom: 12, display: "grid", gap: 12 }}>
                <div className="tabsRail scrollbarHidden" style={{ flexWrap: "nowrap", overflowX: "auto" }}>
                  {availableListModes.map((option) => (
                    <button
                      key={option.mode}
                      className={`subTab ${listMode === option.mode ? "subTabActive" : ""}`}
                      onClick={() => setListMode(option.mode)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="panelTitle">{listHeaderLabel}</div>
              </div>

              <div className="panelSearch">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      listMode === "cameras"
                        ? "Buscar por nome, código, cidade, endereço..."
                        : listMode === "inteligentes"
                        ? "Buscar por nome, código, IP, direção (super)..."
                        : listMode === "lpr"
                        ? "Buscar por nome, código, IP, direção..."
                        : "Buscar por código, bairro, local e sentido..."
                    }
                  style={inputStyle()}
                />
                <button
                  onClick={() => setQuery("")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: "rgba(255,255,255,0.95)",
                    cursor: "pointer",
                    fontWeight: 900,
                    color: "rgba(0,0,0,0.85)",
                  }}
                  title="Limpar"
                >
                  ✕
                </button>
              </div>

              <div
                key={listMode}
                ref={listScrollRef}
                className="scrollbarHidden"
                style={{ display: "grid", gap: 10, maxHeight: panelMaxHeight, overflow: "auto" }}
                onScroll={(e) => {
                  if (isMobile) return;
                  const el = e.currentTarget;
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
                    if (page < totalPages) triggerPagePulse();
                  }
                }}
              >
                {listMode === "cameras" &&
                  (listItems as Camera[]).map((c) => {
                    const iconSrc = getPoiIconSource(mapBaseStyle, "camera");
                    const streamUrl = normalizeExternalUrl((c as any).streaming_url ?? c.stream_url ?? "");
                    return (
                      <div
                        key={c.code}
                        className="listItem"
                        onClick={() => {
                          setSelectedCode(c.code);
                          setSelectedRadar(null);
                          focusOnDetection(c.lng, c.lat);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={getPoiListIconBubbleStyle("camera")}>
                            <img src={iconSrc} alt="" style={getPoiListIconStyle()} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                              <div
                                style={{
                                  fontWeight: 900,
                                  fontSize: 13,
                                  whiteSpace: "normal",
                                  overflow: "visible",
                                  textOverflow: "clip",
                                  wordBreak: "break-word",
                                }}
                              >
                                {c.name}
                              </div>
                              <span
                                style={getPoiCodePillStyle("camera")}
                              >
                                {c.code}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                                {String((c as any).zona_camera ?? (c as any).zone ?? "").trim() ||
                                  [c.city, c.uf].filter(Boolean).join(" - ") ||
                                  "-"}
                              </span>
                              {hasStreamingAccess && streamUrl && c.id && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void openCommonCameraStreamWindow(c.id || "", 0);
                                  }}
                                  className="listStreamPill listStreamPill--camera"
                                >
                                  Abrir streaming
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {listMode === "inteligentes" &&
                  (listItems as CameraIntel[]).map((c) => {
                    const iconSrc = getPoiIconSource(mapBaseStyle, "camera_intel");
                    const smartId = cleanString(c.id);
                    const showSmartStreamButton =
                      hasSmartCameraStreamingAccess && Boolean(smartId) && !Boolean(smartId && unavailableSmartCameraIds[smartId]);
                    return (
                      <div
                        key={smartId || c.code}
                        className="listItem"
                        onClick={() => {
                          setSelectedCode(null);
                          setSelectedRadar(null);
                          focusOnDetection(c.lng, c.lat);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={getPoiListIconBubbleStyle("camera_intel")}>
                            <img src={iconSrc} alt="" style={getPoiListIconStyle()} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                              <div
                                style={{
                                  fontWeight: 900,
                                  fontSize: 13,
                                  whiteSpace: "normal",
                                  overflow: "visible",
                                  textOverflow: "clip",
                                  wordBreak: "break-word",
                                }}
                              >
                                {c.name}
                              </div>
                              <span style={getPoiCodePillStyle("camera_intel")}>{c.code}</span>
                            </div>
                              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    opacity: 0.8,
                                  border: "1px solid rgba(15,23,42,0.14)",
                                  borderRadius: 999,
                                  padding: "2px 8px",
                                }}
                                >
                                  Responsável: {c.responsavel || (c as any).responsavel || "-"}
                                </span>
                                {showSmartStreamButton && (
                                  <button
                                    type="button"
                                    className="listStreamPill listStreamPill--smart"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      void openSmartCameraStreamWindow(c, SMART_CAMERA_STREAM_DURATION_SECONDS);
                                    }}
                                    title="Abrir streaming completo"
                                  >
                                    Abrir streaming
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                    );
                  })}

                {listMode === "lpr" &&
                  (listItems as CameraLpr[]).map((c) => {
                    const iconSrc = getPoiIconSource(mapBaseStyle, "camera_lpr");
                    return (
                      <div
                        key={getPointCollectionKey(c) || c.code}
                        className="listItem"
                        onClick={() => {
                          setSelectedCode(null);
                          setSelectedRadar(null);
                          focusOnDetection(c.lng, c.lat);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={getPoiListIconBubbleStyle("camera_lpr")}>
                            <img src={iconSrc} alt="" style={getPoiListIconStyle()} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                              <div
                                style={{
                                  fontWeight: 900,
                                  fontSize: 13,
                                  whiteSpace: "normal",
                                  overflow: "visible",
                                  textOverflow: "clip",
                                  wordBreak: "break-word",
                                }}
                              >
                                {getPointCollectionTitle(c) || c.name}
                              </div>
                              <span style={getPoiCodePillStyle("camera_lpr")}>{getPointCollectionCode(c)}</span>
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  opacity: 0.8,
                                  border: "1px solid rgba(15,23,42,0.14)",
                                  borderRadius: 999,
                                  padding: "2px 8px",
                                }}
                              >
                                Local: {getPointCollectionTitle(c) || "-"}
                              </span>
                              <span style={{ fontSize: 11, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                                Bairro: {c.bairro || c.neighborhood || getLprNeighborhood(c) || "-"}
                              </span>
                              <span style={{ fontSize: 11, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                                Sentido: {c.sentido || c.direction || "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {listMode === "radares" &&
                  (listItems as Radar[]).map((r) => {
                    const lat = Number(r.lat ?? r.latitude);
                    const lng = Number(r.lng ?? r.longitude);
                    const ok = Number.isFinite(lat) && Number.isFinite(lng);
                    const iconSrc = getPoiIconSource(mapBaseStyle, "radar");
                    return (
                      <div
                        key={getPointCollectionKey(r) || r.codcet}
                        className="listItem"
                        onClick={() => {
                          if (!ok) return;
                          setSelectedRadar(getPointCollectionKey(r) || r.codcet);
                          setSelectedCode(null);
                          focusOnDetection(lng, lat);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={getPoiListIconBubbleStyle("radar")}>
                            <img src={iconSrc} alt="" style={getPoiListIconStyle()} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                              <div
                                style={{
                                  fontWeight: 900,
                                  fontSize: 13,
                                  whiteSpace: "normal",
                                  overflow: "visible",
                                  textOverflow: "clip",
                                  wordBreak: "break-word",
                                }}
                              >
                                {getPointCollectionTitle(r) || r.logradouro || r.localidade || "Radar"}
                              </div>
                              <span style={getPoiCodePillStyle("radar")}>{getPointCollectionCode(r)}</span>
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                                Local: {r.local || r.logradouro || r.localidade || "-"}
                              </span>
                              <span style={{ fontSize: 11, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                                Bairro: {r.bairro || "-"}
                              </span>
                              <span style={{ fontSize: 11, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                                Sentido: {r.sentido || "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {!filtered.length && (
                  <div style={{ opacity: 0.75, fontSize: 13 }}>
                    {listMode === "cameras"
                      ? "Nenhuma câmera encontrada."
                      : listMode === "inteligentes"
                      ? "Nenhuma Super Câmera Inteligente encontrada."
                      : listMode === "lpr"
                      ? "Nenhuma câmera LPR encontrada."
                      : "Nenhum radar encontrado."}
                  </div>
                )}
              </div>

              {!isMobile && filtered.length > PAGE_SIZE && (
                <div
                  className={`pageControls ${pagePulse ? "pagePulse" : ""}`}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}
                >
                  <button
                    className="btnGhost"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    style={{ opacity: page <= 1 ? 0.5 : 1 }}
                  >
                    Anterior
                  </button>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Página {page} de {totalPages}
                  </div>
                  <button
                    className="btnGhost"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    style={{ opacity: page >= totalPages ? 0.5 : 1 }}
                  >
                    Próxima
                  </button>
                </div>
              )}
            </>
          )}

          {panel === "profile" && (
            <>
              <div
                style={{
                  padding: 12,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.88)",
                  border: "1px solid rgba(10,40,75,0.08)",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    color: "rgba(10,40,75,0.58)",
                    marginBottom: 6,
                  }}
                >
                  PERFIL
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8, color: "#0f172a" }}>Dados do usuário</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(10,40,75,0.58)" }}>Nome</div>
                  <div style={{ fontSize: 13, color: "#0f172a" }}>{me?.full_name || "-"}</div>
                  <div style={{ fontSize: 11, fontWeight: 900, marginTop: 6, color: "rgba(10,40,75,0.58)" }}>Email</div>
                  <div style={{ fontSize: 13, color: "rgba(15,23,42,0.72)" }}>{me?.email || "-"}</div>
                  <div style={{ fontSize: 11, fontWeight: 900, marginTop: 6, color: "rgba(10,40,75,0.58)" }}>Organização</div>
                  <div style={{ fontSize: 13, color: "rgba(15,23,42,0.85)" }}>{auth.organizationName || "-"}</div>
                </div>
              </div>

                <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>Trocar senha</div>
                <div style={{ position: "relative" }}>
                  <input
                    value={pwOld}
                    onChange={(e) => setPwOld(e.target.value)}
                    type={showPwOld ? "text" : "password"}
                    placeholder="Senha atual"
                    style={{ ...inputStyle(), paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwOld((v) => !v)}
                    aria-label={showPwOld ? "Ocultar senha atual" : "Mostrar senha atual"}
                    title={showPwOld ? "Ocultar senha atual" : "Mostrar senha atual"}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: "rgba(0,0,0,0.72)",
                      padding: 0,
                      width: 20,
                      height: 20,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    {showPwOld ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    type={showPwNew ? "text" : "password"}
                    placeholder="Nova senha"
                    style={{ ...inputStyle(), paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwNew((v) => !v)}
                    aria-label={showPwNew ? "Ocultar nova senha" : "Mostrar nova senha"}
                    title={showPwNew ? "Ocultar nova senha" : "Mostrar nova senha"}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: "rgba(0,0,0,0.72)",
                      padding: 0,
                      width: 20,
                      height: 20,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    {showPwNew ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    value={pwNew2}
                    onChange={(e) => setPwNew2(e.target.value)}
                    type={showPwNew2 ? "text" : "password"}
                    placeholder="Confirmar nova senha"
                    style={{ ...inputStyle(), paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwNew2((v) => !v)}
                    aria-label={showPwNew2 ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                    title={showPwNew2 ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: "rgba(0,0,0,0.72)",
                      padding: 0,
                      width: 20,
                      height: 20,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    {showPwNew2 ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>

                <button
                  onClick={changePassword}
                  disabled={pwLoading}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(10,40,75,0.18)",
                    background: "rgba(10,40,75,0.92)",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  {pwLoading ? "Salvando..." : "Salvar nova senha"}
                </button>

                {pwMsg && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.10)",
                      background: "rgba(255,255,255,0.90)",
                      fontSize: 13,
                      color: "rgba(0,0,0,0.85)",
                    }}
                  >
                    {pwMsg}
                  </div>
                )}
              </div>
            </>
          )}

          {panel === "civitas" && renderCivitasPanel()}

          {panel === "admin" && canAccessAdmin && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>Administrador</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Gerenciamento completo
                </div>

                <div style={{ flex: 1 }} />

                <div className="tabsRail tabsRailAdmin">
                  {adminTabOptions.map((option) => (
                    <button
                      key={option.key}
                      className={`subTab ${activeAdminTab === option.key ? "subTabActive" : ""}`}
                      onClick={() => setAdminTab(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="scrollbarHidden"
                style={{
                  maxHeight: panelMaxHeight,
                  overflow: activeAdminTab === "users" && adminUsersOrgOpen ? "visible" : "auto",
                }}
              >
                {activeAdminTab === "users" && (
                  <AdminUsersPanel
                    apiBase={API_BASE}
                    token={accessToken}
                    viewerRole={role}
                    isMobile={isMobile}
                    onOrgDropdownOpenChange={setAdminUsersOrgOpen}
                  />
                )}
                {activeAdminTab === "usage" && (
                  <AdminUsageDashboardPanel apiBase={API_BASE} token={accessToken} isMobile={isMobile} />
                )}
                {activeAdminTab === "organizations" && (
                  <AdminOrganizationsPanel apiBase={API_BASE} token={accessToken} isMobile={isMobile} />
                )}
                {activeAdminTab === "cameras" && (
                  <AdminCamerasPanel
                    apiBase={API_BASE}
                    token={accessToken}
                    onStatusChanged={() => {
                      loadCameras();
                      loadCamerasIntel();
                      loadCamerasLpr();
                    }}
                    isMobile={isMobile}
                  />
                )}
                {activeAdminTab === "radares" && (
                  <AdminRadaresPanel
                    apiBase={API_BASE}
                    token={accessToken}
                    onStatusChanged={() => {
                      loadRadares();
                    }}
                    isMobile={isMobile}
                  />
                )}
                {activeAdminTab === "logs" && <AdminLogsPanel apiBase={API_BASE} token={accessToken} isMobile={isMobile} />}
              </div>
            </>
          )}
        </div>
      )}

      {/* Mobile bar (mantive o seu layout, sem inventar) */}
      <div
        className="mobileBar"
        style={{
          position: "fixed",
          top: "calc(12px + env(safe-area-inset-top))",
          left: "calc(12px + env(safe-area-inset-left))",
          right: "calc(12px + env(safe-area-inset-right))",
          zIndex: 25,
          gap: 10,
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        <div
          className="glass"
          style={{
            width: "100%",
            padding: 0,
            color: "#0b0b0f",
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "space-between",
            height: 56,
            paddingLeft: 10,
            paddingRight: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={civitasLogo} alt="Civitas" style={{ height: 32, width: "auto", maxWidth: 150 }} />
          </div>

          <div style={{ position: "relative" }}>
            <button
              className={`btnGhost mobileMenuTrigger ${mobileMenuOpen ? "mobileMenuTrigger--open" : ""}`}
              onClick={() => {
                if (panelOpen) {
                  setPanelOpen(false);
                  setMobileMenuOpen(true);
                  return;
                }
                setMobileMenuOpen((v) => !v);
              }}
              type="button"
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-quick-menu"
              title={mobileMenuOpen ? "Fechar menu" : "Menu"}
            >
              {mobileMenuOpen ? <X size={18} strokeWidth={2.4} /> : <Menu size={18} strokeWidth={2.4} />}
            </button>

            {mobileMenuOpen && (
              <>
                <button
                  type="button"
                  className="mobileMenuBackdrop"
                  aria-label="Fechar menu"
                  tabIndex={-1}
                  onClick={() => {
                    setMobileMenuOpen(false);
                  }}
                />
                <div className="mobileMenuSheet" id="mobile-quick-menu" role="dialog" aria-modal="true" aria-label="Menu rápido">
                  <div className="mobileMenuHandle" aria-hidden="true" />
                  <div className="mobileMenuHeader">
                    <div className="mobileMenuBrandCopy">
                      <div className="mobileMenuEyebrow">Acesso rápido</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="civitasSearchBtn mobileMenuPrimaryDesktop"
                    onClick={() => {
                      setMobileSearchOpen(false);
                      setMobileMenuOpen(false);
                      setPanel("civitas");
                      setPanelOpen(true);
                    }}
                    title={panel === "civitas" ? "Fechar CIVITAS" : "Abrir CIVITAS"}
                  >
                    {civitasTabLabel}
                  </button>

                  <div className="mobileMenuActions">
                    <button
                      type="button"
                      className="mobileMenuAction"
                      onClick={() => {
                        setMobileSearchOpen(false);
                        setMobileMenuOpen(false);
                        setPanelOpen((v) => !v);
                      }}
                    >
                      <span className="mobileMenuActionIcon">
                        <MapPinned size={16} strokeWidth={2.4} />
                      </span>
                      <span className="mobileMenuActionText">
                        <span className="mobileMenuActionLabel">{panelOpen ? "Fechar menu" : "Menu"}</span>
                        <span className="mobileMenuActionSub">Equipamentos e central de controle</span>
                      </span>
                      <ChevronRight className="mobileMenuActionChevron" size={16} strokeWidth={2.4} />
                    </button>

                    <button
                      type="button"
                      className="mobileMenuAction"
                      onClick={() => {
                        setSearchErr(null);
                        setMobileSearchOpen(true);
                        setMobileMenuOpen(false);
                      }}
                    >
                      <span className="mobileMenuActionIcon">
                        <Search size={16} strokeWidth={2.4} />
                      </span>
                      <span className="mobileMenuActionText">
                        <span className="mobileMenuActionLabel">Buscar local</span>
                        <span className="mobileMenuActionSub">Rua, bairro ou coordenada no mapa</span>
                      </span>
                      <ChevronRight className="mobileMenuActionChevron" size={16} strokeWidth={2.4} />
                    </button>

                    <button
                      type="button"
                      className="mobileMenuAction mobileMenuActionDanger"
                      onClick={() => {
                        setMobileSearchOpen(false);
                        setPanelOpen(false);
                        setMobileMenuOpen(false);
                        auth?.logout?.();
                        try {
                          nav("/login", { replace: true });
                        } catch {
                          window.location.href = "/login";
                        }
                      }}
                    >
                      <span className="mobileMenuActionIcon">
                        <LogOut size={16} strokeWidth={2.4} />
                      </span>
                      <span className="mobileMenuActionText">
                        <span className="mobileMenuActionLabel">Sair</span>
                        <span className="mobileMenuActionSub">Encerrar a sessão com segurança</span>
                      </span>
                      <ChevronRight className="mobileMenuActionChevron" size={16} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {panelOpen && (
          <div
            ref={mobileDrawerRef}
            className="mobileDrawer glassStrong scrollbarHidden"
            style={{ padding: 12, color: "#0b0b0f" }}
            onTouchStart={(e) => {
              touchStartYRef.current = e.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={() => {
              touchStartYRef.current = null;
            }}
            onTouchMove={(e) => {
              const startY = touchStartYRef.current;
              if (startY === null) return;
              const currentY = e.touches[0]?.clientY ?? startY;
              const dy = currentY - startY;
              const atTop = (mobileDrawerRef.current?.scrollTop ?? 0) <= 0;
              if (dy > 70 && atTop) {
                setPanelOpen(false);
                touchStartYRef.current = null;
              }
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <button
                className={`tabBtn ${panel === "map" ? "tabBtnActive" : ""}`}
                style={{
                  minHeight: 42,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  whiteSpace: "normal",
                  lineHeight: 1.15,
                }}
                onClick={() => toggleMobilePanel("map")}
              >
                CENTRAL
              </button>

              <button
                className={`tabBtn ${panel === "profile" ? "tabBtnActive" : ""}`}
                style={{
                  minHeight: 42,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  whiteSpace: "normal",
                  lineHeight: 1.15,
                }}
                onClick={() => toggleMobilePanel("profile")}
              >
                PERFIL
              </button>

              {canAccessAdmin && (
                <button
                  className={`tabBtn ${panel === "admin" ? "tabBtnActive" : ""}`}
                  style={{
                    minHeight: 42,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "normal",
                    lineHeight: 1.15,
                  }}
                  onClick={() => toggleMobilePanel("admin")}
                >
                  {developmentTabLabel}
                </button>
              )}

              <button
                type="button"
                className="civitasSearchBtn"
                style={{
                  minHeight: 42,
                  width: "100%",
                  fontSize: 12,
                  padding: "10px 12px",
                  borderRadius: 14,
                }}
                onClick={() => toggleMobilePanel("civitas")}
                title={panel === "civitas" ? "Fechar CIVITAS" : "Abrir CIVITAS"}
              >
                {civitasTabLabel}
              </button>
            </div>

            {panel === "map" && (
              <>
                <div style={{ marginBottom: 12, display: "grid", gap: 12 }}>
                  {!isMobile ? (
                    <div className="tabsRail scrollbarHidden" style={{ flexWrap: "nowrap", overflowX: "auto" }}>
                      {availableListModes.map((option) => (
                        <button
                          key={option.mode}
                          className={`subTab ${listMode === option.mode ? "subTabActive" : ""}`}
                          onClick={() => setListMode(option.mode)}
                        >
                          {option.label}
                        </button>
                          ))}
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {availableListModes.map((option) => {
                        const active = listMode === option.mode;
                        return (
                          <button
                            key={option.mode}
                            type="button"
                            onClick={() => setListMode(option.mode)}
                            style={{
                              flex: "1 1 calc(50% - 4px)",
                              minWidth: 0,
                              padding: "8px 10px",
                              borderRadius: 999,
                              border: active ? "1px solid rgba(10,40,75,0.16)" : "1px solid rgba(15,23,42,0.12)",
                              background: active ? "rgba(10,40,75,0.92)" : "rgba(255,255,255,0.92)",
                              color: active ? "#fff" : "rgba(10,40,75,0.76)",
                              fontSize: option.mode === "inteligentes" ? 10.5 : 11,
                              fontWeight: 800,
                              lineHeight: 1.15,
                              minHeight: 38,
                              textAlign: "center",
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                              cursor: "pointer",
                              boxShadow: active ? "0 8px 20px rgba(10,40,75,0.14)" : "none",
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="panelTitle">{listHeaderLabel}</div>
                </div>

                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      listMode === "cameras"
                        ? "Buscar câmera..."
                        : listMode === "inteligentes"
                        ? "Buscar super câmeras inteligente..."
                        : listMode === "lpr"
                        ? "Buscar LPR..."
                        : "Buscar radar..."
                    }
                    style={inputStyle()}
                  />
                  <button
                    onClick={() => setQuery("")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.10)",
                      background: "rgba(255,255,255,0.90)",
                      cursor: "pointer",
                      fontWeight: 900,
                      color: "rgba(0,0,0,0.85)",
                    }}
                    title="Limpar"
                  >
                    ✕
                  </button>
                </div>

                <div
                  key={listMode}
                  ref={listScrollMobileRef}
                  className="scrollbarHidden"
                  style={{ display: "grid", gap: 10, maxHeight: panelMaxHeight, overflow: "auto" }}
                  onScroll={(e) => {
                    if (!isMobile) return;
                    const el = e.currentTarget;
                    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                      if (listMode === "cameras") setMobileCountCameras((v) => v + PAGE_SIZE);
                      if (listMode === "inteligentes") setMobileCountIntel((v) => v + PAGE_SIZE);
                      if (listMode === "lpr") setMobileCountLpr((v) => v + PAGE_SIZE);
                      if (listMode === "radares") setMobileCountRadares((v) => v + PAGE_SIZE);
                    }
                  }}
                >
                  {listMode === "cameras" &&
                    (listItems as Camera[]).map((c) => {
                      const iconSrc = getPoiIconSource(mapBaseStyle, "camera");
                      const streamUrl = normalizeExternalUrl((c as any).streaming_url ?? c.stream_url ?? "");
                      return (
                        <div
                          key={c.code}
                          className="listItem"
                          onClick={() => {
                            setSelectedCode(c.code);
                            setSelectedRadar(null);
                            focusOnDetection(c.lng, c.lat);
                            setPanelOpen(false);
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <div style={getPoiListIconBubbleStyle("camera")}>
                              <img src={iconSrc} alt="" style={getPoiListIconStyle()} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
                                <div
                                  style={{
                                    fontWeight: 900,
                                    fontSize: 12,
                                    lineHeight: 1.2,
                                    whiteSpace: "normal",
                                    overflow: "visible",
                                    textOverflow: "clip",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {c.name}
                                </div>
                                <span style={getPoiCodePillStyle("camera", true)}>{c.code}</span>
                              </div>
                              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 10, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "1px 7px" }}>
                                  {String((c as any).zona_camera ?? (c as any).zone ?? "").trim() ||
                                    [c.city, c.uf].filter(Boolean).join(" - ") ||
                                    "-"}
                                </span>
                                {hasStreamingAccess && streamUrl && c.id && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      void openCommonCameraStreamWindow(c.id || "", 0);
                                    }}
                                    className="listStreamPill listStreamPill--camera"
                                  >
                                    Abrir streaming
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                {listMode === "inteligentes" &&
                    (listItems as CameraIntel[]).map((c) => {
                      const iconSrc = getPoiIconSource(mapBaseStyle, "camera_intel");
                      const smartId = cleanString(c.id);
                      const showSmartStreamButton =
                        hasSmartCameraStreamingAccess && Boolean(smartId) && !Boolean(smartId && unavailableSmartCameraIds[smartId]);
                      return (
                        <div
                          key={smartId || c.code}
                          className="listItem"
                          onClick={() => {
                            setSelectedCode(null);
                            setSelectedRadar(null);
                            focusOnDetection(c.lng, c.lat);
                            setPanelOpen(false);
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <div style={getPoiListIconBubbleStyle("camera_intel")}>
                              <img src={iconSrc} alt="" style={getPoiListIconStyle()} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
                                <div
                                  style={{
                                    fontWeight: 900,
                                    fontSize: 12,
                                    lineHeight: 1.2,
                                    whiteSpace: "normal",
                                    overflow: "visible",
                                    textOverflow: "clip",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {c.name}
                                </div>
                                <span style={getPoiCodePillStyle("camera_intel", true)}>{c.code}</span>
                              </div>
                              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    opacity: 0.8,
                                    border: "1px solid rgba(15,23,42,0.14)",
                                    borderRadius: 999,
                                    padding: "1px 7px",
                                  }}
                                >
                                  Responsável: {c.responsavel || (c as any).responsavel || "-"}
                                </span>
                                {showSmartStreamButton && (
                                  <button
                                    type="button"
                                    className="listStreamPill listStreamPill--smart"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      void openSmartCameraStreamWindow(c, SMART_CAMERA_STREAM_DURATION_SECONDS);
                                    }}
                                    title="Abrir streaming completo"
                                  >
                                    Abrir streaming
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                {listMode === "lpr" &&
                    (listItems as CameraLpr[]).map((c) => {
                      const iconSrc = getPoiIconSource(mapBaseStyle, "camera_lpr");
                      return (
                        <div
                          key={getPointCollectionKey(c) || c.code}
                          className="listItem"
                          onClick={() => {
                            setSelectedCode(null);
                            setSelectedRadar(null);
                            focusOnDetection(c.lng, c.lat);
                            setPanelOpen(false);
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <div style={getPoiListIconBubbleStyle("camera_lpr")}>
                              <img src={iconSrc} alt="" style={getPoiListIconStyle()} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
                                <div
                                  style={{
                                    fontWeight: 900,
                                    fontSize: 12,
                                    lineHeight: 1.2,
                                    whiteSpace: "normal",
                                    overflow: "visible",
                                    textOverflow: "clip",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {getPointCollectionTitle(c) || c.name}
                                </div>
                                <span style={getPoiCodePillStyle("camera_lpr", true)}>{getPointCollectionCode(c)}</span>
                              </div>
                              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 10, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "1px 7px" }}>
                                  Local: {getPointCollectionTitle(c) || "-"}
                                </span>
                                <span style={{ fontSize: 10, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "1px 7px" }}>
                                  Bairro: {c.bairro || c.neighborhood || getLprNeighborhood(c) || "-"}
                                </span>
                                <span style={{ fontSize: 10, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "1px 7px" }}>
                                  Sentido: {c.sentido || c.direction || "-"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                {listMode === "radares" &&
                    (listItems as Radar[]).map((r) => {
                      const lat = Number(r.lat ?? r.latitude);
                      const lng = Number(r.lng ?? r.longitude);
                      const ok = Number.isFinite(lat) && Number.isFinite(lng);
                      const iconSrc = getPoiIconSource(mapBaseStyle, "radar");

                      return (
                        <div
                          key={getPointCollectionKey(r) || r.codcet}
                          className="listItem"
                          onClick={() => {
                            if (!ok) return;
                            setSelectedRadar(getPointCollectionKey(r) || r.codcet);
                            setSelectedCode(null);
                            focusOnDetection(lng, lat);
                            setPanelOpen(false);
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={getPoiListIconBubbleStyle("radar")}>
                              <img src={iconSrc} alt="" style={getPoiListIconStyle()} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  minWidth: 0,
                                  flexWrap: isMobile ? "wrap" : "nowrap",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 900,
                                    fontSize: 13,
                                    whiteSpace: isMobile ? "normal" : "nowrap",
                                    overflow: isMobile ? "visible" : "hidden",
                                    textOverflow: isMobile ? "clip" : "ellipsis",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {getPointCollectionTitle(r) || r.logradouro || r.localidade || "Radar"}
                                </div>
                                <span style={getPoiCodePillStyle("radar", true)}>{getPointCollectionCode(r)}</span>
                              </div>
                              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                                  Local: {r.local || r.logradouro || r.localidade || "-"}
                                </span>
                                <span style={{ fontSize: 11, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                                  Bairro: {r.bairro || "-"}
                                </span>
                                <span style={{ fontSize: 11, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                                  Sentido: {r.sentido || "-"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {!filtered.length && (
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {listMode === "cameras"
                        ? "Nenhuma câmera."
                        : listMode === "inteligentes"
                        ? "Nenhuma Super Câmera Inteligente."
                        : listMode === "lpr"
                        ? "Nenhuma câmera LPR."
                        : "Nenhum radar."}
                    </div>
                  )}
                </div>

                {!isMobile && filtered.length > PAGE_SIZE && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
                    <button
                      className="btnGhost"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                      style={{ opacity: page <= 1 ? 0.5 : 1 }}
                    >
                      Anterior
                    </button>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      Página {page} de {totalPages}
                    </div>
                    <button
                      className="btnGhost"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                      style={{ opacity: page >= totalPages ? 0.5 : 1 }}
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </>
            )}

            {panel === "profile" && (
              <>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.88)",
                    border: "1px solid rgba(10,40,75,0.08)",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: "0.08em",
                      color: "rgba(10,40,75,0.58)",
                      marginBottom: 6,
                    }}
                  >
                    PERFIL
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8, color: "#0f172a" }}>Dados do usuário</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(10,40,75,0.58)" }}>Nome</div>
                    <div style={{ fontSize: 13, color: "#0f172a" }}>{me?.full_name || "-"}</div>
                    <div style={{ fontSize: 11, fontWeight: 900, marginTop: 6, color: "rgba(10,40,75,0.58)" }}>Email</div>
                    <div style={{ fontSize: 13, color: "rgba(15,23,42,0.72)" }}>{me?.email || "-"}</div>
                    <div style={{ fontSize: 11, fontWeight: 900, marginTop: 6, color: "rgba(10,40,75,0.58)" }}>Organização</div>
                    <div style={{ fontSize: 13, color: "rgba(15,23,42,0.85)" }}>{auth.organizationName || "-"}</div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 12,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.88)",
                    border: "1px solid rgba(10,40,75,0.08)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: "0.08em",
                      color: "rgba(10,40,75,0.58)",
                    }}
                  >
                    SEGURANÇA
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 2, color: "#0f172a" }}>Trocar senha</div>
                  <div style={{ position: "relative" }}>
                    <input
                      value={pwOld}
                      onChange={(e) => setPwOld(e.target.value)}
                      type={showPwOld ? "text" : "password"}
                      placeholder="Senha atual"
                      style={{
                        ...inputStyle(),
                        paddingRight: 44,
                        border: "1px solid rgba(10,40,75,0.12)",
                        background: "rgba(255,255,255,0.96)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwOld((v) => !v)}
                      aria-label={showPwOld ? "Ocultar senha atual" : "Mostrar senha atual"}
                      title={showPwOld ? "Ocultar senha atual" : "Mostrar senha atual"}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        border: "none",
                        background: "transparent",
                        color: "rgba(10,40,75,0.64)",
                        padding: 0,
                        width: 20,
                        height: 20,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      {showPwOld ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      value={pwNew}
                      onChange={(e) => setPwNew(e.target.value)}
                      type={showPwNew ? "text" : "password"}
                      placeholder="Nova senha"
                      style={{
                        ...inputStyle(),
                        paddingRight: 44,
                        border: "1px solid rgba(10,40,75,0.12)",
                        background: "rgba(255,255,255,0.96)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwNew((v) => !v)}
                      aria-label={showPwNew ? "Ocultar nova senha" : "Mostrar nova senha"}
                      title={showPwNew ? "Ocultar nova senha" : "Mostrar nova senha"}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        border: "none",
                        background: "transparent",
                        color: "rgba(10,40,75,0.64)",
                        padding: 0,
                        width: 20,
                        height: 20,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      {showPwNew ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      value={pwNew2}
                      onChange={(e) => setPwNew2(e.target.value)}
                      type={showPwNew2 ? "text" : "password"}
                      placeholder="Confirmar nova senha"
                      style={{
                        ...inputStyle(),
                        paddingRight: 44,
                        border: "1px solid rgba(10,40,75,0.12)",
                        background: "rgba(255,255,255,0.96)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwNew2((v) => !v)}
                      aria-label={showPwNew2 ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                      title={showPwNew2 ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        border: "none",
                        background: "transparent",
                        color: "rgba(10,40,75,0.64)",
                        padding: 0,
                        width: 20,
                        height: 20,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      {showPwNew2 ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  <button
                    onClick={changePassword}
                    disabled={pwLoading}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(10,40,75,0.18)",
                      background: "rgba(10,40,75,0.92)",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    {pwLoading ? "Salvando..." : "Salvar nova senha"}
                  </button>
                  {pwMsg && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.96)",
                      border: "1px solid rgba(10,40,75,0.10)",
                      fontSize: 13,
                      color: "rgba(15,23,42,0.85)",
                    }}
                  >
                    {pwMsg}
                    </div>
                  )}
                </div>
              </>
            )}

            {panel === "civitas" && renderCivitasPanel()}

            {panel === "admin" && canAccessAdmin && (
              <>
                {!isMobile ? (
                  <div className="tabsRail tabsRailAdmin tabsRailAdminMobile">
                    {adminTabOptions.map((option) => (
                      <button
                        key={option.key}
                        className={`subTab ${activeAdminTab === option.key ? "subTabActive" : ""}`}
                        onClick={() => setAdminTab(option.key)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                      marginBottom: 12,
                      padding: "10px 12px",
                      borderRadius: 16,
                      border: "1px solid rgba(10,40,75,0.08)",
                      background: "rgba(255,255,255,0.88)",
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: "rgba(10,40,75,0.58)" }}>
                      SEÇÃO
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {adminTabOptions.map((option) => {
                        const active = activeAdminTab === option.key;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setAdminTab(option.key)}
                            style={{
                              padding: "7px 12px",
                              borderRadius: 999,
                              border: active ? "1px solid rgba(10,40,75,0.16)" : "1px solid rgba(15,23,42,0.12)",
                              background: active ? "rgba(10,40,75,0.92)" : "rgba(255,255,255,0.96)",
                              color: active ? "#fff" : "rgba(10,40,75,0.76)",
                              fontSize: 11,
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                              cursor: "pointer",
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeAdminTab === "users" && (
                  <AdminUsersPanel
                    apiBase={API_BASE}
                    token={accessToken}
                    viewerRole={role}
                    isMobile={isMobile}
                    onOrgDropdownOpenChange={setAdminUsersOrgOpen}
                  />
                )}
                {activeAdminTab === "usage" && (
                  <AdminUsageDashboardPanel apiBase={API_BASE} token={accessToken} isMobile={isMobile} />
                )}
                {activeAdminTab === "organizations" && (
                  <AdminOrganizationsPanel apiBase={API_BASE} token={accessToken} isMobile={isMobile} />
                )}
                {activeAdminTab === "cameras" && (
                  <AdminCamerasPanel
                    apiBase={API_BASE}
                    token={accessToken}
                    onStatusChanged={() => {
                      loadCameras();
                      loadCamerasIntel();
                      loadCamerasLpr();
                    }}
                    isMobile={isMobile}
                  />
                )}
                {activeAdminTab === "radares" && (
                  <AdminRadaresPanel
                    apiBase={API_BASE}
                    token={accessToken}
                    onStatusChanged={() => {
                      loadRadares();
                    }}
                    isMobile={isMobile}
                  />
                )}
                {activeAdminTab === "logs" && <AdminLogsPanel apiBase={API_BASE} token={accessToken} isMobile={isMobile} />}
              </>
            )}
          </div>
        )}
      </div>

      {mobileSearchOpen && (
        <div
          className={`mobileSearchLayer ${mobileSearchFocused ? "mobileSearchLayer--focused" : ""}`}
          role="presentation"
        >
          <button
            type="button"
            className="mobileSearchBackdrop"
            aria-label="Fechar busca"
            onClick={() => setMobileSearchOpen(false)}
          />

          <div className="mobileSearchSheet" role="dialog" aria-modal="true" aria-label="Buscar local">
            <div className="mobileSearchHandle" aria-hidden="true" />

            <div className="mobileSearchHeader">
              <div className="mobileSearchHeading">
                <div className="mobileSearchEyebrow">BUSCAR LOCAL</div>
                <div className="mobileSearchTitleRow">
                  <div className="mobileSearchTitle">Rio em foco</div>
                  <span className="mobileSearchBadge">RJ</span>
                </div>
              </div>
              <button
                type="button"
                className="mobileSearchCloseBtn"
                onClick={() => setMobileSearchOpen(false)}
                aria-label="Fechar busca"
                title="Fechar"
              >
                <X size={15} strokeWidth={2.8} aria-hidden="true" />
              </button>
            </div>

            <div className="mobileSearchCopy">
              Digite rua, bairro, ponto de referência ou coordenada no mapa.
            </div>

            <div className="mobileSearchFieldShell">
              <span className="mobileSearchFieldIcon" aria-hidden="true">
                <Search size={16} strokeWidth={2.35} />
              </span>
              <input
                ref={mobileSearchInputRef}
                value={searchQuery}
                onFocus={() => setMobileSearchFocused(true)}
                onBlur={() => setMobileSearchFocused(false)}
                onChange={(e) => {
                  setSearchErr(null);
                  setSearchQuery(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void submitMobileSearch();
                  }
                  if (e.key === "Escape") {
                    setMobileSearchOpen(false);
                  }
                }}
                placeholder="Buscar rua ou coordenadas no RJ"
                className="mobileSearchInput"
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  className="mobileSearchClearBtn"
                  onClick={() => {
                    setSearchErr(null);
                    setSearchQuery("");
                  }}
                  aria-label="Limpar busca"
                  title="Limpar"
                >
                  <X size={14} strokeWidth={2.8} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="mobileSearchSectionLabel">Sugestões rápidas</div>
            <div className="mobileSearchChips">
              {[
                { label: "Copacabana", value: "Copacabana" },
                { label: "Centro", value: "Centro" },
                { label: "Barra da Tijuca", value: "Barra da Tijuca" },
                { label: "-22.91, -43.18", value: "-22.91, -43.18" },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="mobileSearchChip"
                  onClick={() => {
                    setSearchQuery(item.value);
                    void submitMobileSearch(item.value);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {searchErr && <div className="mobileSearchError">{searchErr}</div>}

            <button
              type="button"
              className="mobileSearchSubmitBtn"
              onPointerDown={submitMobileSearchFromTouch}
              onClick={submitMobileSearchFromClick}
            >
              Buscar no mapa
            </button>

            <div className="mobileSearchHint">Toque fora para fechar. A busca fica limitada ao município do Rio.</div>
          </div>
        </div>
      )}
    </div>
  );
}
