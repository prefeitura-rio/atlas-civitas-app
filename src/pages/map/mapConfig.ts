

export type TabKey = "map" | "profile" | "civitas" | "admin";

export type PanelKey = TabKey | null;

export type AdminTab = "usage" | "users" | "organizations" | "notifications" | "logs" | "cameras" | "smart_cameras" | "lpr" | "radares" | "cinematic";

export type ListMode = "cameras" | "inteligentes" | "lpr" | "radares";

export type SecurityAreaKind = "risp" | "aisp" | "cisp";

export type AreaDrawPolygonPoints = Array<[number, number]>;

export type PreviewPopupAnchor = "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export const ADMIN_TAB_OPTIONS: Array<{ key: AdminTab; label: string }> = [
  { key: "users", label: "Usuários" },
  { key: "organizations", label: "Organizações" },
  { key: "notifications", label: "Notificações" },
  { key: "cameras", label: "Câmeras" },
  { key: "smart_cameras", label: "Super Câmeras Inteligentes" },
  { key: "lpr", label: "LPR" },
  { key: "radares", label: "Radares" },
  { key: "cinematic", label: "Modo cinematográfico" },
  { key: "usage", label: "Métricas" },
  { key: "logs", label: "Logs" },
];

export const EQUIPMENT_ADMIN_TABS: AdminTab[] = ["cameras", "smart_cameras", "lpr", "radares"];

export const REPORT_LAYER_RULES = [
  { feature: "cameras", layer: "cameras" },
  { feature: "cameras_inteligentes", layer: "cameras_inteligentes" },
  { feature: "cameras_lpr", layer: "cameras_lpr" },
  { feature: "radares", layer: "radares" },
] as const;

export const LIST_MODE_OPTIONS: Array<{ mode: ListMode; feature: string; label: string }> = [
  { mode: "cameras", feature: "cameras", label: "Câmeras" },
  { mode: "inteligentes", feature: "cameras_inteligentes", label: "Super Câmeras Inteligentes" },
  { mode: "lpr", feature: "cameras_lpr", label: "LPR" },
  { mode: "radares", feature: "radares", label: "Radares" },
];

export const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.toString() ||
  (import.meta as any).env?.VITE_API_BASE_URL?.toString() ||
  "http://localhost:8000";

export const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN?.toString() || "";

export type MapBaseStyle = "streets" | "satellite";

export type CameraMarkerKind = "camera" | "camera_intel";

export const CAMERA_MARKER_ICON_SIZE = 0.9;

export const CAMERA_INTEL_MARKER_ICON_SIZE = 0.9;

export const CAMERA_LPR_MARKER_ICON_SIZE = 1.1;

export const RADAR_MARKER_ICON_SIZE = 1;

export const GPS_CONE_LENGTH_METERS = 60;

export const GPS_CONE_HALF_ANGLE_DEG = 30;

export const GPS_CONE_SEGMENTS = 12;

// base atual + satélite
export const MAP_STYLE_DARK = "mapbox://styles/mapbox/dark-v11" as const;

export const MAP_STYLE_SATELLITE = "mapbox://styles/mapbox/satellite-streets-v12" as const;

export const PAGE_SIZE = 50;

export const SMART_CAMERA_PREVIEW_DURATION_SECONDS = 60;

export const SMART_CAMERA_STREAM_DURATION_SECONDS = 480;

// IDs fixos
export const SOURCES = {
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

export const LAYERS = {
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

export const POI_LAYER_IDS = [
  LAYERS.clusters,
  LAYERS.cluster_count,
  LAYERS.cameras_points,
  LAYERS.cameras_intel_points,
  LAYERS.cameras_lpr_points,
  LAYERS.radares_points,
] as const;

export const IMAGES = {
  radar: "radar_icon",
  camera_lpr: "camera_lpr_icon",
  search_pin: "search_pin_icon",
} as const;
