// src/pages/MapPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import type { FeatureCollection, Feature, Point, Polygon, MultiPolygon } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import { Building2, Eye, EyeOff, PenTool, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAuth } from "../app/auth";
import { fetchJson, inputStyle } from "./map/shared";
import type { Camera, CameraIntel, CameraLpr, Me, Radar } from "./map/types";
import { canAccessStreaming, isAdminRole, normalizeRole, roleLabel } from "./map/roles";
import "./map/map.css";
import prefeituraLogo from "@/assets/prefeitura_icon2.png";
import cameraIcon from "@/assets/camera-icon.png";
import radarIcon from "@/assets/radar-icon.png";
import cameraIntelIcon from "@/assets/cameras-inteligentes-icon.png";
import cameraLprIcon from "@/assets/camera-lpr-icon.png";
import mapPinRed from "@/assets/map-pin-red.svg";
import civitasLogo from "@/assets/civitas_icon.png";
import { AdminUsersPanel } from "./map/AdminUsersPanel";
import { AdminCamerasPanel } from "./map/AdminCamerasPanel";
import { AdminRadaresPanel } from "./map/AdminRadaresPanel";
import { AdminLogsPanel } from "./map/AdminLogsPanel";


type TabKey = "map" | "profile" | "civitas" | "admin";
type PanelKey = TabKey | null;

type AdminTab = "users" | "logs" | "cameras" | "radares";


const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.toString() ||
  (import.meta as any).env?.VITE_API_BASE_URL?.toString() ||
  "http://localhost:8000";

const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN?.toString() || "";

// só dark streets
const MAP_STYLE_DARK = "mapbox://styles/mapbox/dark-v11" as const;
const PAGE_SIZE = 50;

// IDs fixos
const SOURCES = {
  pois: "src-pois",
  gps: "src-gps",
  search: "src-search",
  selection: "src-selection",
  area_draw: "src-area-draw",
  bairros: "src-bairros",
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
  aisp_fill: "lyr-aisp-fill",
  aisp_line: "lyr-aisp-line",
  cisp_fill: "lyr-cisp-fill",
  cisp_line: "lyr-cisp-line",
  risp_label: "lyr-risp-label",
  aisp_label: "lyr-aisp-label",
  cisp_label: "lyr-cisp-label",
} as const;

const IMAGES = {
  camera: "camera_icon",
  radar: "radar_icon",
  camera_intel: "camera_intel_icon",
  camera_lpr: "camera_lpr_icon",
  search_pin: "search_pin_icon",
} as const;


function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

type BairrosFeature = Feature<Polygon | MultiPolygon, { NOME?: string } & Record<string, any>>;

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
  data: FeatureCollection<Polygon | MultiPolygon, any>,
  candidates: string[]
) {
  return {
    ...data,
    features: data.features.map((feature) => {
      const props: any = { ...(feature.properties || {}) };
      for (const key of candidates) {
        const v = Number(props?.[key]);
        if (Number.isFinite(v)) {
          props.name = v;
          break;
        }
      }
      return { ...feature, properties: props };
    }),
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

async function addImageOnce(map: mapboxgl.Map, id: string, url: string) {
  if (map.hasImage(id)) return;
  const image = await loadImagePromise(map, url);
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
    const rawStreamingUrl = (c.streaming_url ?? "").toString().trim();
    const streamingUrl = normalizeExternalUrl(rawStreamingUrl);

    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      properties: {
        kind: "camera_intel",
        code: c.code,
        name: c.name,
        responsavel: c.responsavel ?? (c as any).responsavel ?? "",
        direction: c.direction ?? "",
        streaming_url: streamingUrl,
        streaming_url_raw: rawStreamingUrl,
        is_active: c.is_active ? 1 : 0,
      },
    };
  });
}

function camerasLprToFeatures(list: CameraLpr[]): Feature<Point, any>[] {
  return list.map((c) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [c.lng, c.lat] },
    properties: {
      kind: "camera_lpr",
      code: c.code,
      name: c.name,
      neighborhood: getLprNeighborhood(c),
      direction: c.direction ?? "",
      is_active: c.is_active ? 1 : 0,
    },
  }));
}

function radaresToFeatures(list: Radar[]): Feature<Point, any>[] {
  const features: Feature<Point, any>[] = [];

  for (const r of list) {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const active = r.is_active !== false;

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        kind: "radar",
        codcet: r.codcet,
        bairro: r.bairro ?? "",
        logradouro: (r.logradouro ?? r.localidade ?? "") || "",
        sentido: r.sentido ?? "",
        empresa: r.empresa ?? "",
        velofisc: r.velofisc ?? null,
        numero_equipamento: r.numero_equipamento ?? "",
        status: r.status ?? (active ? "ATIVO" : "INATIVO"),
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

function poiCoordKey(lng: number, lat: number) {
  return `${lng.toFixed(6)}|${lat.toFixed(6)}`;
}

function featureCoordKey(feature: Feature<Point, any>): string | null {
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return poiCoordKey(lng, lat);
}

function makeAreaDrawGeoJSON(points: Array<[number, number]>) {
  const features: Feature<any, any>[] = [];

  if (points.length >= 3) {
    const ring = [...points, points[0]];
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: { kind: "area_polygon" },
    } as any);
  }

  if (points.length >= 2) {
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: points },
      properties: { kind: "area_line" },
    } as any);
  }

  for (const pt of points) {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: pt },
      properties: { kind: "area_point" },
    } as any);
  }

  return { type: "FeatureCollection", features } as FeatureCollection<any, any>;
}

export default function MapPage() {
  const auth: any = useAuth();
  const nav = useNavigate();

  const accessToken =
    auth?.accessToken ||
    auth?.token ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("access_token") ||
    "";
  const authLoading = !!auth?.loading;

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const areaDrawModeRef = useRef(false);
  const hasStreamingAccessRef = useRef(false);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const hoverPreviewPopupRef = useRef<mapboxgl.Popup | null>(null);
  const hoverPreviewAnchorRef = useRef<"top" | "bottom">("bottom");
  const hoverPreviewTimerRef = useRef<number | null>(null);
  const poiCoordIndexRef = useRef<Map<string, Feature<Point, any>[]>>(new Map());
  const suppressHoverHideRef = useRef(false);
  const suppressHoverHideTimerRef = useRef<number | null>(null);
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const handlersBoundRef = useRef(false);
  const iconsLoadedRef = useRef(false);
  const selectionRingTimerRef = useRef<number | null>(null);

  const [panel, setPanel] = useState<PanelKey>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const isMobileRef = useRef(false);

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

  const [loadingBairros, setLoadingBairros] = useState(false);
  const [bairrosGeo, setBairrosGeo] = useState<FeatureCollection<Polygon | MultiPolygon, any> | null>(null);
  const [bairrosErr, setBairrosErr] = useState<string | null>(null);
  const [rispGeo, setRispGeo] = useState<FeatureCollection<Polygon | MultiPolygon, any> | null>(null);
  const [aispGeo, setAispGeo] = useState<FeatureCollection<Polygon | MultiPolygon, any> | null>(null);
  const [cispGeo, setCispGeo] = useState<FeatureCollection<Polygon | MultiPolygon, any> | null>(null);
  const [selectedBairro, setSelectedBairro] = useState<string>("");
  const [bairroQuery, setBairroQuery] = useState<string>("");
  const [bairroReportLoading, setBairroReportLoading] = useState(false);
  const [bairroReportMsg, setBairroReportMsg] = useState<string | null>(null);
  const [areaDrawMode, setAreaDrawMode] = useState(false);
  const [areaToolsOpen, setAreaToolsOpen] = useState(false);
  const [areaDrawPoints, setAreaDrawPoints] = useState<Array<[number, number]>>([]);
  const [areaReportLoading, setAreaReportLoading] = useState(false);
  const [areaReportMsg, setAreaReportMsg] = useState<string | null>(null);

  useEffect(() => {
    areaDrawModeRef.current = areaDrawMode;
  }, [areaDrawMode]);

  const [listMode, setListMode] = useState<"cameras" | "inteligentes" | "lpr" | "radares">("cameras");
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

  const [me, setMe] = useState<Me | null>(null);
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [showPwOld, setShowPwOld] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);
  const [showPwNew2, setShowPwNew2] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const [adminTab, setAdminTab] = useState<AdminTab>("users");

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
      what: "Consultar todas as passagens de uma placa e reconstruir deslocamentos e rotas.",
      when: "Quando já existe uma placa identificada e é necessário entender trajetos ou presença em locais específicos.",
      result:
        "Mapa com rotas, tabela cronológica de detecções, agrupamento em viagens e possíveis indícios de clonagem.",
    },
    {
      tool: "Busca por Radar",
      what: "Identificar veículos que passaram em determinado local e período.",
      when: "Quando não há placa definida, mas há local e horário da ocorrência.",
      result: "Lista cronológica de placas detectadas em radar ou conjunto de radares.",
    },
    {
      tool: "Placas Conjuntas",
      what: "Identificar veículos que trafegam junto com uma placa monitorada.",
      when: "Quando há suspeita de atuação em conjunto, batedores ou acompanhamento de veículos.",
      result: "Lista de placas associadas, frequência de passagens conjuntas e ranking de recorrência.",
    },
    {
      tool: "Placas Correlatas",
      what: "Identificar vínculos e padrões entre diferentes veículos monitorados.",
      when: "Investigações com múltiplos veículos ou análise de conexões entre ocorrências.",
      result: "Grafo de conexões entre veículos e tabela ordenada por nível de correlação.",
    },
  ] as const;
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
  const suppressNextMapClickRef = useRef(false);
  const suppressMapClickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);

  useEffect(() => {
    const setViewportHeightVar = () => {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--vvh", `${Math.round(height)}px`);
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

  function closeDockUnlessBairros() {
    if (!showBairros) setDockOpen(false);
  }

  useEffect(() => {
    if (dockOpen) bumpDockAutoHide();
    return () => {
      if (dockTimerRef.current) window.clearTimeout(dockTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockOpen]);

  const role = normalizeRole(
    me?.role ?? auth?.user?.role
  );
  const isAdmin = isAdminRole(role);
  const hasStreamingAccess = canAccessStreaming(role);

  useEffect(() => {
    hasStreamingAccessRef.current = hasStreamingAccess;
  }, [hasStreamingAccess]);

  function togglePanel(next: TabKey) {
    setPanel((cur) => (cur === next ? null : next));
  }

  useEffect(() => {
    if (panel === "admin" && !isAdmin) setPanel(null);
  }, [panel, isAdmin]);

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

  function ensureSourcesAndLayers(map: mapboxgl.Map) {
    const hasIcons = map.hasImage(IMAGES.camera) && map.hasImage(IMAGES.radar);

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

    if (hasIcons && !map.getLayer(LAYERS.cameras_points)) {
      map.addLayer({
        id: LAYERS.cameras_points,
        type: "symbol",
        source: SOURCES.pois,
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "kind"], "camera"]],
        layout: {
          "icon-image": IMAGES.camera,
          "icon-size": 0.8,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": 1,
        },
      });
    }

    if (map.hasImage(IMAGES.camera_intel) && !map.getLayer(LAYERS.cameras_intel_points)) {
      map.addLayer({
        id: LAYERS.cameras_intel_points,
        type: "symbol",
        source: SOURCES.pois,
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "kind"], "camera_intel"]],
        layout: {
          "icon-image": IMAGES.camera_intel,
          "icon-size": 0.1,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": 1,
        },
      });
    }

    if (map.hasImage(IMAGES.camera_lpr) && !map.getLayer(LAYERS.cameras_lpr_points)) {
      map.addLayer({
        id: LAYERS.cameras_lpr_points,
        type: "symbol",
        source: SOURCES.pois,
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "kind"], "camera_lpr"]],
        layout: {
          "icon-image": IMAGES.camera_lpr,
          "icon-size": 0.2,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": 1,
        },
      });
    }

    if (hasIcons && !map.getLayer(LAYERS.radares_points)) {
      map.addLayer({
        id: LAYERS.radares_points,
        type: "symbol",
        source: SOURCES.pois,
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "kind"], "radar"]],
        layout: {
          "icon-image": IMAGES.radar,
          "icon-size": 1.0,
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
        filter: ["==", ["get", "kind"], "area_polygon"],
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
        filter: ["any", ["==", ["get", "kind"], "area_line"], ["==", ["get", "kind"], "area_polygon"]],
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
        filter: ["==", ["get", "kind"], "area_point"],
        paint: {
          "circle-radius": 4.5,
          "circle-color": "#e0f2fe",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#0284c7",
        },
      });
    }

    if (!map.getLayer(LAYERS.bairros_fill)) {
      map.addLayer({
        id: LAYERS.bairros_fill,
        type: "fill",
        source: SOURCES.bairros,
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0,
        },
      });
    }

    if (!map.getLayer(LAYERS.bairros_line)) {
      map.addLayer({
        id: LAYERS.bairros_line,
        type: "line",
        source: SOURCES.bairros,
        paint: {
          "line-color": "#9d18e1",
          "line-width": 2.5,
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
          "fill-color": "#22c55e",
          "fill-opacity": 0.35,
        },
      });
    }

    if (!map.getLayer(LAYERS.bairros_selected_line)) {
      map.addLayer({
        id: LAYERS.bairros_selected_line,
        type: "line",
        source: SOURCES.bairros,
        filter: ["==", ["get", "NOME"], ""],
        paint: {
          "line-color": "#9d18e1",
          "line-width": 3.5,
        },
      });
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

    // Garante que pontos (câmeras/radares) fiquem acima dos bairros
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

  function updateAreaDrawData(map: mapboxgl.Map, points: Array<[number, number]>) {
    const src: any = map.getSource(SOURCES.area_draw);
    if (!src || typeof src.setData !== "function") return;
    src.setData(makeAreaDrawGeoJSON(points));
  }

  function updateBairrosData(
    map: mapboxgl.Map,
    data: FeatureCollection<Polygon | MultiPolygon, any>
  ) {
    const src: any = map.getSource(SOURCES.bairros);
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
    labelId?: string
  ) {
    const v = visible ? "visible" : "none";
    if (map.getLayer(fillId)) map.setLayoutProperty(fillId, "visibility", v);
    if (map.getLayer(lineId)) map.setLayoutProperty(lineId, "visibility", v);
    if (labelId && map.getLayer(labelId)) map.setLayoutProperty(labelId, "visibility", v);
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

    const features: Feature<Point, any>[] = [];

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

    function hideHoverPreview() {
      if (suppressHoverHideRef.current && hoverPreviewPopupRef.current?.isOpen()) return;
      clearHoverPreviewTimer();
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
          streamingUrl: normalizeExternalUrl((p.streaming_url || p.stream_url || "").toString()),
        };
      }
      if (kind === "camera_lpr") {
        return {
          kind,
          title: (p.name || "Câmera LPR").toString(),
          meta: `Direção: ${(p.direction || "-").toString()}`,
          streamingUrl: "",
        };
      }
      if (kind === "radar") {
        return {
          kind,
          title: (p.logradouro || "Radar sem logradouro").toString(),
          meta: `Sentido: ${(p.sentido || "-").toString()}`,
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
        camera_intel: "Super Câmera",
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
        const aCode = (aKind === "radar" ? a.properties?.codcet : a.properties?.code) || "";
        const bCode = (bKind === "radar" ? b.properties?.codcet : b.properties?.code) || "";
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
          const code = info.kind === "radar" ? p.codcet || p.numero_equipamento || "-" : p.code || "-";
          const streamLink =
            hasStreamingAccessRef.current && info.streamingUrl
              ? `<a class="cameraPopupStreamLink stackPopupStreamLink" href="${escapeHtml(info.streamingUrl)}" target="_blank" rel="noreferrer">Streaming</a>`
              : "";

          return `
            <div class="stackPopupItem ${kindItemCardClass[info.kind]}">
              <div class="stackPopupItemHead">
                <span class="stackPopupTag ${kindItemClass[info.kind]}">${escapeHtml(kindLabel[info.kind])}</span>
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
            <button type="button" class="cameraPopupCloseBtn" data-popup-close aria-label="Fechar popup">×</button>
            <div class="stackPopupHead">
              <div class="stackPopupKicker">Mesmo ponto no mapa</div>
              <div class="stackPopupTitleMain">${stack.length} dispositivos neste local</div>
            </div>
            <div class="stackPopupChips">${chipsHtml}</div>
            <div class="stackPopupList">${itemsHtml}</div>
          </div>
        `)
        .addTo(map);

      bindPopupCloseButton();
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

    function setCursorPointer() {
      map.getCanvas().style.cursor = "pointer";
    }
    function setCursorDefault() {
      map.getCanvas().style.cursor = "";
    }

    const hoverLayerIds = [LAYERS.cameras_intel_points, LAYERS.cameras_lpr_points, LAYERS.radares_points, LAYERS.clusters];
    for (const lid of hoverLayerIds) {
      map.on("mouseenter", lid, setCursorPointer);
      map.on("mouseleave", lid, setCursorDefault);
    }

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
                  <img src="${cameraIcon}" alt="" class="cameraPopupIcon" />
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
              ${allowStreaming && streamingUrl
                ? `<a class="cameraPopupStreamLink" href="${escapeHtml(streamingUrl)}" target="_blank" rel="noreferrer">Abrir streaming</a>`
                : ""}
            </div>
          </div>
        `)
        .addTo(map);
      bindPopupCloseButton();
      if (allowStreaming && streamingUrl) centerMobilePopup();
    });

    map.on("click", LAYERS.cameras_intel_points, (e) => {
      hideHoverPreview();
      const f: any = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const coords = (f.geometry as any).coordinates as [number, number];
      const streamingUrl = normalizeExternalUrl(p.streaming_url || p.stream_url || "");
      const allowStreaming = hasStreamingAccessRef.current;
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
                  <img src="${cameraIntelIcon}" alt="" class="cameraPopupIcon" />
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
              ${allowStreaming && streamingUrl
                ? `<a class="cameraPopupStreamLink" href="${escapeHtml(streamingUrl)}" target="_blank" rel="noreferrer">Abrir streaming</a>`
                : ""}
            </div>
          </div>
        `)
        .addTo(map);
      bindPopupCloseButton();
      if (allowStreaming && streamingUrl) centerMobilePopup();
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
                  <img src="${cameraLprIcon}" alt="" class="cameraPopupIcon" />
                  <div class="cameraPopupKicker">Câmera LPR</div>
                </div>
                <div class="cameraPopupTitle">${escapeHtml(p.name || "Câmera LPR")}</div>
              </div>
              <span class="cameraPopupCode">${escapeHtml(p.code || "-")}</span>
            </div>

            <div class="cameraPopupInfoGrid">
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Bairro</span>
                <span class="cameraPopupInfoValue">${escapeHtml(getLprNeighborhood(p) || "-")}</span>
              </div>
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Direção</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.direction || "-")}</span>
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

      setSelectedRadar(p.codcet || null);
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
                  <img src="${radarIcon}" alt="" class="cameraPopupIcon" />
                  <div class="cameraPopupKicker">Radar</div>
                </div>
                <div class="cameraPopupTitle">${escapeHtml(p.logradouro || "Radar sem logradouro")}</div>
              </div>
              <span class="cameraPopupCode">${escapeHtml(p.codcet || "-")}</span>
            </div>

            <div class="cameraPopupInfoGrid">
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Bairro</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.bairro || "-")}</span>
              </div>
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Sentido</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.sentido || "-")}</span>
              </div>
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Empresa</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.empresa || "-")}</span>
              </div>
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Vel</span>
                <span class="cameraPopupInfoValue">${p.velofisc ?? "-"}</span>
              </div>
              <div class="cameraPopupInfoItem">
                <span class="cameraPopupInfoLabel">Equip</span>
                <span class="cameraPopupInfoValue">${escapeHtml(p.numero_equipamento || "-")}</span>
              </div>
            </div>
          </div>
        `)
        .addTo(map);
      bindPopupCloseButton();
    });

    map.on("click", (e) => {
      hideHoverPreview();
      if (areaDrawModeRef.current) {
        const lng = Number(e.lngLat?.lng);
        const lat = Number(e.lngLat?.lat);
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          setAreaDrawPoints((prev) => [...prev, [lng, lat]]);
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

  async function loadMe() {
    if (!accessToken) {
      setMe(null);
      return;
    }

    try {
      const data = await fetchJson<Me>(`${API_BASE}/users/me`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setMe(data);
    } catch (e: any) {
      console.error(e);
      setMe(null);
    }
  }

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    async function loadBairros() {
      setLoadingBairros(true);
      setBairrosErr(null);

      const baseUrl = (import.meta as any).env?.BASE_URL?.toString() || "/";
      const candidates = [
        `${baseUrl}GeojsonBairros.geojson`,
        "/GeojsonBairros.geojson",
        "./GeojsonBairros.geojson",
      ];

      for (const url of candidates) {
        try {
          const data = await fetchJson<FeatureCollection<Polygon | MultiPolygon, any>>(url);
          if (!active) return;
          setBairrosGeo(data);
          setLoadingBairros(false);
          return;
        } catch (e) {
          console.warn("Falha ao carregar bairros de", url, e);
        }
      }

      if (!active) return;
      setBairrosErr("Não foi possível carregar o GeoJSON dos bairros.");
      setLoadingBairros(false);
    }

    loadBairros();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_DARK,
      center: [-43.2096, -22.9035],
      zoom: 11,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    mapRef.current = map;

    map.on("load", async () => {
      try {
        if (!iconsLoadedRef.current) {
          await addImageOnce(map, IMAGES.camera, cameraIcon);
          await addImageOnce(map, IMAGES.radar, radarIcon);
          await addImageOnce(map, IMAGES.camera_intel, cameraIntelIcon);
          await addImageOnce(map, IMAGES.camera_lpr, cameraLprIcon);
          await addImageOnce(map, IMAGES.search_pin, mapPinRed);
          iconsLoadedRef.current = true;
        }
      } catch (e) {
        console.warn("Falha ao carregar ícones:", e);
      }

      ensureSourcesAndLayers(map);
      bindInteractionsOnce(map);

      const poisGeoInit = makePoisGeoJSON(
        cameras,
        camerasIntel,
        camerasLpr,
        radares,
        showCameras,
        showCamerasIntel,
        showCamerasLpr,
        showRadares
      );
      updatePoisData(map, poisGeoInit);
      if (bairrosGeo) {
        updateBairrosData(map, bairrosGeo);
      }
      if (rispGeo) {
        updateRispData(map, rispGeo);
      }
      if (aispGeo) {
        updateAispData(map, aispGeo);
      }
      if (cispGeo) {
        updateCispData(map, cispGeo);
      }
      applyBairrosVisibility(map, showBairros, selectedBairro);
      applyCodeVisibility(map, showRisp, LAYERS.risp_fill, LAYERS.risp_line, LAYERS.risp_label);
      applyCodeVisibility(map, showAisp, LAYERS.aisp_fill, LAYERS.aisp_line, LAYERS.aisp_label);
      applyCodeVisibility(map, showCisp, LAYERS.cisp_fill, LAYERS.cisp_line, LAYERS.cisp_label);
      updateGpsData(map, gps, gpsOnRef.current);
      updateSearchPin(map, searchPin);
      updateAreaDrawData(map, areaDrawPoints);
    });

    return () => {
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
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));

      setCameras(normalized);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Falha ao carregar câmeras");
    } finally {
      setLoadingCameras(false);
    }
  }

  async function loadCamerasIntel() {
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
          return { ...c, lat: lat ?? NaN, lng: lng ?? NaN };
        })
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));

      setCamerasIntel(normalized);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (!hasStreamingAccess && (msg.startsWith("401") || msg.startsWith("403"))) {
        setCamerasIntel([]);
        return;
      }
      console.error(e);
      alert(e?.message || "Falha ao carregar câmeras inteligentes");
    } finally {
      setLoadingCamerasIntel(false);
    }
  }

  async function loadCamerasLpr() {
    setLoadingCamerasLpr(true);
    try {
      const data = await fetchJson<any>(`${API_BASE}/cameras-lpr`, {
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
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));

      setCamerasLpr(normalized);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (!hasStreamingAccess && (msg.startsWith("401") || msg.startsWith("403"))) {
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
    setLoadingRadares(true);
    try {
      const data = await fetchJson<any>(`${API_BASE}/radares`, {
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      const list: Radar[] = Array.isArray(data) ? data : [];

      const normalized = list
        .map((r) => ({
          ...r,
          lat: r.lat === undefined || r.lat === null ? null : Number(r.lat),
          lng: r.lng === undefined || r.lng === null ? null : Number(r.lng),
        }))
        .filter((r) => Number.isFinite(r.lat as any) && Number.isFinite(r.lng as any));

      setRadares(normalized);
    } catch (e: any) {
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
    if (!selectedBairro) return;
    if (!selectedBairroFeature?.geometry) {
      setBairroReportMsg("Geometria do bairro não disponível para gerar relatório.");
      return;
    }
    setBairroReportLoading(true);
    setBairroReportMsg("Solicitando geração do relatório...");
    try {
      const payload = {
        bairro: selectedBairro,
        geometry: selectedBairroFeature.geometry,
        selected_ids: selectedBairroSelectionIds,
        layers: ["cameras", "cameras_inteligentes", "cameras_lpr", "radares"],
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

  function areaGeometryFromPoints(points: Array<[number, number]>) {
    if (points.length < 3) return null;
    const ring = [...points, points[0]];
    return {
      type: "Polygon",
      coordinates: [ring],
    };
  }

  function clearAreaDrawing() {
    setAreaDrawPoints([]);
    setAreaReportMsg(null);
  }

  function toggleAreaDrawing() {
    setAreaToolsOpen(true);
    setAreaDrawMode((prev) => !prev);
    setAreaReportMsg(null);
  }

  function removeLastAreaPoint() {
    setAreaDrawPoints((prev) => prev.slice(0, -1));
    setAreaReportMsg(null);
  }

  async function downloadAreaReport() {
    const geometry = areaGeometryFromPoints(areaDrawPoints);
    if (!geometry) {
      setAreaReportMsg("Desenhe uma área com pelo menos 3 pontos.");
      return;
    }

    setAreaReportLoading(true);
    setAreaReportMsg("Solicitando geração do relatório...");
    try {
      const payload = {
        name: `Relatório de Área - ${new Date().toISOString()}`,
        geometry,
        layers: ["cameras", "cameras_inteligentes", "cameras_lpr", "radares"],
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

  useEffect(() => {
    loadCameras();
    loadRadares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    loadCamerasIntel();
    loadCamerasLpr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    if (listMode === "inteligentes" && !loadingCamerasIntel && camerasIntel.length === 0) {
      loadCamerasIntel();
    }
    if (listMode === "lpr" && !loadingCamerasLpr && camerasLpr.length === 0) {
      loadCamerasLpr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listMode, authLoading, accessToken, loadingCamerasIntel, loadingCamerasLpr, camerasIntel.length, camerasLpr.length]);

  useEffect(() => {
    if (!gpsOn) return;

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
          heading: pos.coords.heading,
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
  }, [gpsOn]);

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
      const nome = (f.properties?.NOME || "").trim();
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
    return (bairrosGeo.features as BairrosFeature[]).find(
      (f) => (f.properties?.NOME || "").trim() === selectedBairro
    ) || null;
  }, [bairrosGeo, selectedBairro]);

  const selectedBairroStats = useMemo(() => {
    if (!selectedBairroFeature?.geometry) return null;
    const geom = selectedBairroFeature.geometry;
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
  }, [selectedBairroFeature, cameras, camerasIntel, camerasLpr, radares]);

  const selectedBairroSelectionIds = useMemo(() => {
    if (!selectedBairroFeature?.geometry) {
      return {
        cameras: [] as string[],
        super_cameras: [] as string[],
        lpr: [] as string[],
        radar: [] as string[],
      };
    }

    const geom = selectedBairroFeature.geometry;
    const bbox = getGeometryBbox(geom);
    if (!bbox) {
      return {
        cameras: [] as string[],
        super_cameras: [] as string[],
        lpr: [] as string[],
        radar: [] as string[],
      };
    }

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
      const idOrCode = String((c as any).id || c.code || "").trim();
      if (idOrCode) camerasIds.push(idOrCode);
    }

    for (const c of camerasIntel) {
      const lng = Number(c.lng);
      const lat = Number(c.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      if (!inBbox(lng, lat)) continue;
      if (!pointInGeometry([lng, lat], geom)) continue;
      const idOrCode = String((c as any).id || c.code || "").trim();
      if (idOrCode) superCameraIds.push(idOrCode);
    }

    for (const c of camerasLpr) {
      const lng = Number(c.lng);
      const lat = Number(c.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      if (!inBbox(lng, lat)) continue;
      if (!pointInGeometry([lng, lat], geom)) continue;
      const idOrCode = String((c as any).id || c.code || "").trim();
      if (idOrCode) lprIds.push(idOrCode);
    }

    for (const r of radares) {
      const lng = Number(r.lng);
      const lat = Number(r.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      if (!inBbox(lng, lat)) continue;
      if (!pointInGeometry([lng, lat], geom)) continue;
      const idOrCodcet = String((r as any).id || r.codcet || "").trim();
      if (idOrCodcet) radarIds.push(idOrCodcet);
    }

    return {
      cameras: camerasIds,
      super_cameras: superCameraIds,
      lpr: lprIds,
      radar: radarIds,
    };
  }, [selectedBairroFeature, cameras, camerasIntel, camerasLpr, radares]);

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
    if (!bairrosGeo) return;

    if (map.isStyleLoaded()) {
      ensureSourcesAndLayers(map);
      updateBairrosData(map, bairrosGeo);
      return;
    }

    const handleLoad = () => {
      ensureSourcesAndLayers(map);
      updateBairrosData(map, bairrosGeo);
    };
    map.once("load", handleLoad);
    return () => {
      map.off("load", handleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bairrosGeo]);

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
      applyCodeVisibility(map, showRisp, LAYERS.risp_fill, LAYERS.risp_line, LAYERS.risp_label);
      applyCodeVisibility(map, showAisp, LAYERS.aisp_fill, LAYERS.aisp_line, LAYERS.aisp_label);
      applyCodeVisibility(map, showCisp, LAYERS.cisp_fill, LAYERS.cisp_line, LAYERS.cisp_label);
      return;
    }

    const handleLoad = () => {
      ensureSourcesAndLayers(map);
      applyBairrosVisibility(map, showBairros, selectedBairro);
      applyCodeVisibility(map, showRisp, LAYERS.risp_fill, LAYERS.risp_line, LAYERS.risp_label);
      applyCodeVisibility(map, showAisp, LAYERS.aisp_fill, LAYERS.aisp_line, LAYERS.aisp_label);
      applyCodeVisibility(map, showCisp, LAYERS.cisp_fill, LAYERS.cisp_line, LAYERS.cisp_label);
    };
    map.once("load", handleLoad);
    return () => {
      map.off("load", handleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBairros, selectedBairro, showRisp, showAisp, showCisp]);

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
      (f) => (f.properties?.NOME || "").trim() === selectedBairro
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
      updateAreaDrawData(map, areaDrawPoints);
      return;
    }
    const handleLoad = () => {
      ensureSourcesAndLayers(map);
      updateAreaDrawData(map, areaDrawPoints);
    };
    map.once("load", handleLoad);
    return () => {
      map.off("load", handleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaDrawPoints]);

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

  async function handleSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchErr(null);
    setSearchQuery("");
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

    const coordMatch = q.match(
      /(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/i
    );
    if (coordMatch) {
      const lat = Number(coordMatch[1]);
      const lng = Number(coordMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        if (!isInRio(lat, lng)) {
          setSearchErr("Somente município do Rio de Janeiro.");
          return;
        }
        setSearchPin({ lng, lat });
        flyToPoint(lng, lat, 16);
        searchTimerRef.current = window.setTimeout(() => setSearchPin(null), 4000);
        return;
      }
    }

    if (!MAPBOX_TOKEN) {
      setSearchErr("Sem token do Mapbox.");
      return;
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
        return;
      }
      const [lng, lat] = center;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setSearchErr("Resultado inválido.");
        return;
      }
      if (!isInRio(lat, lng)) {
        setSearchErr("Somente município do Rio de Janeiro.");
        return;
      }
      setSearchPin({ lng, lat });
      const isAddress =
        Array.isArray(f.place_type) && (f.place_type.includes("address") || f.place_type.includes("poi"));
      flyToPoint(lng, lat, isAddress ? 17.5 : 16);
      searchTimerRef.current = window.setTimeout(() => setSearchPin(null), 4000);
    } catch (e: any) {
      setSearchErr(e?.message || "Falha ao buscar endereço.");
    }
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
        const hay = `${c.name} ${c.code} ${getLprNeighborhood(c)} ${c.direction ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (!q) return radares;
    return radares.filter((r) => {
      const hay = `${r.codcet} ${r.empresa ?? ""} ${r.bairro ?? ""} ${r.logradouro ?? ""} ${
        r.localidade ?? ""
      } ${r.sentido ?? ""} ${r.numero_equipamento ?? ""} ${r.status ?? ""}`.toLowerCase();
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
    const mq = window.matchMedia("(max-width: 860px), (max-height: 500px) and (pointer: coarse)");
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
    return cameras.find((c) => c.code === selectedCode) || null;
  }, [selectedCode, cameras]);

  useMemo(() => {
    if (!selectedRadar) return null;
    return radares.find((r) => r.codcet === selectedRadar) || null;
  }, [selectedRadar, radares]);

  const panelWidth = panel === "admin" ? 860 : 560;
  const panelMaxHeight = panel === "admin" || panel === "civitas" ? "74vh" : "56vh";
  const listTitle =
    listMode === "cameras"
      ? "Câmeras"
      : listMode === "inteligentes"
      ? "Super Câmeras Inteligentes"
      : listMode === "lpr"
      ? "Câmeras LPR"
      : "Radares";
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
        {showBairros && selectedBairro && selectedBairroStats && (
          <div
            className="dock"
            style={isMobile ? { width: "100%", maxWidth: 360 } : { minWidth: 220 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="dockTitle" style={{ marginBottom: 0 }}>Resumo</div>
              <button
                className="btnGhost"
                onClick={() => setSelectedBairro("")}
                style={{ width: 28, height: 28, padding: 0, borderRadius: 999, lineHeight: 1 }}
                title="Fechar resumo"
              >
                ✕
              </button>
            </div>
            <div className="dockNote" style={{ lineHeight: 1.4, marginTop: 6 }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <strong>
                  {selectedBairro} - Total:{" "}
                  {selectedBairroStats.cameras +
                    selectedBairroStats.inteligentes +
                    selectedBairroStats.lpr +
                    selectedBairroStats.radares}
                </strong>
              </div>
              <div>Câmeras: {selectedBairroStats.cameras}</div>
              <div>Super Câmeras Inteligentes: {selectedBairroStats.inteligentes}</div>
              <div>LPR: {selectedBairroStats.lpr}</div>
              <div>Radares: {selectedBairroStats.radares}</div>
              <div style={{ marginTop: 10 }}>
                <button
                  className="btnGhost"
                  onClick={downloadBairroReport}
                  disabled={bairroReportLoading}
                  style={{
                    width: "100%",
                    borderRadius: 10,
                    opacity: bairroReportLoading ? 0.7 : 1,
                  }}
                >
                  {bairroReportLoading ? "Gerando PDF..." : "Baixar PDF"}
                </button>
                {bairroReportMsg && (
                  <div style={{ marginTop: 6, fontSize: 10, color: "rgba(15,23,42,0.8)" }}>
                    {bairroReportMsg}
                  </div>
                )}
              </div>
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
            </div>
          </div>
        )}

        {!dockOpen && (
          <div
            className="dockHandle"
            title="Abrir controles"
            onClick={() => {
              setDockOpen(true);
              bumpDockAutoHide();
            }}
          >
            Controles
          </div>
        )}

        {dockOpen && (
          <>
            <div className="dock">
              <div className="dockTitle">Camadas</div>

            <button
              className={`dockChip ${showCameras ? "dockChipOn" : ""}`}
              onClick={() => {
                setShowCameras((v) => !v);
                bumpDockAutoHide();
                closeDockUnlessBairros();
              }}
              title={showCameras ? "Câmeras ON" : "Câmeras OFF"}
            >
              <span className="chipLeft">
                <span className="chipIcon">
                  <img src={cameraIcon} alt="" />
                </span>
                <span className="chipText">
                  <span>Câmeras</span>
                  <span className="chipLegend">Gravação de imagens</span>
                </span>
                <span className="chipDot" style={{ background: showCameras ? "#22c55e" : "#9ca3af" }} />
              </span>
              <span className="chipState">{showCameras ? "ON" : "OFF"}</span>
            </button>

            <button
              className={`dockChip ${showCamerasIntel ? "dockChipOn" : ""}`}
              onClick={() => {
                setShowCamerasIntel((v) => !v);
                bumpDockAutoHide();
                closeDockUnlessBairros();
              }}
              title={showCamerasIntel ? "Inteligentes ON" : "Inteligentes OFF"}
            >
              <span className="chipLeft">
                <span className="chipIcon">
                  <img src={cameraIntelIcon} alt="" />
                </span>
                <span className="chipText">
                  <span>Super Câmeras Inteligentes</span>
                  <span className="chipLegend">Gravações e analíticos de IA</span>
                </span>
                <span className="chipDot" style={{ background: showCamerasIntel ? "#22c55e" : "#9ca3af" }} />
              </span>
              <span className="chipState">{showCamerasIntel ? "ON" : "OFF"}</span>
            </button>

            <button
              className={`dockChip ${showCamerasLpr ? "dockChipOn" : ""}`}
              onClick={() => {
                setShowCamerasLpr((v) => !v);
                bumpDockAutoHide();
                closeDockUnlessBairros();
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

            <button
              className={`dockChip ${showRadares ? "dockChipOn" : ""}`}
              onClick={() => {
                setShowRadares((v) => !v);
                bumpDockAutoHide();
                closeDockUnlessBairros();
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

            <button
              className={`dockChip ${showBairros ? "dockChipOn" : ""}`}
              onClick={() => {
                setShowBairros((v) => !v);
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

            {showBairros && (
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
                        setDockOpen(false);
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
              </div>
            )}

            <button
              className="dockChip"
              onClick={() => {
                if (areaDrawMode) {
                  setAreaDrawMode(false);
                  setAreaDrawPoints([]);
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

            {areaToolsOpen && (
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.8)" }}>
                    Relatório por Área Desenhada
                  </div>
                  <button
                    className="btnGhost"
                    onClick={() => setAreaToolsOpen(false)}
                    style={{ width: 28, height: 28, padding: 0, borderRadius: 999, lineHeight: 1 }}
                    title="Fechar"
                  >
                    ✕
                  </button>
                </div>
                <div className="dockNote" style={{ margin: 0 }}>
                  Pontos da área: {areaDrawPoints.length}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <button
                    className="btnGhost"
                    onClick={toggleAreaDrawing}
                    style={{ borderRadius: 10, fontWeight: 800 }}
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
                    onClick={clearAreaDrawing}
                    disabled={areaDrawPoints.length === 0 || areaReportLoading}
                    style={{ borderRadius: 10, opacity: areaDrawPoints.length === 0 || areaReportLoading ? 0.5 : 1 }}
                  >
                    Limpar área
                  </button>
                  <button
                    className="btnGhost"
                    onClick={downloadAreaReport}
                    disabled={areaDrawPoints.length < 3 || areaReportLoading}
                    style={{ borderRadius: 10, opacity: areaDrawPoints.length < 3 || areaReportLoading ? 0.5 : 1 }}
                  >
                    {areaReportLoading ? "Gerando..." : "Baixar PDF"}
                  </button>
                </div>
                {areaReportMsg && (
                  <div className="dockNote" style={{ margin: 0, fontSize: 10 }}>
                    {areaReportMsg}
                  </div>
                )}
              </div>
            )}

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
                closeDockUnlessBairros();
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
            {showRisp && multiCodeWarnings.risp.length > 0 && (
              <div className="dockNote">
                Aviso: {multiCodeWarnings.risp.length} bairros com mais de uma RISP não foram coloridos. Ex.:{" "}
                {multiCodeWarnings.risp.slice(0, 4).join(", ")}
              </div>
            )}

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
                closeDockUnlessBairros();
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
            {showAisp && multiCodeWarnings.aisp.length > 0 && (
              <div className="dockNote">
                Aviso: {multiCodeWarnings.aisp.length} bairros com mais de uma AISP não foram coloridos. Ex.:{" "}
                {multiCodeWarnings.aisp.slice(0, 4).join(", ")}
              </div>
            )}

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
                closeDockUnlessBairros();
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
            {showCisp && multiCodeWarnings.cisp.length > 0 && (
              <div className="dockNote">
                Aviso: {multiCodeWarnings.cisp.length} bairros com mais de uma CISP não foram coloridos. Ex.:{" "}
                {multiCodeWarnings.cisp.slice(0, 4).join(", ")}
              </div>
            )}

            <button
              className={`dockChip ${gpsOn ? "dockChipOn" : ""} ${gpsErr ? "dockChipDisabled" : ""}`}
              onClick={() => {
                if (gpsErr) return;
                toggleGps();
                closeDockUnlessBairros();
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

            {gpsOn && gps && !gpsErr && (
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

            {gpsErr && <div className="dockNote">GPS com erro</div>}

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

          <button
            className={`tabBtn ${panel === "civitas" ? "tabBtnActive" : ""}`}
            onClick={() => togglePanel("civitas")}
            title="Clique de novo pra fechar"
          >
            RECURSOS
          </button>

          {isAdmin && (
            <button
              className={`tabBtn ${panel === "admin" ? "tabBtnActive" : ""}`}
              onClick={() => togglePanel("admin")}
              title="Clique de novo pra fechar"
            >
              ADMINISTRADOR
            </button>
          )}

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="Buscar rua ou coordenadas no RJ"
              style={{ ...inputStyle(), maxWidth: 320, padding: "8px 10px" }}
            />
            <button className="btnGhost" onClick={handleSearch} title="Buscar">
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
          className="desktopPanels panelCard"
          style={{
            position: "absolute",
            top: 90,
            left: 16,
            width: panelWidth,
            maxWidth: "calc(100vw - 32px)",
            zIndex: 20,
            padding: 14,
            color: "#0b0b0f",
            marginLeft: 0,
          }}
        >
          {panel === "map" && (
            <>
              <div style={{ marginBottom: 12, display: "grid", gap: 12 }}>
                <div className="tabsRail scrollbarHidden" style={{ flexWrap: "nowrap", overflowX: "auto" }}>
                  <button
                    className={`subTab ${listMode === "cameras" ? "subTabActive" : ""}`}
                    onClick={() => setListMode("cameras")}
                  >
                    Câmeras
                  </button>
                  <button
                    className={`subTab ${listMode === "inteligentes" ? "subTabActive" : ""}`}
                    onClick={() => setListMode("inteligentes")}
                  >
                    Super Câmeras Inteligentes
                  </button>
                  <button
                    className={`subTab ${listMode === "lpr" ? "subTabActive" : ""}`}
                    onClick={() => setListMode("lpr")}
                  >
                    LPR
                  </button>
                  <button
                    className={`subTab ${listMode === "radares" ? "subTabActive" : ""}`}
                    onClick={() => setListMode("radares")}
                  >
                    Radares
                  </button>
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
                      : "Buscar por CODCET, bairro, logradouro, sentido..."
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
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 999,
                              border: "1px solid rgba(59,130,246,0.30)",
                              background: "rgba(219,234,254,0.90)",
                              display: "grid",
                              placeItems: "center",
                              flex: "0 0 auto",
                            }}
                          >
                            <img src={cameraIcon} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
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
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  borderRadius: 999,
                                  padding: "2px 8px",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  border: "1px solid rgba(59,130,246,0.32)",
                                  background: "rgba(219,234,254,0.92)",
                                  color: "#1d4ed8",
                                }}
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
                              {hasStreamingAccess && streamUrl && (
                                <a
                                  href={streamUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    borderRadius: 999,
                                    padding: "2px 8px",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    border: "1px solid rgba(15,23,42,0.18)",
                                    background: "rgba(241,245,249,0.95)",
                                    color: "#0f172a",
                                    textDecoration: "none",
                                  }}
                                >
                                  Abrir streaming
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {listMode === "inteligentes" &&
                  (listItems as CameraIntel[]).map((c) => (
                    <div
                      key={c.code}
                      className="listItem"
                      onClick={() => {
                        setSelectedCode(null);
                        setSelectedRadar(null);
                        focusOnDetection(c.lng, c.lat);
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            border: "1px solid rgba(234,88,12,0.30)",
                            background: "rgba(255,237,213,0.92)",
                            display: "grid",
                            placeItems: "center",
                            flex: "0 0 auto",
                          }}
                        >
                          <img src={cameraIntelIcon} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
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
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 11,
                                fontWeight: 800,
                                border: "1px solid rgba(234,88,12,0.30)",
                                background: "rgba(255,237,213,0.92)",
                                color: "#c2410c",
                              }}
                            >
                              {c.code}
                            </span>
                          </div>
                          {/* <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                              Responsável: {c.responsavel || (c as any).responsavel || "-"}
                            </span>
                            <span style={{ fontSize: 11, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                              Direção: {c.direction || "-"}
                            </span>
                          </div> */}
                        </div>
                      </div>
                    </div>
                  ))}

                {listMode === "lpr" &&
                  (listItems as CameraLpr[]).map((c) => (
                    <div
                      key={c.code}
                      className="listItem"
                      onClick={() => {
                        setSelectedCode(null);
                        setSelectedRadar(null);
                        focusOnDetection(c.lng, c.lat);
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            border: "1px solid rgba(22,163,74,0.30)",
                            background: "rgba(220,252,231,0.92)",
                            display: "grid",
                            placeItems: "center",
                            flex: "0 0 auto",
                          }}
                        >
                          <img src={cameraLprIcon} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
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
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 11,
                                fontWeight: 800,
                                border: "1px solid rgba(22,163,74,0.30)",
                                background: "rgba(220,252,231,0.92)",
                                color: "#166534",
                              }}
                            >
                              {c.code}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                              Bairro: {getLprNeighborhood(c) || "-"}
                            </span>
                            <span style={{ fontSize: 11, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                              Direção: {c.direction || "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                {listMode === "radares" &&
                  (listItems as Radar[]).map((r) => {
                    const lat = Number(r.lat);
                    const lng = Number(r.lng);
                    const ok = Number.isFinite(lat) && Number.isFinite(lng);
                    return (
                      <div
                        key={r.codcet}
                        className="listItem"
                        onClick={() => {
                          if (!ok) return;
                          setSelectedRadar(r.codcet);
                          setSelectedCode(null);
                          focusOnDetection(lng, lat);
                        }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                border: "1px solid rgba(234,88,12,0.30)",
                                background: "rgba(255,237,213,0.92)",
                                display: "grid",
                                placeItems: "center",
                                flex: "0 0 auto",
                              }}
                            >
                              <img src={radarIcon} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
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
                                  {r.logradouro || r.localidade || "Radar"}
                                </div>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    borderRadius: 999,
                                    padding: "2px 8px",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    border: "1px solid rgba(234,88,12,0.30)",
                                    background: "rgba(255,237,213,0.92)",
                                    color: "#c2410c",
                                  }}
                                >
                                  {r.codcet}
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
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
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>Perfil</div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.90)",
                  border: "1px solid rgba(0,0,0,0.10)",
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8 }}>Dados do usuário</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 12,fontWeight: 900}}>Nome</div>
                  <div style={{ fontSize: 13,  }}>{me?.full_name || "-"}</div>
                  <div style={{ fontSize: 12, fontWeight: 900, marginTop: 6 }}>Email</div>
                  <div style={{ fontSize: 13, opacity: 0.7 }}>{me?.email || "-"}</div>
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
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(0,0,0,0.86)",
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

          {panel === "civitas" && (
            <>
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>
                Ferramentas da CIVITAS e Como Solicitar as Informações
              </div>

              <div className="scrollbarHidden" style={{ display: "grid", gap: 10, maxHeight: panelMaxHeight, overflow: "auto" }}>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.95)",
                    border: "1px solid rgba(0,0,0,0.10)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>
                    Quadro-resumo das ferramentas da CIVITAS
                  </div>
                  {!isMobile ? (
                    <div style={{ width: "100%", overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", border: "1px solid #000", padding: 8 }}>Ferramenta</th>
                            <th style={{ textAlign: "left", border: "1px solid #000", padding: 8 }}>O que é</th>
                            <th style={{ textAlign: "left", border: "1px solid #000", padding: 8 }}>Quando utilizar</th>
                            <th style={{ textAlign: "left", border: "1px solid #000", padding: 8 }}>Resultado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {civitasToolsSummary.map((row) => (
                            <tr key={row.tool}>
                              <td style={{ border: "1px solid #000", padding: 8, fontWeight: 700 }}>{row.tool}</td>
                              <td style={{ border: "1px solid #000", padding: 8 }}>{row.what}</td>
                              <td style={{ border: "1px solid #000", padding: 8 }}>{row.when}</td>
                              <td style={{ border: "1px solid #000", padding: 8 }}>{row.result}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {civitasToolsSummary.map((row) => (
                        <div
                          key={row.tool}
                          style={{
                            border: "1px solid rgba(0,0,0,0.14)",
                            borderRadius: 12,
                            padding: 10,
                            background: "rgba(255,255,255,0.96)",
                            minWidth: 0,
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>{row.tool}</div>
                          <div style={{ fontSize: 12, lineHeight: 1.4, wordBreak: "break-word" }}>
                            <strong>O que é:</strong> {row.what}
                          </div>
                          <div style={{ fontSize: 12, lineHeight: 1.4, marginTop: 4, wordBreak: "break-word" }}>
                            <strong>Quando utilizar:</strong> {row.when}
                          </div>
                          <div style={{ fontSize: 12, lineHeight: 1.4, marginTop: 4, wordBreak: "break-word" }}>
                            <strong>Resultado:</strong> {row.result}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.95)",
                    border: "1px solid rgba(0,0,0,0.10)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>
                    Como solicitar o uso das funcionalidades da CIVITAS
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: "#111827" }}>
                    Para usufruir das funcionalidades disponíveis no App CIVITAS e dos relatórios analíticos associados ao
                    cerco eletrônico, a solicitação deve ser iniciada formalmente por meio de ofício, conforme previsto em
                    lei,{" "}
                    <a
                      href="https://leis.org/municipais/rj/rio-de-janeiro/lei/decreto/2026/57481/decreto-n-57481-2026-dispoe-sobre-o-compartilhamento-tratamento-e-protecao-de-dados-e-imagens-no-ambito-da-central-de-inteligencia-vigilancia-e-tecnologia-de-apoio-a-seguranca-publica-civitas-e-da-outras-providencias"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#1d4ed8", textDecoration: "underline" }}
                    >
                      DECRETO RIO Nº 57.481, DE 12 DE JANEIRO DE 2026
                    </a>
                    .
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: "#111827", marginTop: 8 }}>
                    As solicitações devem ser encaminhadas por ofício eletrônico, assinado digitalmente pela autoridade
                    competente do órgão e enviado ao endereço{" "}
                    <strong style={{ fontWeight: 900 }}>civitas@dados.rio</strong>. O documento deve conter o número e a data
                    do ofício, a identificação do órgão requerente, os contatos do ponto focal responsável (e-mail e
                    telefone) e a descrição objetiva da informação solicitada, incluindo local, data, horário, dinâmica e
                    demais elementos relevantes para a análise da demanda.
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <a
                      href="/Modelo%20Of%C3%ADcio%20CIVITAS%20-%20JAN26.pdf"
                      download
                      className="btnGhost"
                      style={{ display: "inline-block", padding: "8px 12px", borderRadius: 10 }}
                    >
                    Modelo de ofício para solicitar informações (baixar PDF)
                    </a>
                  </div>
                </div>
              </div>
            </>
          )}

          {panel === "admin" && isAdmin && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>Administrador</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Gerenciamento completo
                </div>

                <div style={{ flex: 1 }} />

                <div className="tabsRail tabsRailAdmin">
                  <button
                    className={`subTab ${adminTab === "users" ? "subTabActive" : ""}`}
                    onClick={() => setAdminTab("users")}
                  >
                    Usuários
                  </button>
                  <button
                    className={`subTab ${adminTab === "cameras" ? "subTabActive" : ""}`}
                    onClick={() => setAdminTab("cameras")}
                  >
                    Câmeras
                  </button>
                  <button
                    className={`subTab ${adminTab === "radares" ? "subTabActive" : ""}`}
                    onClick={() => setAdminTab("radares")}
                  >
                    Radares
                  </button>
                  <button
                    className={`subTab ${adminTab === "logs" ? "subTabActive" : ""}`}
                    onClick={() => setAdminTab("logs")}
                  >
                    Logs
                  </button>
                </div>
              </div>

              <div className="scrollbarHidden" style={{ maxHeight: panelMaxHeight, overflow: "auto" }}>
                {adminTab === "users" && <AdminUsersPanel apiBase={API_BASE} token={accessToken} isMobile={isMobile} />}
                {adminTab === "cameras" && (
                  <AdminCamerasPanel
                    apiBase={API_BASE}
                    token={accessToken}
                    onSynced={() => {
                      loadCameras();
                    }}
                    isMobile={isMobile}
                  />
                )}
                {adminTab === "radares" && (
                  <AdminRadaresPanel
                    apiBase={API_BASE}
                    token={accessToken}
                    onSynced={() => {
                      loadRadares();
                    }}
                    isMobile={isMobile}
                  />
                )}
                {adminTab === "logs" && <AdminLogsPanel apiBase={API_BASE} token={accessToken} isMobile={isMobile} />}
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
              className="btnGhost"
              onClick={() => {
                if (panelOpen) {
                  setPanelOpen(false);
                  setMobileMenuOpen(true);
                  return;
                }
                setMobileMenuOpen((v) => !v);
              }}
              style={{
                width: 44,
                height: 36,
                padding: 0,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
              }}
              aria-label="Abrir menu"
              title="Menu"
            >
              <span style={{ display: "grid", gap: 3 }}>
                <span style={{ width: 18, height: 2, background: "rgba(0,0,0,0.85)", borderRadius: 999 }} />
                <span style={{ width: 18, height: 2, background: "rgba(0,0,0,0.85)", borderRadius: 999 }} />
                <span style={{ width: 18, height: 2, background: "rgba(0,0,0,0.85)", borderRadius: 999 }} />
              </span>
            </button>

            {mobileMenuOpen && (
              <div
                className="glassStrong"
                style={{
                  position: "absolute",
                  right: -6,
                  top: "calc(100% + 14px)",
                  padding: 8,
                  display: "grid",
                  gap: 6,
                  zIndex: 40,
                  minWidth: 140,
                }}
              >
                <button
                  className="btnGhost"
                  onClick={() => {
                    setMobileSearchOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  style={{ width: "100%", borderRadius: 10 }}
                >
                  BUSCAR LOCAL
                </button>
                <button
                  className="btnGhost"
                  onClick={() => {
                    setPanelOpen((v) => !v);
                    setMobileMenuOpen(false);
                  }}
                  style={{ width: "100%", borderRadius: 10 }}
                >
                  {panelOpen ? "Fechar menu" : "Menu"}
                </button>
                <button
                  className="btnGhost"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    auth?.logout?.();
                    try {
                      nav("/login", { replace: true });
                    } catch {
                      window.location.href = "/login";
                    }
                  }}
                  style={{ width: "100%", borderRadius: 10 }}
                >
                  SAIR
                </button>
              </div>
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
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <button
                className={`tabBtn ${panel === "map" ? "tabBtnActive" : ""}`}
                onClick={() => {
                  setPanel((cur) => {
                    const next = cur === "map" ? null : "map";
                    if (next === null) setPanelOpen(false);
                    return next;
                  });
                }}
              >
                CENTRAL
              </button>

              <button
                className={`tabBtn ${panel === "profile" ? "tabBtnActive" : ""}`}
                onClick={() => {
                  setPanel((cur) => {
                    const next = cur === "profile" ? null : "profile";
                    if (next === null) setPanelOpen(false);
                    return next;
                  });
                }}
              >
                PERFIL
              </button>

              <button
                className={`tabBtn ${panel === "civitas" ? "tabBtnActive" : ""}`}
                onClick={() => {
                  setPanel((cur) => {
                    const next = cur === "civitas" ? null : "civitas";
                    if (next === null) setPanelOpen(false);
                    return next;
                  });
                }}
              >
                RECURSOS
              </button>

              {isAdmin && (
                <button
                  className={`tabBtn ${panel === "admin" ? "tabBtnActive" : ""}`}
                  onClick={() => {
                    setPanel((cur) => {
                      const next = cur === "admin" ? null : "admin";
                      if (next === null) setPanelOpen(false);
                      return next;
                    });
                  }}
                >
                  ADMINISTRADOR
                </button>
              )}

              <div style={{ flex: 1 }} />
            </div>

            {panel === "map" && (
              <>
                <div style={{ marginBottom: 12, display: "grid", gap: 12 }}>
                  <div className="tabsRail scrollbarHidden" style={{ flexWrap: "nowrap", overflowX: "auto" }}>
                    <button
                      className={`subTab ${listMode === "cameras" ? "subTabActive" : ""}`}
                      onClick={() => setListMode("cameras")}
                    >
                      Câmeras
                    </button>
                    <button
                      className={`subTab ${listMode === "inteligentes" ? "subTabActive" : ""}`}
                      onClick={() => setListMode("inteligentes")}
                    >
                      Super Câmeras Inteligentes
                    </button>
                    <button
                      className={`subTab ${listMode === "lpr" ? "subTabActive" : ""}`}
                      onClick={() => setListMode("lpr")}
                    >
                      LPR
                    </button>
                    <button
                      className={`subTab ${listMode === "radares" ? "subTabActive" : ""}`}
                      onClick={() => setListMode("radares")}
                    >
                      Radares
                    </button>
                  </div>
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
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                border: "1px solid rgba(59,130,246,0.30)",
                                background: "rgba(219,234,254,0.90)",
                                display: "grid",
                                placeItems: "center",
                                flex: "0 0 auto",
                              }}
                            >
                              <img src={cameraIcon} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
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
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    borderRadius: 999,
                                    padding: "1px 7px",
                                    fontSize: 10,
                                    fontWeight: 800,
                                    border: "1px solid rgba(59,130,246,0.32)",
                                    background: "rgba(219,234,254,0.92)",
                                    color: "#1d4ed8",
                                  }}
                                >
                                  {c.code}
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 10, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "1px 7px" }}>
                                  {String((c as any).zona_camera ?? (c as any).zone ?? "").trim() ||
                                    [c.city, c.uf].filter(Boolean).join(" - ") ||
                                    "-"}
                                </span>
                                {hasStreamingAccess && streamUrl && (
                                  <a
                                    href={streamUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      borderRadius: 999,
                                      padding: "1px 7px",
                                      fontSize: 10,
                                      fontWeight: 800,
                                      border: "1px solid rgba(15,23,42,0.18)",
                                      background: "rgba(241,245,249,0.95)",
                                      color: "#0f172a",
                                      textDecoration: "none",
                                    }}
                                  >
                                    Abrir streaming
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {listMode === "inteligentes" &&
                    (listItems as CameraIntel[]).map((c) => (
                      <div
                        key={c.code}
                        className="listItem"
                        onClick={() => {
                          setSelectedCode(null);
                          setSelectedRadar(null);
                          focusOnDetection(c.lng, c.lat);
                          setPanelOpen(false);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 999,
                              border: "1px solid rgba(234,88,12,0.30)",
                              background: "rgba(255,237,213,0.92)",
                              display: "grid",
                              placeItems: "center",
                              flex: "0 0 auto",
                            }}
                          >
                            <img src={cameraIntelIcon} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
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
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  borderRadius: 999,
                                  padding: "1px 7px",
                                  fontSize: 10,
                                  fontWeight: 800,
                                  border: "1px solid rgba(234,88,12,0.30)",
                                  background: "rgba(255,237,213,0.92)",
                                  color: "#c2410c",
                                }}
                              >
                                {c.code}
                              </span>
                            </div>
                            {/* <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 10, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "1px 7px" }}>
                                Responsável: {c.responsavel || (c as any).responsavel || "-"}
                              </span>
                              <span style={{ fontSize: 10, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "1px 7px" }}>
                                Direção: {c.direction || "-"}
                              </span>
                            </div> */}
                          </div>
                        </div>
                      </div>
                    ))}

                  {listMode === "lpr" &&
                    (listItems as CameraLpr[]).map((c) => (
                      <div
                        key={c.code}
                        className="listItem"
                        onClick={() => {
                          setSelectedCode(null);
                          setSelectedRadar(null);
                          focusOnDetection(c.lng, c.lat);
                          setPanelOpen(false);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 999,
                              border: "1px solid rgba(22,163,74,0.30)",
                              background: "rgba(220,252,231,0.92)",
                              display: "grid",
                              placeItems: "center",
                              flex: "0 0 auto",
                            }}
                          >
                            <img src={cameraLprIcon} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
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
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  borderRadius: 999,
                                  padding: "1px 7px",
                                  fontSize: 10,
                                  fontWeight: 800,
                                  border: "1px solid rgba(22,163,74,0.30)",
                                  background: "rgba(220,252,231,0.92)",
                                  color: "#166534",
                                }}
                              >
                                {c.code}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 10, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "1px 7px" }}>
                                Bairro: {getLprNeighborhood(c) || "-"}
                              </span>
                              <span style={{ fontSize: 10, opacity: 0.8, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 999, padding: "1px 7px" }}>
                                Direção: {c.direction || "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {listMode === "radares" &&
                    (listItems as Radar[]).map((r) => {
                      const lat = Number(r.lat);
                      const lng = Number(r.lng);
                      const ok = Number.isFinite(lat) && Number.isFinite(lng);

                      return (
                        <div
                          key={r.codcet}
                          className="listItem"
                          onClick={() => {
                            if (!ok) return;
                            setSelectedRadar(r.codcet);
                            setSelectedCode(null);
                            focusOnDetection(lng, lat);
                            setPanelOpen(false);
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                border: "1px solid rgba(234,88,12,0.30)",
                                background: "rgba(255,237,213,0.92)",
                                display: "grid",
                                placeItems: "center",
                                flex: "0 0 auto",
                              }}
                            >
                              <img src={radarIcon} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
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
                                  {r.logradouro || r.localidade || "Radar"}
                                </div>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    borderRadius: 999,
                                    padding: "2px 8px",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    border: "1px solid rgba(234,88,12,0.30)",
                                    background: "rgba(255,237,213,0.92)",
                                    color: "#c2410c",
                                  }}
                                >
                                  {r.codcet}
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
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
                    background: "rgba(255,255,255,0.90)",
                    border: "1px solid rgba(0,0,0,0.10)",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8 }}>Dados do usuário</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 900 }}>Nome</div>
                    <div style={{ fontSize: 13 }}>{me?.full_name || "-"}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, marginTop: 6 }}>Email</div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>{me?.email || "-"}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, marginTop: 6 }}>Perfil de acesso</div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>
                      {roleLabel(role)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 2 }}>Trocar senha</div>
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
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(0,0,0,0.86)",
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
                        background: "rgba(255,255,255,0.90)",
                        border: "1px solid rgba(0,0,0,0.10)",
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

            {panel === "civitas" && (
              <>
                <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>
                  Ferramentas da CIVITAS e Como Solicitar as Informações
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.95)",
                    border: "1px solid rgba(0,0,0,0.10)",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>
                    Quadro-resumo das ferramentas da CIVITAS
                  </div>
                  {!isMobile ? (
                    <div style={{ width: "100%", overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", border: "1px solid #000", padding: 8 }}>Ferramenta</th>
                            <th style={{ textAlign: "left", border: "1px solid #000", padding: 8 }}>O que é</th>
                            <th style={{ textAlign: "left", border: "1px solid #000", padding: 8 }}>Quando utilizar</th>
                            <th style={{ textAlign: "left", border: "1px solid #000", padding: 8 }}>Resultado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {civitasToolsSummary.map((row) => (
                            <tr key={row.tool}>
                              <td style={{ border: "1px solid #000", padding: 8, fontWeight: 700 }}>{row.tool}</td>
                              <td style={{ border: "1px solid #000", padding: 8 }}>{row.what}</td>
                              <td style={{ border: "1px solid #000", padding: 8 }}>{row.when}</td>
                              <td style={{ border: "1px solid #000", padding: 8 }}>{row.result}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {civitasToolsSummary.map((row) => (
                        <div
                          key={row.tool}
                          style={{
                            border: "1px solid rgba(0,0,0,0.14)",
                            borderRadius: 12,
                            padding: 10,
                            background: "rgba(255,255,255,0.96)",
                            minWidth: 0,
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>{row.tool}</div>
                          <div style={{ fontSize: 12, lineHeight: 1.4, wordBreak: "break-word" }}>
                            <strong>O que é:</strong> {row.what}
                          </div>
                          <div style={{ fontSize: 12, lineHeight: 1.4, marginTop: 4, wordBreak: "break-word" }}>
                            <strong>Quando utilizar:</strong> {row.when}
                          </div>
                          <div style={{ fontSize: 12, lineHeight: 1.4, marginTop: 4, wordBreak: "break-word" }}>
                            <strong>Resultado:</strong> {row.result}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.95)",
                    border: "1px solid rgba(0,0,0,0.10)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>
                    Como solicitar o uso das funcionalidades da CIVITAS
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: "#111827" }}>
                    Para usufruir das funcionalidades disponíveis no App CIVITAS e dos relatórios analíticos associados ao
                    cerco eletrônico, a solicitação deve ser iniciada formalmente por meio de ofício, conforme previsto em
                    lei,{" "}
                    <a
                      href="https://leis.org/municipais/rj/rio-de-janeiro/lei/decreto/2026/57481/decreto-n-57481-2026-dispoe-sobre-o-compartilhamento-tratamento-e-protecao-de-dados-e-imagens-no-ambito-da-central-de-inteligencia-vigilancia-e-tecnologia-de-apoio-a-seguranca-publica-civitas-e-da-outras-providencias"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#1d4ed8", textDecoration: "underline" }}
                    >
                      DECRETO RIO Nº 57.481, DE 12 DE JANEIRO DE 2026
                    </a>
                    .
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: "#111827", marginTop: 8 }}>
                    As solicitações devem ser encaminhadas por ofício eletrônico, assinado digitalmente pela autoridade
                    competente do órgão e enviado ao endereço{" "}
                    <strong style={{ fontWeight: 900 }}>civitas@dados.rio</strong>. O documento deve conter o número e a data
                    do ofício, a identificação do órgão requerente, os contatos do ponto focal responsável (e-mail e
                    telefone) e a descrição objetiva da informação solicitada, incluindo local, data, horário, dinâmica e
                    demais elementos relevantes para a análise da demanda.
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <a
                      href="/Modelo%20Of%C3%ADcio%20CIVITAS%20-%20JAN26.pdf"
                      download
                      className="btnGhost"
                      style={{ display: "inline-block", padding: "8px 12px", borderRadius: 10 }}
                    >
                      Modelo de ofício para solicitar informações (baixar PDF)
                    </a>
                  </div>
                </div>
              </>
            )}

            {panel === "admin" && isAdmin && (
              <>
                <div className="tabsRail tabsRailAdmin tabsRailAdminMobile">
                  <button
                    className={`subTab ${adminTab === "users" ? "subTabActive" : ""}`}
                    onClick={() => setAdminTab("users")}
                  >
                    Usuários
                  </button>
                  <button
                    className={`subTab ${adminTab === "cameras" ? "subTabActive" : ""}`}
                    onClick={() => setAdminTab("cameras")}
                  >
                    Câmeras
                  </button>
                  <button
                    className={`subTab ${adminTab === "radares" ? "subTabActive" : ""}`}
                    onClick={() => setAdminTab("radares")}
                  >
                    Radares
                  </button>
                  <button
                    className={`subTab ${adminTab === "logs" ? "subTabActive" : ""}`}
                    onClick={() => setAdminTab("logs")}
                  >
                    Logs
                  </button>
                </div>

                {adminTab === "users" && <AdminUsersPanel apiBase={API_BASE} token={accessToken} isMobile={isMobile} />}
                {adminTab === "cameras" && (
                  <AdminCamerasPanel
                    apiBase={API_BASE}
                    token={accessToken}
                    onSynced={() => loadCameras()}
                    isMobile={isMobile}
                  />
                )}
                {adminTab === "radares" && (
                  <AdminRadaresPanel
                    apiBase={API_BASE}
                    token={accessToken}
                    onSynced={() => loadRadares()}
                    isMobile={isMobile}
                  />
                )}
                {adminTab === "logs" && <AdminLogsPanel apiBase={API_BASE} token={accessToken} isMobile={isMobile} />}
              </>
            )}
          </div>
        )}
      </div>

      {mobileSearchOpen && (
        <div
          className="glassStrong"
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 26,
            padding: 10,
            display: "flex",
            gap: 8,
            alignItems: "center",
            color: "#0b0b0f",
          }}
        >
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
                setMobileSearchOpen(false);
              }
            }}
            placeholder="Buscar rua ou coordenadas no RJ"
            style={{ ...inputStyle(), flex: 1 }}
          />
          <button
            className="btnGhost"
            onClick={() => {
              handleSearch();
              setMobileSearchOpen(false);
            }}
            title="Buscar"
          >
            BUSCAR
          </button>
          <button
            className="btnGhost"
            onClick={() => {
              setMobileSearchOpen(false);
            }}
            title="Fechar"
            style={{ padding: "8px 10px" }}
          >
            ✕
          </button>
        </div>
      )}

      {mobileSearchOpen && searchErr && (
        <div
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 68,
            zIndex: 26,
            fontSize: 11,
            color: "#991b1b",
            textAlign: "center",
          }}
        >
          {searchErr}
        </div>
      )}
    </div>
  );
}
