// src/pages/MapPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { FeatureCollection, Feature, Point, Polygon, MultiPolygon } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import { useAuth } from "../app/auth";
import { fetchJson, inputStyle } from "./map/shared";
import type { Camera, CameraIntel, CameraLpr, Me, Radar } from "./map/types";
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


type TabKey = "map" | "profile" | "admin";
type PanelKey = TabKey | null;

type AdminTab = "users" | "logs" | "cameras" | "radares";


const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL?.toString() || "http://localhost:8000";

const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN?.toString() || "";

// só dark streets
const MAP_STYLE_DARK = "mapbox://styles/mapbox/dark-v11" as const;
const PAGE_SIZE = 50;

// IDs fixos
const SOURCES = {
  pois: "src-pois",
  gps: "src-gps",
  search: "src-search",
  bairros: "src-bairros",
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
  search_pin: "lyr-search-pin",
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

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function normalizeBairroName(name: string, stripParens: boolean) {
  let n = (name || "").trim();
  if (stripParens) n = n.replace(/\s*\(.*?\)\s*/g, " ");
  n = n
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return n;
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
  const expr: any[] = ["match", ["to-number", ["get", key]]];
  values.forEach((v, i) => {
    expr.push(v, colorForIndex(i));
  });
  expr.push("rgba(0,0,0,0)");
  return expr;
}

function parseMultiCodes(value: any) {
  if (Array.isArray(value)) return value.filter((v) => v !== null && v !== undefined);
  if (typeof value === "string") {
    const parts = value.split(/[;,/]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  return null;
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
  return list.map((c) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [c.lng, c.lat] },
    properties: {
      kind: "camera",
      code: c.code,
      name: c.name,
      city: c.city,
      uf: c.uf,
      address: c.address || "",
      is_active: c.is_active ? 1 : 0,
    },
  }));
}

function camerasIntelToFeatures(list: CameraIntel[]): Feature<Point, any>[] {
  return list.map((c) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [c.lng, c.lat] },
    properties: {
      kind: "camera_intel",
      code: c.code,
      name: c.name,
      ip: c.ip ?? "",
      direction: c.direction ?? "",
      is_active: c.is_active ? 1 : 0,
    },
  }));
}

function camerasLprToFeatures(list: CameraLpr[]): Feature<Point, any>[] {
  return list.map((c) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [c.lng, c.lat] },
    properties: {
      kind: "camera_lpr",
      code: c.code,
      name: c.name,
      ip: c.ip ?? "",
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

export default function MapPage() {
  const auth: any = useAuth();

  const accessToken =
    auth?.accessToken || auth?.token || localStorage.getItem("access_token") || "";

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const handlersBoundRef = useRef(false);
  const iconsLoadedRef = useRef(false);

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
  const [selectedBairro, setSelectedBairro] = useState<string>("");
  const [bairroQuery, setBairroQuery] = useState<string>("");

  const [listMode, setListMode] = useState<"cameras" | "inteligentes" | "lpr" | "radares">("cameras");
  const [query, setQuery] = useState("");
  const [pageCameras, setPageCameras] = useState(1);
  const [pageIntel, setPageIntel] = useState(1);
  const [pageLpr, setPageLpr] = useState(1);
  const [pageRadares, setPageRadares] = useState(1);
  const [mobileCountCameras, setMobileCountCameras] = useState(PAGE_SIZE);
  const [mobileCountIntel, setMobileCountIntel] = useState(PAGE_SIZE);
  const [mobileCountLpr, setMobileCountLpr] = useState(PAGE_SIZE);
  const [mobileCountRadares, setMobileCountRadares] = useState(PAGE_SIZE);

  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [meErr, setMeErr] = useState<string | null>(null);

  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
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
  useEffect(() => {
    gpsOnRef.current = gpsOn;
  }, [gpsOn]);

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

  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);

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

  const role = (me?.role || "user").toLowerCase();
  const isAdmin = role === "admin";

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
      zoom: zoom ?? clamp(map.getZoom(), 12, 15),
      speed: 1.2,
      curve: 1.4,
      essential: true,
    });
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

    if (!map.getSource(SOURCES.bairros)) {
      map.addSource(SOURCES.bairros, {
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
        source: SOURCES.bairros,
        layout: { visibility: "none" },
        filter: ["has", "RISP"],
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
        source: SOURCES.bairros,
        layout: { visibility: "none" },
        filter: ["has", "RISP"],
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
        source: SOURCES.bairros,
        filter: ["has", "RISP"],
        layout: {
          visibility: "none",
          "text-field": ["concat", ["to-string", ["get", "RISP"]], "ª RISP"],
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
        source: SOURCES.bairros,
        layout: { visibility: "none" },
        filter: ["has", "AISP"],
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
        source: SOURCES.bairros,
        layout: { visibility: "none" },
        filter: ["has", "AISP"],
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
        source: SOURCES.bairros,
        filter: ["has", "AISP"],
        layout: {
          visibility: "none",
          "text-field": ["concat", ["to-string", ["get", "AISP"]], "ª AISP"],
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
        source: SOURCES.bairros,
        layout: { visibility: "none" },
        filter: ["has", "CISP"],
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
        source: SOURCES.bairros,
        layout: { visibility: "none" },
        filter: ["has", "CISP"],
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
        source: SOURCES.bairros,
        filter: ["has", "CISP"],
        layout: {
          visibility: "none",
          "text-field": ["concat", ["to-string", ["get", "CISP"]], "ª CISP"],
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
      LAYERS.gps_accuracy,
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

  function updateBairrosData(
    map: mapboxgl.Map,
    data: FeatureCollection<Polygon | MultiPolygon, any>
  ) {
    const src: any = map.getSource(SOURCES.bairros);
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

  function updateGpsData(map: mapboxgl.Map, gpsData: typeof gps | null, isOn: boolean) {
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
      properties: { kind: "gps_point" },
    });

    src.setData({ type: "FeatureCollection", features });
  }

  function bindInteractionsOnce(map: mapboxgl.Map) {
    if (handlersBoundRef.current) return;
    handlersBoundRef.current = true;

    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({ offset: 12, closeButton: true });
    }
    const popup = popupRef.current;

    function setCursorPointer() {
      map.getCanvas().style.cursor = "pointer";
    }
    function setCursorDefault() {
      map.getCanvas().style.cursor = "";
    }

    const hoverLayerIds = [
      LAYERS.cameras_points,
      LAYERS.cameras_intel_points,
      LAYERS.cameras_lpr_points,
      LAYERS.radares_points,
      LAYERS.clusters,
    ];
    for (const lid of hoverLayerIds) {
      map.on("mouseenter", lid, setCursorPointer);
      map.on("mouseleave", lid, setCursorDefault);
    }

    map.on("click", LAYERS.clusters, (e) => {
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
      const f: any = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const coords = (f.geometry as any).coordinates as [number, number];

      setSelectedCode(p.code || null);
      setSelectedRadar(null);
      setPanelOpen(false);

      popup
        ?.setLngLat(coords)
        .setHTML(`
          <div style="font-family: system-ui; min-width: 240px;">
            <div style="font-weight: 800; font-size: 14px; margin-bottom: 6px;">
              📷 ${escapeHtml(p.name || "")}
              <span style="opacity:.65;font-weight:700">(${escapeHtml(p.code || "")})</span>
            </div>
            <div style="font-size: 12px; opacity:.85; margin-bottom: 4px;">
              ${escapeHtml(p.city || "")} - ${escapeHtml(p.uf || "")}
            </div>
            <div style="font-size: 12px; opacity:.8;">
              ${escapeHtml(p.address || "")}
            </div>
          </div>
        `)
        .addTo(map);
    });

    map.on("click", LAYERS.cameras_intel_points, (e) => {
      const f: any = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const coords = (f.geometry as any).coordinates as [number, number];

      setSelectedCode(null);
      setSelectedRadar(null);
      setPanelOpen(false);

      popup
        ?.setLngLat(coords)
        .setHTML(`
          <div style="font-family: system-ui; min-width: 240px;">
            <div style="font-weight: 800; font-size: 14px; margin-bottom: 6px;">
              🟠 Super Câmera Inteligente
              <span style="opacity:.65;font-weight:700">(${escapeHtml(p.code || "")})</span>
            </div>
            <div style="font-size: 12px; opacity:.85; margin-bottom: 4px;">
              ${escapeHtml(p.name || "-")}
            </div>
            <div style="font-size: 12px; opacity:.8;">
              Direção: ${escapeHtml(p.direction || "-")}
            </div>
            <div style="font-size: 12px; opacity:.8;">
              IP: ${escapeHtml(p.ip || "-")}
            </div>
          </div>
        `)
        .addTo(map);
    });

    map.on("click", LAYERS.cameras_lpr_points, (e) => {
      const f: any = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const coords = (f.geometry as any).coordinates as [number, number];

      setSelectedCode(null);
      setSelectedRadar(null);
      setPanelOpen(false);

      popup
        ?.setLngLat(coords)
        .setHTML(`
          <div style="font-family: system-ui; min-width: 240px;">
            <div style="font-weight: 800; font-size: 14px; margin-bottom: 6px;">
              🟢 Câmera LPR
              <span style="opacity:.65;font-weight:700">(${escapeHtml(p.code || "")})</span>
            </div>
            <div style="font-size: 12px; opacity:.85; margin-bottom: 4px;">
              ${escapeHtml(p.name || "-")}
            </div>
            <div style="font-size: 12px; opacity:.8;">
              Direção: ${escapeHtml(p.direction || "-")}
            </div>
            <div style="font-size: 12px; opacity:.8;">
              IP: ${escapeHtml(p.ip || "-")}
            </div>
          </div>
        `)
        .addTo(map);
    });

    map.on("click", LAYERS.radares_points, (e) => {
      const f: any = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const coords = (f.geometry as any).coordinates as [number, number];

      setSelectedRadar(p.codcet || null);
      setSelectedCode(null);
      setPanelOpen(false);

      popup
        ?.setLngLat(coords)
        .setHTML(`
          <div style="font-family: system-ui; min-width: 270px;">
            <div style="font-weight: 800; font-size: 14px; margin-bottom: 6px;">
              📡 Radar <span style="opacity:.75">(${escapeHtml(p.codcet || "")})</span>
            </div>
            <div style="font-size: 12px; opacity:.85; margin-bottom: 4px;">
              ${escapeHtml(p.logradouro || "-")}
            </div>
            <div style="font-size: 12px; opacity:.8;">
              Bairro: ${escapeHtml(p.bairro || "-")} • Sentido: ${escapeHtml(p.sentido || "-")}
            </div>
            <div style="font-size: 12px; opacity:.8; margin-top:6px;">
              Empresa: ${escapeHtml(p.empresa || "-")}
              • Vel: ${p.velofisc ?? "-"}
              • Equip: ${escapeHtml(p.numero_equipamento || "-")}
            </div>
          </div>
        `)
        .addTo(map);
    });

    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [
          LAYERS.cameras_points,
          LAYERS.cameras_intel_points,
          LAYERS.cameras_lpr_points,
          LAYERS.radares_points,
          LAYERS.clusters,
        ],
      });
      if (!features || features.length === 0) popup?.remove();

      if (panelRef.current !== null) {
        setPanel(null);
        setPanelOpen(false);
      }

      setDockOpen(false);
    });

    const closeDockOnMove = () => {
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
    setMeErr(null);

    if (!accessToken) {
      setMe(null);
      return;
    }

    setLoadingMe(true);
    try {
      const data = await fetchJson<Me>(`${API_BASE}/api/v1/auth/me`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setMe(data);
    } catch (e: any) {
      console.error(e);
      setMe(null);
      setMeErr(e?.message || "Erro ao carregar usuário");
    } finally {
      setLoadingMe(false);
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
        `${baseUrl}GeojsonBairros_com_RISP_AISP_CISP.geojson`,
        "/GeojsonBairros_com_RISP_AISP_CISP.geojson",
        "./GeojsonBairros_com_RISP_AISP_CISP.geojson",
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
      applyBairrosVisibility(map, showBairros, selectedBairro);
      applyCodeVisibility(map, showRisp, LAYERS.risp_fill, LAYERS.risp_line, LAYERS.risp_label);
      applyCodeVisibility(map, showAisp, LAYERS.aisp_fill, LAYERS.aisp_line, LAYERS.aisp_label);
      applyCodeVisibility(map, showCisp, LAYERS.cisp_fill, LAYERS.cisp_line, LAYERS.cisp_label);
      updateGpsData(map, gps, gpsOnRef.current);
      updateSearchPin(map, searchPin);
    });

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
      handlersBoundRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCameras() {
    setLoadingCameras(true);
    try {
      const data = await fetchJson<any>(`${API_BASE}/api/v1/cameras`, {
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      const list: Camera[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const normalized = list
        .map((c) => ({
          ...c,
          lat: Number((c as any).lat),
          lng: Number((c as any).lng),
        }))
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
      const data = await fetchJson<any>(`${API_BASE}/api/v1/cameras-inteligentes`, {
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      const list: CameraIntel[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const normalized = list
        .map((c) => ({
          ...c,
          lat: Number((c as any).lat),
          lng: Number((c as any).lng),
        }))
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));

      setCamerasIntel(normalized);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Falha ao carregar câmeras inteligentes");
    } finally {
      setLoadingCamerasIntel(false);
    }
  }

  async function loadCamerasLpr() {
    setLoadingCamerasLpr(true);
    try {
      const data = await fetchJson<any>(`${API_BASE}/api/v1/cameras-lpr`, {
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      const list: CameraLpr[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const normalized = list
        .map((c) => ({
          ...c,
          lat: Number((c as any).lat),
          lng: Number((c as any).lng),
        }))
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));

      setCamerasLpr(normalized);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Falha ao carregar câmeras LPR");
    } finally {
      setLoadingCamerasLpr(false);
    }
  }

  async function loadRadares() {
    setLoadingRadares(true);
    try {
      const data = await fetchJson<any>(`${API_BASE}/api/v1/radares`, {
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      const list: Radar[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];

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

  useEffect(() => {
    loadCameras();
    loadCamerasIntel();
    loadCamerasLpr();
    loadRadares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const feats = bairrosGeo?.features as BairrosFeature[] | undefined;
    if (!feats) return [];
    for (const f of feats) {
      const v = Number((f.properties as any)?.RISP);
      if (Number.isFinite(v)) set.add(v);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [bairrosGeo]);

  const aispValues = useMemo(() => {
    const set = new Set<number>();
    const feats = bairrosGeo?.features as BairrosFeature[] | undefined;
    if (!feats) return [];
    for (const f of feats) {
      const v = Number((f.properties as any)?.AISP);
      if (Number.isFinite(v)) set.add(v);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [bairrosGeo]);

  const cispValues = useMemo(() => {
    const set = new Set<number>();
    const feats = bairrosGeo?.features as BairrosFeature[] | undefined;
    if (!feats) return [];
    for (const f of feats) {
      const v = Number((f.properties as any)?.CISP);
      if (Number.isFinite(v)) set.add(v);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [bairrosGeo]);

  const multiCodeWarnings = useMemo(() => {
    const feats = bairrosGeo?.features as BairrosFeature[] | undefined;
    const risp: string[] = [];
    const aisp: string[] = [];
    const cisp: string[] = [];
    if (!feats) return { risp, aisp, cisp };

    for (const f of feats) {
      const nome = (f.properties?.NOME || "").trim();
      if (!nome) continue;

      const r = parseMultiCodes((f.properties as any)?.RISP);
      const a = parseMultiCodes((f.properties as any)?.AISP);
      const c = parseMultiCodes((f.properties as any)?.CISP);

      if (r && r.length > 1) risp.push(nome);
      if (a && a.length > 1) aisp.push(nome);
      if (c && c.length > 1) cisp.push(nome);
    }

    return { risp, aisp, cisp };
  }, [bairrosGeo]);

  const rispColorExpr = useMemo(() => buildMatchExpr("RISP", rispValues), [rispValues]);
  const aispColorExpr = useMemo(() => buildMatchExpr("AISP", aispValues), [aispValues]);
  const cispColorExpr = useMemo(() => buildMatchExpr("CISP", cispValues), [cispValues]);

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

    const countPoints = (points: Array<{ lng: number; lat: number }>) => {
      let count = 0;
      for (const p of points) {
        if (!Number.isFinite(p.lng) || !Number.isFinite(p.lat)) continue;
        if (!inBbox(p.lng, p.lat)) continue;
        if (pointInGeometry([p.lng, p.lat], geom)) count++;
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) return;

    ensureSourcesAndLayers(map);
    updatePoisData(map, poisGeo);
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

  async function changePassword() {
    setPwMsg(null);

    if (!pwOld || !pwNew || !pwNew2) return setPwMsg("Preencha todos os campos.");
    if (pwNew !== pwNew2) return setPwMsg("As senhas novas não batem.");
    if (pwNew.length < 6) return setPwMsg("Senha muito curta (mínimo 6).");

    setPwLoading(true);
    try {
      await fetchJson(`${API_BASE}/api/v1/auth/change-password`, {
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
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        q
      )}.json?access_token=${MAPBOX_TOKEN}&limit=1&language=pt&country=BR&bbox=${rioBbox.west},${rioBbox.south},${rioBbox.east},${rioBbox.north}`;
      const data = await fetchJson<any>(url);
      const f = data?.features?.[0];
      if (!f || !Array.isArray(f.center)) {
        setSearchErr("Nenhum resultado.");
        return;
      }
      const [lng, lat] = f.center;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setSearchErr("Resultado inválido.");
        return;
      }
      if (!isInRio(lat, lng)) {
        setSearchErr("Somente município do Rio de Janeiro.");
        return;
      }
      setSearchPin({ lng, lat });
      flyToPoint(lng, lat, 16);
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
        const hay = `${c.name} ${c.code} ${c.ip ?? ""} ${c.direction ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (listMode === "lpr") {
      if (!q) return camerasLpr;
      return camerasLpr.filter((c) => {
        const hay = `${c.name} ${c.code} ${c.ip ?? ""} ${c.direction ?? ""}`.toLowerCase();
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
    const mq = window.matchMedia("(max-width: 860px)");
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

  useMemo(() => {
    if (!selectedCode) return null;
    return cameras.find((c) => c.code === selectedCode) || null;
  }, [selectedCode, cameras]);

  useMemo(() => {
    if (!selectedRadar) return null;
    return radares.find((r) => r.codcet === selectedRadar) || null;
  }, [selectedRadar, radares]);

  const panelWidth = panel === "admin" ? 820 : 520;
  const panelMaxHeight = panel === "admin" ? "74vh" : "56vh";

  return (
    <div
      className={panelOpen || mobileMenuOpen ? "menuOpen" : undefined}
      style={{ height: "100vh", width: "100vw", position: "relative", overflow: "hidden" }}
    >
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
              <div>Inteligentes: {selectedBairroStats.inteligentes}</div>
              <div>LPR: {selectedBairroStats.lpr}</div>
              <div>Radares: {selectedBairroStats.radares}</div>
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
                  <img src={cameraIcon} alt="" style={{ width: 16, height: 16 }} />
                </span>
                <span>Câmeras</span>
                <span className="chipDot" style={{ background: showCameras ? "#22c55e" : "#ef4444" }} />
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
                  <img src={cameraIntelIcon} alt="" style={{ width: 16, height: 16 }} />
                </span>
                <span>Super Câmeras Inteligentes</span>
                <span className="chipDot" style={{ background: showCamerasIntel ? "#f59e0b" : "#9ca3af" }} />
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
                  <img src={cameraLprIcon} alt="" style={{ width: 16, height: 16 }} />
                </span>
                <span>LPR</span>
                <span className="chipDot" style={{ background: showCamerasLpr ? "#22d3ee" : "#9ca3af" }} />
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
                  <img src={radarIcon} alt="" style={{ width: 16, height: 16 }} />
                </span>
                <span>Radares</span>
                <span className="chipDot" style={{ background: showRadares ? "#3b82f6" : "#9ca3af" }} />
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
                <span className="chipIcon" style={{ fontSize: 12 }}>BA</span>
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
                <span className="chipIcon" style={{ fontSize: 11 }}>R</span>
                <span>RISP</span>
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
                <span className="chipIcon" style={{ fontSize: 11 }}>A</span>
                <span>AISP</span>
                <span className="chipDot" style={{ background: showAisp ? "#3b82f6" : "#9ca3af" }} />
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
                <span className="chipIcon" style={{ fontSize: 11 }}>C</span>
                <span>CISP</span>
                <span className="chipDot" style={{ background: showCisp ? "#f59e0b" : "#9ca3af" }} />
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
                  <img src={mapPinRed} alt="" style={{ width: 14, height: 14 }} />
                </span>
                <span>GPS</span>
                <span className="chipDot" style={{ background: gpsOn ? "#22c55e" : "#9ca3af" }} />
              </span>
              <span className="chipState">{gpsOn ? "ON" : "OFF"}</span>
            </button>

            {gpsOn && gps && !gpsErr && (
              <button
                className="dockFab"
                onClick={() => {
                  flyToPoint(gps.lng, gps.lat, 16);
                  bumpDockAutoHide();
                }}
                title="Centralizar no GPS"
              >
                ⦿
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
            Central
          </button>

          <button
            className={`tabBtn ${panel === "profile" ? "tabBtnActive" : ""}`}
            onClick={() => togglePanel("profile")}
            title="Clique de novo pra fechar"
          >
            Perfil
          </button>

          {isAdmin && (
            <button
              className={`tabBtn ${panel === "admin" ? "tabBtnActive" : ""}`}
              onClick={() => togglePanel("admin")}
              title="Clique de novo pra fechar"
            >
              Administrador
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
              Buscar
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
          <button className="btnGhost" onClick={() => auth?.logout?.()}>
            Sair
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
              <div className="panelHeader" style={{ marginBottom: 10, alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div className="panelTitle">
                    {listMode === "cameras"
                      ? "Câmeras"
                      : listMode === "inteligentes"
                      ? "Super Câmeras Inteligentes"
                      : listMode === "lpr"
                      ? "Câmeras LPR"
                      : "Radares"}
                  </div>
                  <div className="panelCount">
                    {listMode === "cameras"
                      ? loadingCameras
                        ? "Carregando..."
                        : `${cameras.length} câmeras`
                      : listMode === "inteligentes"
                      ? loadingCamerasIntel
                        ? "Carregando..."
                        : `${camerasIntel.length} super câmeras inteligentes`
                      : listMode === "lpr"
                      ? loadingCamerasLpr
                        ? "Carregando..."
                        : `${camerasLpr.length} LPR`
                      : loadingRadares
                      ? "Carregando..."
                      : `${radares.length} radares`}
                  </div>
                </div>

                <div style={{ flex: 1 }} />

                <div className="panelTabs">
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

              <div style={{ display: "grid", gap: 10, maxHeight: panelMaxHeight, overflow: "auto" }}>
                {listMode === "cameras" &&
                  (listItems as Camera[]).map((c) => (
                    <div
                      key={c.code}
                      className="listItem"
                      onClick={() => {
                        setSelectedCode(c.code);
                        setSelectedRadar(null);
                        flyToPoint(c.lng, c.lat);
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 900,
                              fontSize: 13,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {c.name} <span style={{ opacity: 0.55 }}>({c.code})</span>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.75,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {c.city} - {c.uf} • {c.address}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                {listMode === "inteligentes" &&
                  (listItems as CameraIntel[]).map((c) => (
                    <div
                      key={c.code}
                      className="listItem"
                      onClick={() => {
                        setSelectedCode(null);
                        setSelectedRadar(null);
                        flyToPoint(c.lng, c.lat);
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 900,
                              fontSize: 13,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {c.name} <span style={{ opacity: 0.55 }}>({c.code})</span>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.75,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            IP: {c.ip || "-"} • Direção: {c.direction || "-"}
                          </div>
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
                        flyToPoint(c.lng, c.lat);
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 900,
                              fontSize: 13,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {c.name} <span style={{ opacity: 0.55 }}>({c.code})</span>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.75,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            IP: {c.ip || "-"} • Direção: {c.direction || "-"}
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
                          flyToPoint(lng, lat);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: 13,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              Radar <span style={{ opacity: 0.6 }}>({r.codcet})</span>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                opacity: 0.75,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {r.bairro || "-"} • {r.logradouro || r.localidade || "-"} • {r.sentido || "-"}
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
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
                <input
                  value={pwOld}
                  onChange={(e) => setPwOld(e.target.value)}
                  type="password"
                  placeholder="Senha atual"
                  style={inputStyle()}
                />
                <input
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  type="password"
                  placeholder="Nova senha"
                  style={inputStyle()}
                />
                <input
                  value={pwNew2}
                  onChange={(e) => setPwNew2(e.target.value)}
                  type="password"
                  placeholder="Confirmar nova senha"
                  style={inputStyle()}
                />

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

          {panel === "admin" && isAdmin && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>Administrador</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  gerenciamento completo (inline)
                </div>

                <div style={{ flex: 1 }} />

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

              <div style={{ maxHeight: panelMaxHeight, overflow: "auto" }}>
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
          top: 12,
          left: 12,
          right: 12,
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
              onClick={() => setMobileMenuOpen((v) => !v)}
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
                  Buscar local
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
                  }}
                  style={{ width: "100%", borderRadius: 10 }}
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>

        {panelOpen && (
          <div
            ref={mobileDrawerRef}
            className="mobileDrawer glassStrong"
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
                Mapa
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
                Perfil
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
                  Administrador
                </button>
              )}

              <div style={{ flex: 1 }} />
            </div>

            {panel === "map" && (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
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
                    (listItems as Camera[]).map((c) => (
                      <div
                        key={c.code}
                        className="listItem"
                        onClick={() => {
                          setSelectedCode(c.code);
                          setSelectedRadar(null);
                          flyToPoint(c.lng, c.lat);
                          setPanelOpen(false);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: 13,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {c.name} <span style={{ opacity: 0.55 }}>({c.code})</span>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                opacity: 0.75,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {c.city} - {c.uf}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {listMode === "inteligentes" &&
                    (listItems as CameraIntel[]).map((c) => (
                      <div
                        key={c.code}
                        className="listItem"
                        onClick={() => {
                          setSelectedCode(null);
                          setSelectedRadar(null);
                          flyToPoint(c.lng, c.lat);
                          setPanelOpen(false);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: 13,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {c.name} <span style={{ opacity: 0.55 }}>({c.code})</span>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                opacity: 0.75,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              IP: {c.ip || "-"} • Direção: {c.direction || "-"}
                            </div>
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
                          flyToPoint(c.lng, c.lat);
                          setPanelOpen(false);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: 13,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {c.name} <span style={{ opacity: 0.55 }}>({c.code})</span>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                opacity: 0.75,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              IP: {c.ip || "-"} • Direção: {c.direction || "-"}
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
                            flyToPoint(lng, lat);
                            setPanelOpen(false);
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 900,
                                  fontSize: 13,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                Radar <span style={{ opacity: 0.55 }}>({r.codcet})</span>
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  opacity: 0.75,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {r.bairro || "-"} • {r.sentido || "-"}
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
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
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 2 }}>Trocar senha</div>
                  <input
                    value={pwOld}
                    onChange={(e) => setPwOld(e.target.value)}
                    type="password"
                    placeholder="Senha atual"
                    style={inputStyle()}
                  />
                  <input
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    type="password"
                    placeholder="Nova senha"
                    style={inputStyle()}
                  />
                  <input
                    value={pwNew2}
                    onChange={(e) => setPwNew2(e.target.value)}
                    type="password"
                    placeholder="Confirmar nova senha"
                    style={inputStyle()}
                  />
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

            {panel === "admin" && isAdmin && (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
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
            Buscar
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
