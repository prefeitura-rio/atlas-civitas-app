// src/pages/MapPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { FeatureCollection, Feature, Point } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import { useAuth } from "../app/auth";

import prefeituraLogo from "@/assets/prefeitura_icon.png";
import cameraIcon from "@/assets/camera-icon.png";
import radarIcon from "@/assets/radar-icon.png";
import cameraIntelIcon from "@/assets/cameras-inteligentes-icon.png";
import cameraLprIcon from "@/assets/camera-lpr-icon.png";
import mapPinRed from "@/assets/map-pin-red.svg";
import civitasLogo from "@/assets/civitas_icon.png";

type Camera = {
  id?: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  uf: string;
  stream_url?: string;
  is_active: boolean;
};

type CameraIntel = {
  id?: string;
  ip?: string | null;
  code: string;
  name: string;
  lat: number;
  lng: number;
  direction?: string | null;
  is_active?: boolean;
  source_file?: string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CameraLpr = {
  id?: string;
  ip?: string | null;
  code: string;
  name: string;
  lat: number;
  lng: number;
  direction?: string | null;
  is_active?: boolean;
  source_file?: string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Radar = {
  id?: string;
  codcet: string;

  lat?: number | null;
  lng?: number | null;

  empresa?: string | null;
  bairro?: string | null;
  logradouro?: string | null;
  localidade?: string | null;
  sentido?: string | null;

  velofisc?: number | null;
  numero_equipamento?: string | null;

  status?: string | null;
  is_active?: boolean;

  updated_at?: string | null;
  data_atualizacao?: string | null;
};

type TabKey = "map" | "profile" | "admin";
type PanelKey = TabKey | null;

type AdminTab = "users" | "logs" | "cameras" | "radares";

type Me = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  expires_at?: string | null;
  last_login_at?: string | null;
};

type AdminUser = {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  cpf?: string | null;
  birth_date?: string | null;
  matricula?: string | null;
  unidade?: string | null;
  orgao?: string | null;
  is_active: boolean;
  created_at?: string;
  expires_at?: string | null;
  last_login_at?: string | null;
};

type AdminLog = {
  id: string;
  created_at: string;
  user_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;

  action: string;
  entity_type?: string | null;
  entity_id?: string | null;

  meta?: any;
  ip?: string | null;
  user_agent?: string | null;

  message: string;
  target?: {
    email?: string;
    name?: string;
    code?: string;
    codcet?: string;
  } | null;
};

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL?.toString() || "http://localhost:8000";

const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN?.toString() || "";

// só dark streets
const MAP_STYLE_DARK = "mapbox://styles/mapbox/dark-v11" as const;
const PAGE_SIZE = 50;
const ADMIN_PAGE_SIZE = 50;

// IDs fixos
const SOURCES = {
  pois: "src-pois",
  gps: "src-gps",
  search: "src-search",
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
} as const;

const IMAGES = {
  camera: "camera_icon",
  radar: "radar_icon",
  camera_intel: "camera_intel_icon",
  camera_lpr: "camera_lpr_icon",
  search_pin: "search_pin_icon",
} as const;

// ✅ CSS INLINE (pra você NÃO quebrar com crase de novo)
const INLINE_CSS = `
  .glass {
    background: rgba(255,255,255,0.70);
    border: 1px solid rgba(0,0,0,0.10);
    box-shadow: 0 18px 50px rgba(0,0,0,0.15);
    backdrop-filter: blur(14px) saturate(180%);
    -webkit-backdrop-filter: blur(14px) saturate(180%);
    border-radius: 18px;
  }
  .glassStrong {
    background: rgba(255,255,255,0.82);
    border: 1px solid rgba(0,0,0,0.10);
    box-shadow: 0 18px 60px rgba(0,0,0,0.18);
    backdrop-filter: blur(18px) saturate(180%);
    -webkit-backdrop-filter: blur(18px) saturate(180%);
    border-radius: 18px;
  }
  .btnGhost {
    appearance: none;
    border: 1px solid rgba(0,0,0,0.12);
    background: rgba(255,255,255,0.65);
    color: rgba(0,0,0,0.85);
    padding: 8px 10px;
    border-radius: 12px;
    cursor: pointer;
    transition: transform .12s ease, background .12s ease;
    font-weight: 900;
    font-size: 13px;
  }
  .btnGhost:hover { background: rgba(255,255,255,0.85); transform: translateY(-1px); }
  .btnGhost:active { transform: translateY(0px); }

  .selectWrap {
    position: relative;
    width: 100%;
  }

  .customSelect {
    position: relative;
    width: 100%;
  }
  .customSelectBtn {
    appearance: none;
    width: 100%;
    padding: 10px 36px 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(0,0,0,0.10);
    outline: none;
    background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,245,245,0.92));
    color: rgba(0,0,0,0.88);
    font-weight: 800;
    font-family: inherit;
    box-shadow: 0 6px 18px rgba(0,0,0,0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    cursor: pointer;
  }
  .customSelectBtn:focus {
    border-color: rgba(0,0,0,0.20);
    box-shadow: 0 8px 22px rgba(0,0,0,0.12);
  }
  .customSelectChevron {
    position: absolute;
    right: 12px;
    top: 50%;
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid rgba(0,0,0,0.55);
    transform: translateY(-30%);
    pointer-events: none;
  }
  .customSelectMenu {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 6px);
    background: rgba(255,255,255,0.98);
    border: 1px solid rgba(0,0,0,0.10);
    border-radius: 14px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.18);
    padding: 6px;
    z-index: 20;
    display: grid;
    gap: 4px;
  }
  .customSelectItem {
    appearance: none;
    border: 0;
    background: transparent;
    text-align: left;
    padding: 8px 10px;
    border-radius: 10px;
    font-weight: 800;
    font-family: inherit;
    color: rgba(0,0,0,0.82);
    cursor: pointer;
  }
  .customSelectItem:hover {
    background: rgba(0,0,0,0.06);
  }
  .customSelectItemActive {
    background: rgba(0,0,0,0.08);
    color: rgba(0,0,0,0.95);
  }

  .tabBtn {
    appearance: none;
    border: 0;
    background: transparent;
    color: rgba(0,0,0,0.80);
    padding: 10px 12px;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 900;
    font-size: 13px;
  }
  .tabBtnActive {
    background: rgba(0,0,0,0.06);
    border: 1px solid rgba(0,0,0,0.10);
    color: rgba(0,0,0,0.92);
  }
  .subTab {
    appearance: none;
    border: 1px solid rgba(0,0,0,0.10);
    background: rgba(255,255,255,0.70);
    color: rgba(0,0,0,0.85);
    padding: 8px 10px;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 900;
    font-size: 12px;
  }
  .subTabActive {
    background: rgba(0,0,0,0.86);
    color: white;
    border: 1px solid rgba(0,0,0,0.12);
  }
  .listItem {
    border: 1px solid rgba(0,0,0,0.08);
    background: rgba(255,255,255,0.88);
    border-radius: 14px;
    padding: 10px 12px;
    cursor: pointer;
    transition: transform .12s ease, background .12s ease;
    color: rgba(0,0,0,0.88);
  }
  .listItem:hover { background: rgba(255,255,255,0.98); transform: translateY(-1px); }

  .panelCard{
    background: rgba(255,255,255,0.92);
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 22px 60px rgba(0,0,0,0.22);
    border-radius: 18px;
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
  }
  .panelHeader{
    display:flex;
    align-items:center;
    gap:10px;
    padding-bottom:8px;
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .panelTitle{
    font-weight: 900;
    font-size: 14px;
  }
  .panelCount{
    font-size: 12px;
    color: rgba(0,0,0,0.55);
    font-weight: 700;
  }
  .panelTabs{
    display:flex;
    gap:6px;
    flex-wrap:wrap;
  }
  .panelSearch{
    display:flex;
    gap:10px;
    margin: 10px 0 12px;
  }

  .muted { opacity: .75; }
  .title { font-weight: 900; letter-spacing: -0.02em; color: rgba(0,0,0,0.92); }
  .kbd {
    padding: 2px 7px;
    border-radius: 8px;
    border: 1px solid rgba(0,0,0,0.12);
    background: rgba(255,255,255,0.70);
    font-size: 12px;
    font-weight: 900;
    opacity: .95;
    color: rgba(0,0,0,0.85);
  }
  .desktopPanels { display: block; }
  .mobileBar { display: none; }

  @media (max-width: 860px) {
    .desktopPanels { display: none !important; }
    .mobileBar { display: flex !important; }
    .mobileDrawer {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: 12px;
      max-height: 72vh;
      overflow: auto;
      transform: translateY(0);
      transition: transform .18s ease;
      z-index: 20;
    }
    .tabBtn {
      padding: 8px 10px;
      font-size: 12px;
    }
    .subTab {
      padding: 7px 9px;
      font-size: 11px;
    }
    .adminGrid2 { grid-template-columns: 1fr !important; }
    .adminRow { flex-wrap: wrap; }
    .adminRowBtn { width: 100%; }
    .adminCard { max-width: 100%; overflow: hidden; }
    .adminLabelWrap { flex-wrap: wrap; line-height: 1.2; }
    .dockWrap {
      position: fixed;
      top: auto;
      right: 12px;
      bottom: 72px;
    }
    .dockHandle {
      height: 32px;
      padding: 0 10px;
      font-size: 11px;
      border-radius: 999px;
    }
    .dock {
      padding: 10px;
      gap: 6px;
      min-width: 150px;
      border-radius: 16px;
    }
    .dockTitle { font-size: 11px; }
    .dockChip { padding: 7px 9px; font-size: 12px; }
    .dockFab { width: 40px; height: 40px; font-size: 16px; }
    .menuOpen .dockWrap { display: none; }
  }

  .mapboxgl-map { position: absolute; inset: 0; }

  .dockWrap{
    position:absolute;
    top:96px;
    right:16px;
    z-index:26;
    display:flex;
    align-items:flex-start;
    gap:10px;
  }
  .dockHandle{
    height:36px;
    padding:0 12px;
    border-radius:999px;
    background: rgba(255,255,255,0.92);
    border: 1px solid rgba(0,0,0,0.10);
    box-shadow: 0 12px 30px rgba(0,0,0,0.20);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    user-select:none;
    font-weight:900;
    font-size:12px;
    color: rgba(0,0,0,0.78);
  }
  .dock{
    padding:12px;
    border-radius:18px;
    background: rgba(255,255,255,0.96);
    border: 1px solid rgba(0,0,0,0.10);
    box-shadow: 0 18px 50px rgba(0,0,0,0.22);
    backdrop-filter: blur(16px) saturate(200%);
    -webkit-backdrop-filter: blur(16px) saturate(200%);
    display:flex;
    flex-direction:column;
    gap:8px;
    min-width: 180px;
  }
  .dockTitle{
    font-size:12px;
    font-weight:900;
    color: rgba(0,0,0,0.72);
    letter-spacing: .02em;
    text-transform: uppercase;
    margin-bottom:4px;
  }
  .dockChip{
    width:100%;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    padding:8px 10px;
    border-radius:999px;
    border: 1px solid rgba(0,0,0,0.08);
    background: rgba(0,0,0,0.04);
    cursor:pointer;
    font-weight:900;
    color: rgba(0,0,0,0.82);
    transition: transform .12s ease, background .12s ease, border-color .12s ease;
  }
  .dockChip:hover{ transform: translateY(-1px); background: rgba(0,0,0,0.06); }
  .dockChipOn{
    background: rgba(0,0,0,0.10);
    border-color: rgba(0,0,0,0.14);
  }
  .dockChipDisabled{
    opacity: 0.55;
    cursor: not-allowed;
  }
  .chipLeft{
    display:flex;
    align-items:center;
    gap:8px;
  }
  .chipIcon{
    width:22px;
    height:22px;
    border-radius:50%;
    background: rgba(0,0,0,0.10);
    display:grid;
    place-items:center;
    font-size:13px;
  }
  .chipDot{
    width:8px;
    height:8px;
    border-radius:999px;
    box-shadow: 0 6px 14px rgba(0,0,0,.18);
  }
  .chipState{
    font-size:11px;
    font-weight:900;
    color: rgba(0,0,0,0.65);
  }
  .dockDivider{
    height:1px;
    background: rgba(0,0,0,0.08);
    margin:4px 0;
  }
  .dockFab{
    width:44px;
    height:44px;
    border-radius:999px;
    border: 1px solid rgba(0,0,0,0.14);
    background: linear-gradient(180deg, rgba(20,20,20,0.98), rgba(0,0,0,0.92));
    color: #fff;
    display:grid;
    place-items:center;
    cursor:pointer;
    box-shadow: 0 14px 34px rgba(0,0,0,0.28);
    align-self:flex-end;
    transition: transform .12s ease, filter .12s ease;
    font-weight: 900;
    font-size: 18px;
  }
  .dockFab:hover{ transform: translateY(-1px); filter: brightness(1.05); }
  .dockFab:active{ transform: translateY(0px) scale(0.98); }
  .dockNote{
    font-size:11px;
    color: rgba(0,0,0,0.65);
    margin-top:4px;
  }
`;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function fetchJson<T>(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, opts);
  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.setItem(
        "auth_toast",
        "Sua sessão expirou. Faça login novamente para continuar."
      );
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
      try {
        window.location.href = "/login";
      } catch {}
    }
    const msg =
      typeof data === "string"
        ? data
        : data?.detail || data?.message || res.statusText || "Erro";
    throw new Error(`${res.status} - ${msg}`);
  }
  return data as T;
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    outline: "none",
    background: "rgba(255,255,255,0.95)",
    color: "rgba(0,0,0,0.88)",
  };
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
  const dockTimerRef = useRef<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchPin, setSearchPin] = useState<{ lng: number; lat: number } | null>(null);
  const searchTimerRef = useRef<number | null>(null);

  function bumpDockAutoHide() {
    if (dockTimerRef.current) window.clearTimeout(dockTimerRef.current);
    dockTimerRef.current = window.setTimeout(() => {
      setDockOpen(false);
    }, 2600);
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
    });

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
    if (!map.isStyleLoaded()) return;

    ensureSourcesAndLayers(map);
    updateGpsData(map, gps, gpsOn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps, gpsOn]);

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

    const rjBbox = { west: -44.9, south: -24.5, east: -40.7, north: -20.7 };
    function isInRJ(lat: number, lng: number) {
      return lng >= rjBbox.west && lng <= rjBbox.east && lat >= rjBbox.south && lat <= rjBbox.north;
    }

    const coordMatch = q.match(
      /(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/i
    );
    if (coordMatch) {
      const lat = Number(coordMatch[1]);
      const lng = Number(coordMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        if (!isInRJ(lat, lng)) {
          setSearchErr("Somente endereços/coords no RJ.");
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
      )}.json?access_token=${MAPBOX_TOKEN}&limit=1&language=pt&country=BR&bbox=${rjBbox.west},${rjBbox.south},${rjBbox.east},${rjBbox.north}`;
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
      if (!isInRJ(lat, lng)) {
        setSearchErr("Somente endereços no RJ.");
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
      {/* ✅ CSS CORRETO */}
      <style>{INLINE_CSS}</style>

      <div
        ref={mapContainerRef}
        onClick={() => {
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
        style={isMobile && mobileMenuOpen ? { display: "none" } : undefined}
        onMouseEnter={() => {
          setDockOpen(true);
          bumpDockAutoHide();
        }}
        onMouseMove={() => bumpDockAutoHide()}
      >
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
          <div className="dock">
            <div className="dockTitle">Camadas</div>

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
              className={`dockChip ${gpsOn ? "dockChipOn" : ""} ${gpsErr ? "dockChipDisabled" : ""}`}
              onClick={() => {
                if (gpsErr) return;
                toggleGps();
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
            padding: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 150,
          }}
        >
          <img src={civitasLogo} alt="Civitas" style={{ height: 32, width: 120 }} />
        </div>

        <div
          className="glass"
          style={{
            flex: 1,
            padding: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
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
              Admin
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
              placeholder="Buscar rua ou coordenadas"
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
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <img src={prefeituraLogo} alt="Prefeitura" style={{ height: 26, width: 56 }} />
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
                <div style={{ fontWeight: 900, fontSize: 14 }}>Admin</div>
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
            padding: 10,
            color: "#0b0b0f",
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={civitasLogo} alt="Civitas" style={{ height: 34, width: 120 }} />
          </div>

          <div style={{ position: "relative" }}>
            <button
              className="btnGhost"
              onClick={() => setMobileMenuOpen((v) => !v)}
              style={{
                width: 40,
                height: 32,
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
          <div className="mobileDrawer glassStrong" style={{ padding: 12, color: "#0b0b0f" }}>
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
                  Admin
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
                <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>Trocar senha</div>
                <div style={{ display: "grid", gap: 10 }}>
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
                    {pwLoading ? "Salvando..." : "Salvar"}
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
            placeholder="Buscar rua ou coordenadas"
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

/* ===========================
   ADMIN: USERS CRUD (inline)
=========================== */
function AdminUsersPanel({
  apiBase,
  token,
  isMobile,
}: {
  apiBase: string;
  token: string;
  isMobile: boolean;
}) {
  const USERS_URL = `${apiBase}/api/v1/users`;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<AdminUser[]>([]);

  const [id, setId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [matricula, setMatricula] = useState("");
  const [unidade, setUnidade] = useState("");
  const [orgao, setOrgao] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [isActive, setIsActive] = useState(true);
  const [roleOpen, setRoleOpen] = useState(false);
  const roleWrapRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(1);
  const [mobileCount, setMobileCount] = useState(ADMIN_PAGE_SIZE);

  function resetForm() {
    setId(null);
    setEmail("");
    setFullName("");
    setCpf("");
    setBirthDate("");
    setMatricula("");
    setUnidade("");
    setOrgao("");
    setPassword("");
    setRole("user");
    setIsActive(true);
  }

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchJson<any>(USERS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list: AdminUser[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setItems(list);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    setMobileCount(ADMIN_PAGE_SIZE);
  }, [items.length]);

  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      const el = roleWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setRoleOpen(false);
    }

    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  function pick(u: AdminUser) {
    setId(u.id);
    setEmail(u.email || "");
    setFullName(u.full_name || "");
    setCpf(u.cpf || "");
    setBirthDate(u.birth_date || "");
    setMatricula(u.matricula || "");
    setUnidade(u.unidade || "");
    setOrgao(u.orgao || "");
    setPassword("");
    setRole((u.role || "user").toLowerCase());
    setIsActive(!!u.is_active);
  }

  function normalizeCpf(v: string) {
    return v.replace(/\D/g, "").slice(0, 11);
  }

  async function save() {
    setErr(null);

    const emailV = email.trim();
    const fullNameV = fullName.trim();
    const roleV = role.trim().toLowerCase();
    const cpfV = normalizeCpf(cpf.trim());
    const birthDateV = birthDate.trim();
    const matriculaV = matricula.trim();
    const unidadeV = unidade.trim();
    const orgaoV = orgao.trim();

    if (!emailV) return setErr("Email é obrigatório.");
    if (!fullNameV || fullNameV.length < 3) return setErr("Nome completo inválido.");
    if (!roleV) return setErr("Role é obrigatório (admin/user).");
    if (!/^(admin|user)$/.test(roleV)) return setErr("Role deve ser admin ou user.");
    if (!matriculaV) return setErr("Matrícula é obrigatória.");
    if (!orgaoV) return setErr("Órgão é obrigatório.");

    if (!id) {
      if (cpfV.length !== 11) return setErr("CPF deve ter 11 dígitos.");
      if (!birthDateV) return setErr("Data de nascimento é obrigatória.");
      if (!password || password.length < 8) return setErr("Senha mínima: 8 caracteres.");
    }

    try {
      if (!id) {
        await fetchJson(USERS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: emailV,
            full_name: fullNameV,
            cpf: cpfV,
            birth_date: birthDateV,
            matricula: matriculaV,
            unidade: unidadeV || null,
            orgao: orgaoV,
            password,
            role: roleV,
          }),
        });
      } else {
        const payload: any = { is_active: isActive };
        if (emailV) payload.email = emailV;
        if (fullNameV) payload.full_name = fullNameV;
        if (roleV) payload.role = roleV;
        if (cpfV) payload.cpf = cpfV;
        if (birthDateV) payload.birth_date = birthDateV;
        if (matriculaV) payload.matricula = matriculaV;
        payload.unidade = unidadeV || null;
        if (orgaoV) payload.orgao = orgaoV;

        await fetchJson(`${USERS_URL}/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      resetForm();
      load();
    } catch (e: any) {
      setErr(e?.message || "Erro ao salvar usuário");
    }
  }

  async function deactivate(userId: string) {
    const ok = confirm("Desativar usuário? Ele não entra mais no sistema.");
    if (!ok) return;
    setErr(null);
    try {
      await fetchJson(`${USERS_URL}/${userId}/deactivate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (id === userId) resetForm();
      load();
    } catch (e: any) {
      setErr(e?.message || "Erro ao desativar usuário");
    }
  }

  async function reactivate(userId: string) {
    const ok = confirm("Reativar usuário?");
    if (!ok) return;
    setErr(null);
    try {
      await fetchJson(`${USERS_URL}/${userId}/reactivate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (e: any) {
      setErr(e?.message || "Erro ao reativar usuário");
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        className="adminCard"
        style={{
          padding: 12,
          borderRadius: 16,
          background: "rgba(255,255,255,0.90)",
          border: "1px solid rgba(0,0,0,0.10)",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>
          {id ? "Editar usuário" : "Criar usuário"}
        </div>

        <div className="adminGrid2" style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" style={inputStyle()} />
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="nome completo"
            style={inputStyle()}
          />

          <input
            value={cpf}
            onChange={(e) => setCpf(normalizeCpf(e.target.value))}
            placeholder="cpf (11 dígitos)"
            style={inputStyle()}
          />
          <input
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            type="date"
            placeholder="data de nascimento"
            style={inputStyle()}
          />

          <input
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            placeholder="matrícula"
            style={inputStyle()}
          />
          <input
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            placeholder="unidade (opcional)"
            style={inputStyle()}
          />

          <input
            value={orgao}
            onChange={(e) => setOrgao(e.target.value)}
            placeholder="órgão"
            style={inputStyle()}
          />

          <div className="customSelect" ref={roleWrapRef}>
            <button type="button" className="customSelectBtn" onClick={() => setRoleOpen((v) => !v)}>
              <span>{role === "admin" ? "Administrador" : "Usuário"}</span>
              <span className="customSelectChevron" />
            </button>
            {roleOpen && (
              <div className="customSelectMenu">
                <button
                  type="button"
                  className={`customSelectItem ${role === "user" ? "customSelectItemActive" : ""}`}
                  onClick={() => {
                    setRole("user");
                    setRoleOpen(false);
                  }}
                >
                  Usuário
                </button>
                <button
                  type="button"
                  className={`customSelectItem ${role === "admin" ? "customSelectItemActive" : ""}`}
                  onClick={() => {
                    setRole("admin");
                    setRoleOpen(false);
                  }}
                >
                  Administrador
                </button>
              </div>
            )}
          </div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={id ? "senha (só na criação)" : "senha (mín 8)"}
            type="password"
            disabled={!!id}
            style={{
              ...inputStyle(),
              opacity: id ? 0.6 : 1,
              cursor: id ? "not-allowed" : "text",
            }}
          />

          <label
            className="adminLabelWrap"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "rgba(255,255,255,0.95)",
              fontWeight: 900,
              color: "rgba(0,0,0,0.82)",
              gridColumn: "1 / span 2",
            }}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ transform: "scale(1.1)" }}
            />
            Ativo
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button
            onClick={save}
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
            {id ? "Salvar alterações" : "Criar usuário"}
          </button>

          <button
            onClick={resetForm}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.90)",
              cursor: "pointer",
              fontWeight: 900,
              color: "rgba(0,0,0,0.85)",
            }}
          >
            Limpar
          </button>

          <button
            onClick={load}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.90)",
              cursor: "pointer",
              fontWeight: 900,
              color: "rgba(0,0,0,0.85)",
            }}
          >
            Recarregar
          </button>
        </div>

        {err && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#991b1b" }}>{err}</div>}
      </div>

      <div
        className="adminCard"
        style={{
          padding: 12,
          borderRadius: 16,
          background: "rgba(255,255,255,0.90)",
          border: "1px solid rgba(0,0,0,0.10)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Usuários</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{loading ? "Carregando..." : `${items.length} itens`}</div>
        </div>

        <div
          style={{ display: "grid", gap: 8, maxHeight: "50vh", overflow: "auto" }}
          onScroll={(e) => {
            if (!isMobile) return;
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
              setMobileCount((v) => v + ADMIN_PAGE_SIZE);
            }
          }}
        >
          {(isMobile ? items.slice(0, mobileCount) : items.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE)).map(
            (u) => (
            <div
              key={u.id}
              className="adminRow"
              style={{
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 14,
                padding: 10,
                background: "rgba(255,255,255,0.75)",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
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
                  {u.email}{" "}
                  <span style={{ opacity: 0.6, fontWeight: 800 }}>• {String(u.role).toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {u.full_name || "-"} • {u.is_active ? "ATIVO" : "INATIVO"}
                  {u.cpf ? ` • CPF: ${u.cpf}` : ""}
                  {u.matricula ? ` • Matrícula: ${u.matricula}` : ""}
                  {u.unidade ? ` • Unidade: ${u.unidade}` : ""}
                  {u.orgao ? ` • Órgão: ${u.orgao}` : ""}
                </div>
              </div>

              <button
                onClick={() => pick(u)}
                className="adminRowBtn"
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(255,255,255,0.90)",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Editar
              </button>

              {u.is_active ? (
                <button
                  onClick={() => deactivate(u.id)}
                  className="adminRowBtn"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(0,0,0,0.86)",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Desativar
                </button>
              ) : (
                <button
                  onClick={() => reactivate(u.id)}
                  className="adminRowBtn"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(34,197,94,.14)",
                    color: "#15803d",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Reativar
                </button>
              )}
            </div>
          ))}

          {!items.length && !loading && <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhum usuário encontrado.</div>}
        </div>

        {!isMobile && items.length > ADMIN_PAGE_SIZE && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <button
              className="btnGhost"
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              disabled={page <= 1}
              style={{ opacity: page <= 1 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Página {page} de {Math.max(1, Math.ceil(items.length / ADMIN_PAGE_SIZE))}
            </div>
            <button
              className="btnGhost"
              onClick={() => setPage((v) => Math.min(Math.ceil(items.length / ADMIN_PAGE_SIZE), v + 1))}
              disabled={page >= Math.ceil(items.length / ADMIN_PAGE_SIZE)}
              style={{ opacity: page >= Math.ceil(items.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===========================
   ADMIN: CAMERAS CRUD + SYNC
=========================== */
function AdminCamerasPanel({
  apiBase,
  token,
  onSynced,
  isMobile,
}: {
  apiBase: string;
  token: string;
  onSynced?: () => void;
  isMobile: boolean;
}) {
  const CAMS_URL = `${apiBase}/api/v1/cameras`;
  const SYNC_CAMERAS_URL = `${apiBase}/api/v1/sync/cameras`;
  const SYNC_CIVITAS_URL = `${apiBase}/api/v1/sync/civitas`;
  const CAMS_INTEL_URL = `${apiBase}/api/v1/cameras-inteligentes`;
  const CAMS_LPR_URL = `${apiBase}/api/v1/cameras-lpr`;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Camera[]>([]);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelItems, setIntelItems] = useState<CameraIntel[]>([]);
  const [lprLoading, setLprLoading] = useState(false);
  const [lprItems, setLprItems] = useState<CameraLpr[]>([]);

  const [deactivateMissing, setDeactivateMissing] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [camTab, setCamTab] = useState<"cameras" | "civitas">("cameras");
  const [civitasTab, setCivitasTab] = useState<"inteligentes" | "lpr">("inteligentes");
  const [pageCams, setPageCams] = useState(1);
  const [pageIntel, setPageIntel] = useState(1);
  const [pageLpr, setPageLpr] = useState(1);
  const [mobileCountCams, setMobileCountCams] = useState(ADMIN_PAGE_SIZE);
  const [mobileCountIntel, setMobileCountIntel] = useState(ADMIN_PAGE_SIZE);
  const [mobileCountLpr, setMobileCountLpr] = useState(ADMIN_PAGE_SIZE);

  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  function resetForm() {
    setId(null);
    setName("");
    setCode("");
    setCity("");
    setUf("");
    setAddress("");
    setLat("");
    setLng("");
    setStreamUrl("");
    setIsActive(true);
  }

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchJson<any>(CAMS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list: Camera[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setItems(list);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar câmeras");
    } finally {
      setLoading(false);
    }
  }

  async function loadIntel() {
    setIntelLoading(true);
    try {
      const data = await fetchJson<any>(CAMS_INTEL_URL, {
        headers: { Authorization: `Bearer ${token}` },
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
      setIntelItems(normalized);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar câmeras inteligentes");
    } finally {
      setIntelLoading(false);
    }
  }

  async function loadLpr() {
    setLprLoading(true);
    try {
      const data = await fetchJson<any>(CAMS_LPR_URL, {
        headers: { Authorization: `Bearer ${token}` },
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
      setLprItems(normalized);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar câmeras LPR");
    } finally {
      setLprLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (camTab !== "civitas") return;
    if (civitasTab === "inteligentes") loadIntel();
    if (civitasTab === "lpr") loadLpr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camTab, civitasTab]);

  useEffect(() => {
    setPageCams(1);
    setPageIntel(1);
    setPageLpr(1);
    setMobileCountCams(ADMIN_PAGE_SIZE);
    setMobileCountIntel(ADMIN_PAGE_SIZE);
    setMobileCountLpr(ADMIN_PAGE_SIZE);
  }, [camTab, civitasTab, items.length, intelItems.length, lprItems.length]);

  async function runSyncCameras() {
    setSyncMsg(null);
    setErr(null);

    setSyncLoading(true);
    try {
      const resp = await fetchJson<any>(SYNC_CAMERAS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deactivate_missing: !!deactivateMissing,
        }),
      });

      setSyncMsg(
        `SYNC OK. (created=${resp?.result?.created ?? "-"}, updated=${resp?.result?.updated ?? "-"}, deactivated=${
          resp?.result?.deactivated ?? "-"
        })`
      );

      await load();
      onSynced?.();
    } catch (e: any) {
      setSyncMsg(null);
      setErr(e?.message || "Erro no sync CÂMERAS");
    } finally {
      setSyncLoading(false);
    }
  }

  async function runSyncCivitas() {
    setSyncMsg(null);
    setErr(null);

    setSyncLoading(true);
    try {
      const resp = await fetchJson<any>(SYNC_CIVITAS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deactivate_missing: !!deactivateMissing,
        }),
      });

      setSyncMsg(
        `SYNC OK. (created=${resp?.result?.created ?? "-"}, updated=${resp?.result?.updated ?? "-"}, deactivated=${
          resp?.result?.deactivated ?? "-"
        })`
      );

      if (civitasTab === "inteligentes") await loadIntel();
      if (civitasTab === "lpr") await loadLpr();
    } catch (e: any) {
      setSyncMsg(null);
      setErr(e?.message || "Erro no sync CÂMERAS CIVITAS");
    } finally {
      setSyncLoading(false);
    }
  }

  async function save() {
    setErr(null);
    if (!name.trim()) return setErr("Nome é obrigatório.");
    if (!code.trim()) return setErr("Código é obrigatório.");
    const latN = Number(lat);
    const lngN = Number(lng);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return setErr("Lat/Lng inválidos.");

    try {
      const payload = {
        name: name.trim(),
        code: code.trim(),
        city: city.trim() || null,
        uf: uf.trim() || null,
        address: address.trim() || null,
        lat: latN,
        lng: lngN,
        stream_url: streamUrl.trim() || null,
        is_active: isActive,
      };

      if (!id) {
        await fetchJson(CAMS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson(`${CAMS_URL}/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      resetForm();
      load();
      onSynced?.();
    } catch (e: any) {
      setErr(e?.message || "Erro ao salvar câmera");
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`subTab ${camTab === "cameras" ? "subTabActive" : ""}`} onClick={() => setCamTab("cameras")}>
          Câmeras
        </button>
        <button className={`subTab ${camTab === "civitas" ? "subTabActive" : ""}`} onClick={() => setCamTab("civitas")}>
          Câmeras Civitas
        </button>
      </div>

      {camTab === "civitas" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className={`subTab ${civitasTab === "inteligentes" ? "subTabActive" : ""}`}
            onClick={() => setCivitasTab("inteligentes")}
          >
            Inteligentes
          </button>
          <button className={`subTab ${civitasTab === "lpr" ? "subTabActive" : ""}`} onClick={() => setCivitasTab("lpr")}>
            LPR
          </button>
        </div>
      )}

      {camTab === "cameras" && (
        <>
          <div
            className="adminCard"
            style={{
              padding: 12,
              borderRadius: 16,
              background: "rgba(255,255,255,0.90)",
              border: "1px solid rgba(0,0,0,0.10)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>Atualizar Câmeras (SYNC)</div>

            <div style={{ display: "grid", gap: 10 }}>
              <button
                onClick={runSyncCameras}
                disabled={syncLoading}
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(0,0,0,0.86)",
                  color: "#fff",
                  cursor: syncLoading ? "not-allowed" : "pointer",
                  fontWeight: 900,
                  opacity: syncLoading ? 0.7 : 1,
                }}
              >
                {syncLoading ? "Sincronizando..." : "SYNC CÂMERAS"}
              </button>

              <label
                className="adminLabelWrap"
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.10)",
                  background: "rgba(255,255,255,0.95)",
                  fontWeight: 900,
                  color: "rgba(0,0,0,0.82)",
                }}
              >
                <input
                  type="checkbox"
                  checked={deactivateMissing}
                  onChange={(e) => setDeactivateMissing(e.target.checked)}
                  style={{ transform: "scale(1.1)" }}
                />
                Desativar no banco as que sumirem da fonte (deactivate_missing)
              </label>
            </div>

            {syncMsg && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>{syncMsg}</div>}
            {err && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#991b1b" }}>{err}</div>}

            
          </div>

          <div
            className="adminCard"
            style={{
              padding: 12,
              borderRadius: 16,
              background: "rgba(255,255,255,0.90)",
              border: "1px solid rgba(0,0,0,0.10)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Câmeras</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{loading ? "Carregando..." : `${items.length} itens`}</div>
            </div>

            <div
              style={{ display: "grid", gap: 8, maxHeight: "50vh", overflow: "auto" }}
              onScroll={(e) => {
                if (!isMobile) return;
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                  setMobileCountCams((v) => v + ADMIN_PAGE_SIZE);
                }
              }}
            >
              {(isMobile
                ? items.slice(0, mobileCountCams)
                : items.slice((pageCams - 1) * ADMIN_PAGE_SIZE, pageCams * ADMIN_PAGE_SIZE)
              ).map((c) => (
                <div
                  key={c.id || c.code}
                  className="adminRow"
                  style={{
                    border: "1px solid rgba(0,0,0,0.10)",
                    borderRadius: 14,
                    padding: 10,
                    background: "rgba(255,255,255,0.75)",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
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
                      {c.name} <span style={{ opacity: 0.6 }}>({c.code})</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {c.city} - {c.uf} • {c.is_active ? "ATIVA" : "INATIVA"}
                    </div>
                  </div>
                </div>
              ))}

              {!items.length && !loading && (
                <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma câmera encontrada.</div>
              )}
            </div>

            {!isMobile && items.length > ADMIN_PAGE_SIZE && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <button
                  className="btnGhost"
                  onClick={() => setPageCams((v) => Math.max(1, v - 1))}
                  disabled={pageCams <= 1}
                  style={{ opacity: pageCams <= 1 ? 0.5 : 1 }}
                >
                  Anterior
                </button>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Página {pageCams} de {Math.max(1, Math.ceil(items.length / ADMIN_PAGE_SIZE))}
                </div>
                <button
                  className="btnGhost"
                  onClick={() => setPageCams((v) => Math.min(Math.ceil(items.length / ADMIN_PAGE_SIZE), v + 1))}
                  disabled={pageCams >= Math.ceil(items.length / ADMIN_PAGE_SIZE)}
                  style={{ opacity: pageCams >= Math.ceil(items.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        </>
      )}
      {camTab === "civitas" && (
        <div
          className="adminCard"
          style={{
            padding: 12,
            borderRadius: 16,
            background: "rgba(255,255,255,0.90)",
            border: "1px solid rgba(0,0,0,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>Atualizar Câmeras Civitas (SYNC)</div>

          <div style={{ display: "grid", gap: 10 }}>
            <button
              onClick={runSyncCivitas}
              disabled={syncLoading}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "rgba(0,0,0,0.86)",
                color: "#fff",
                cursor: syncLoading ? "not-allowed" : "pointer",
                fontWeight: 900,
                opacity: syncLoading ? 0.7 : 1,
              }}
            >
              {syncLoading ? "Sincronizando..." : "SYNC CÂMERAS CIVITAS"}
            </button>

            <label
              className="adminLabelWrap"
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.10)",
                background: "rgba(255,255,255,0.95)",
                fontWeight: 900,
                color: "rgba(0,0,0,0.82)",
              }}
            >
              <input
                type="checkbox"
                checked={deactivateMissing}
                onChange={(e) => setDeactivateMissing(e.target.checked)}
                style={{ transform: "scale(1.1)" }}
              />
              Desativar no banco as que sumirem da fonte (deactivate_missing)
            </label>
          </div>

          {syncMsg && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>{syncMsg}</div>}
          {err && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#991b1b" }}>{err}</div>}
        </div>
      )}

      {camTab === "civitas" && civitasTab === "inteligentes" && (
        <div
          className="adminCard"
          style={{
            padding: 12,
            borderRadius: 16,
            background: "rgba(255,255,255,0.90)",
            border: "1px solid rgba(0,0,0,0.10)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Câmeras Inteligentes</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {intelLoading ? "Carregando..." : `${intelItems.length} itens`}
            </div>
          </div>
          <div
            style={{ display: "grid", gap: 8, maxHeight: "50vh", overflow: "auto" }}
            onScroll={(e) => {
              if (!isMobile) return;
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                setMobileCountIntel((v) => v + ADMIN_PAGE_SIZE);
              }
            }}
          >
            {(isMobile
              ? intelItems.slice(0, mobileCountIntel)
              : intelItems.slice((pageIntel - 1) * ADMIN_PAGE_SIZE, pageIntel * ADMIN_PAGE_SIZE)
            ).map((c) => (
              <div
                key={c.id || c.code}
                className="adminRow"
                style={{
                  border: "1px solid rgba(0,0,0,0.10)",
                  borderRadius: 14,
                  padding: 10,
                  background: "rgba(255,255,255,0.75)",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
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
                    {c.name} <span style={{ opacity: 0.6 }}>({c.code})</span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    IP: {c.ip || "-"} • Direção: {c.direction || "-"}
                  </div>
                </div>
              </div>
            ))}
            {!intelItems.length && !intelLoading && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma Super Câmera Inteligente encontrada.</div>
            )}
          </div>

          {!isMobile && intelItems.length > ADMIN_PAGE_SIZE && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <button
                className="btnGhost"
                onClick={() => setPageIntel((v) => Math.max(1, v - 1))}
                disabled={pageIntel <= 1}
                style={{ opacity: pageIntel <= 1 ? 0.5 : 1 }}
              >
                Anterior
              </button>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Página {pageIntel} de {Math.max(1, Math.ceil(intelItems.length / ADMIN_PAGE_SIZE))}
              </div>
              <button
                className="btnGhost"
                onClick={() => setPageIntel((v) => Math.min(Math.ceil(intelItems.length / ADMIN_PAGE_SIZE), v + 1))}
                disabled={pageIntel >= Math.ceil(intelItems.length / ADMIN_PAGE_SIZE)}
                style={{ opacity: pageIntel >= Math.ceil(intelItems.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      {camTab === "civitas" && civitasTab === "lpr" && (
        <div
          className="adminCard"
          style={{
            padding: 12,
            borderRadius: 16,
            background: "rgba(255,255,255,0.90)",
            border: "1px solid rgba(0,0,0,0.10)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Câmeras LPR</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {lprLoading ? "Carregando..." : `${lprItems.length} itens`}
            </div>
          </div>
          <div
            style={{ display: "grid", gap: 8, maxHeight: "50vh", overflow: "auto" }}
            onScroll={(e) => {
              if (!isMobile) return;
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                setMobileCountLpr((v) => v + ADMIN_PAGE_SIZE);
              }
            }}
          >
            {(isMobile
              ? lprItems.slice(0, mobileCountLpr)
              : lprItems.slice((pageLpr - 1) * ADMIN_PAGE_SIZE, pageLpr * ADMIN_PAGE_SIZE)
            ).map((c) => (
              <div
                key={c.id || c.code}
                className="adminRow"
                style={{
                  border: "1px solid rgba(0,0,0,0.10)",
                  borderRadius: 14,
                  padding: 10,
                  background: "rgba(255,255,255,0.75)",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
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
                    {c.name} <span style={{ opacity: 0.6 }}>({c.code})</span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    IP: {c.ip || "-"} • Direção: {c.direction || "-"}
                  </div>
                </div>
              </div>
            ))}
            {!lprItems.length && !lprLoading && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma câmera LPR encontrada.</div>
            )}
          </div>

          {!isMobile && lprItems.length > ADMIN_PAGE_SIZE && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <button
                className="btnGhost"
                onClick={() => setPageLpr((v) => Math.max(1, v - 1))}
                disabled={pageLpr <= 1}
                style={{ opacity: pageLpr <= 1 ? 0.5 : 1 }}
              >
                Anterior
              </button>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Página {pageLpr} de {Math.max(1, Math.ceil(lprItems.length / ADMIN_PAGE_SIZE))}
              </div>
              <button
                className="btnGhost"
                onClick={() => setPageLpr((v) => Math.min(Math.ceil(lprItems.length / ADMIN_PAGE_SIZE), v + 1))}
                disabled={pageLpr >= Math.ceil(lprItems.length / ADMIN_PAGE_SIZE)}
                style={{ opacity: pageLpr >= Math.ceil(lprItems.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ===========================
   ADMIN: RADARES (LIST + SYNC)
=========================== */
function AdminRadaresPanel({
  apiBase,
  token,
  onSynced,
  isMobile,
}: {
  apiBase: string;
  token: string;
  onSynced?: () => void;
  isMobile: boolean;
}) {
  const RADARES_URL = `${apiBase}/api/v1/radares`;
  const SYNC_RADARES_URL = `${apiBase}/api/v1/sync/radares`;

  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [items, setItems] = useState<Radar[]>([]);
  const [deactivateMissing, setDeactivateMissing] = useState(true);
  const [page, setPage] = useState(1);
  const [mobileCount, setMobileCount] = useState(ADMIN_PAGE_SIZE);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchJson<any>(RADARES_URL, {
        headers: { Authorization: `Bearer ${token}` },
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

      setItems(normalized);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar radares");
    } finally {
      setLoading(false);
    }
  }

  async function runSyncRadares() {
    setErr(null);
    setSyncMsg(null);

    setSyncLoading(true);
    try {
      const resp = await fetchJson<any>(SYNC_RADARES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deactivate_missing: !!deactivateMissing,
        }),
      });

      setSyncMsg(
        `SYNC OK. (created=${resp?.result?.created ?? "-"}, updated=${resp?.result?.updated ?? "-"}, deactivated=${
          resp?.result?.deactivated ?? "-"
        })`
      );

      await load();
      onSynced?.();
    } catch (e: any) {
      setErr(e?.message || "Erro no sync RADARES");
    } finally {
      setSyncLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    setMobileCount(ADMIN_PAGE_SIZE);
  }, [items.length]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        className="adminCard"
        style={{
          padding: 12,
          borderRadius: 16,
          background: "rgba(255,255,255,0.90)",
          border: "1px solid rgba(0,0,0,0.10)",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>AtualizarRadares (SYNC)</div>

        <div style={{ display: "grid", gap: 10 }}>
          <button
            onClick={runSyncRadares}
            disabled={syncLoading}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(0,0,0,0.86)",
              color: "#fff",
              cursor: syncLoading ? "not-allowed" : "pointer",
              fontWeight: 900,
              opacity: syncLoading ? 0.7 : 1,
            }}
          >
            {syncLoading ? "Sincronizando..." : "SYNC RADARES"}
          </button>

          <label
            className="adminLabelWrap"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "rgba(255,255,255,0.95)",
              fontWeight: 900,
              color: "rgba(0,0,0,0.82)",
            }}
          >
            <input
              type="checkbox"
              checked={deactivateMissing}
              onChange={(e) => setDeactivateMissing(e.target.checked)}
              style={{ transform: "scale(1.1)" }}
            />
            Desativar no banco os que sumirem da fonte (deactivate_missing)
          </label>

          <button
            onClick={load}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.90)",
              cursor: "pointer",
              fontWeight: 900,
              color: "rgba(0,0,0,0.85)",
            }}
          >
            Recarregar lista
          </button>
        </div>

        {syncMsg && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>{syncMsg}</div>}
        {err && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#991b1b" }}>{err}</div>}
      </div>

      <div
        className="adminCard"
        style={{
          padding: 12,
          borderRadius: 16,
          background: "rgba(255,255,255,0.90)",
          border: "1px solid rgba(0,0,0,0.10)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Radares</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{loading ? "Carregando..." : `${items.length} itens`}</div>
        </div>

        <div
          style={{ display: "grid", gap: 8, maxHeight: "50vh", overflow: "auto" }}
          onScroll={(e) => {
            if (!isMobile) return;
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
              setMobileCount((v) => v + ADMIN_PAGE_SIZE);
            }
          }}
        >
          {(isMobile ? items.slice(0, mobileCount) : items.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE)).map(
            (r) => (
            <div
              key={r.id || r.codcet}
              style={{
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 14,
                padding: 10,
                background: "rgba(255,255,255,0.75)",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 13 }}>
                Radar <span style={{ opacity: 0.65 }}>({r.codcet})</span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.78, marginTop: 4 }}>
                {r.bairro || "-"} • {r.logradouro || r.localidade || "-"} • {r.sentido || "-"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.78, marginTop: 4 }}>
                Empresa: {r.empresa || "-"} • Vel: {r.velofisc ?? "-"} • Equip: {r.numero_equipamento || "-"} • Status:{" "}
                {r.status || (r.is_active !== false ? "ATIVO" : "INATIVO")}
              </div>
            </div>
          ))}

          {!items.length && !loading && <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhum radar encontrado.</div>}
        </div>

        {!isMobile && items.length > ADMIN_PAGE_SIZE && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <button
              className="btnGhost"
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              disabled={page <= 1}
              style={{ opacity: page <= 1 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Página {page} de {Math.max(1, Math.ceil(items.length / ADMIN_PAGE_SIZE))}
            </div>
            <button
              className="btnGhost"
              onClick={() => setPage((v) => Math.min(Math.ceil(items.length / ADMIN_PAGE_SIZE), v + 1))}
              disabled={page >= Math.ceil(items.length / ADMIN_PAGE_SIZE)}
              style={{ opacity: page >= Math.ceil(items.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===========================
   ADMIN: LOGS
=========================== */
function AdminLogsPanel({
  apiBase,
  token,
  isMobile,
}: {
  apiBase: string;
  token: string;
  isMobile: boolean;
}) {
  const LOGS_URL = `${apiBase}/api/v1/logs`;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<AdminLog[]>([]);
  const [page, setPage] = useState(1);
  const [mobileCount, setMobileCount] = useState(ADMIN_PAGE_SIZE);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchJson<any>(LOGS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list: AdminLog[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setItems(list);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    setMobileCount(ADMIN_PAGE_SIZE);
  }, [items.length]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        className="adminCard"
        style={{
          padding: 12,
          borderRadius: 16,
          background: "rgba(255,255,255,0.90)",
          border: "1px solid rgba(0,0,0,0.10)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Logs</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{loading ? "Carregando..." : `${items.length} itens`}</div>
          <div style={{ flex: 1 }} />
          <button
            onClick={load}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.90)",
              cursor: "pointer",
              fontWeight: 900,
              color: "rgba(0,0,0,0.85)",
            }}
          >
            Recarregar
          </button>
        </div>

        {err && <div style={{ marginTop: 10, fontSize: 12, color: "#991b1b" }}>{err}</div>}
      </div>

      <div
        className="adminCard"
        style={{
          padding: 12,
          borderRadius: 16,
          background: "rgba(255,255,255,0.90)",
          border: "1px solid rgba(66, 66, 66, 0.1)",
        }}
      >
        <div
          style={{ display: "grid", gap: 8, maxHeight: "50vh", overflow: "auto" }}
          onScroll={(e) => {
            if (!isMobile) return;
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
              setMobileCount((v) => v + ADMIN_PAGE_SIZE);
            }
          }}
        >
          {(isMobile
            ? items.slice(0, mobileCount)
            : items.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE)
          ).map((l, idx) => (
            <div
              key={l.id || idx}
              style={{
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 14,
                padding: 10,
                background: "rgba(255,255,255,0.75)",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 12 }}>
                {l.message || `${l.user_email || "Usuário"} • ${l.action}`}
              </div>

              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                {l.created_at ? new Date(l.created_at).toLocaleString("pt-BR") : "-"}
                {l.entity_type ? ` • ${l.entity_type}` : ""}
                {l.target?.code ? ` • ${l.target.code}` : ""}
                {l.target?.codcet ? ` • ${l.target.codcet}` : ""}
                {l.target?.email ? ` • ${l.target.email}` : ""}
              </div>
            </div>
          ))}

          {!items.length && !loading && <div style={{ fontSize: 12, opacity: 0.75 }}>Sem logs ainda.</div>}
        </div>

        {!isMobile && items.length > ADMIN_PAGE_SIZE && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <button
              className="btnGhost"
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              disabled={page <= 1}
              style={{ opacity: page <= 1 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Página {page} de {Math.max(1, Math.ceil(items.length / ADMIN_PAGE_SIZE))}
            </div>
            <button
              className="btnGhost"
              onClick={() => setPage((v) => Math.min(Math.ceil(items.length / ADMIN_PAGE_SIZE), v + 1))}
              disabled={page >= Math.ceil(items.length / ADMIN_PAGE_SIZE)}
              style={{ opacity: page >= Math.ceil(items.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
