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
} from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import { showAppAlert, showStreamingAlert } from "./map/alerts";
import {
  Bell,
  Building2,
  ChartNoAxesCombined,
  ChevronRight,
  Clapperboard,
  Eye,
  LayoutDashboard,
  Layers,
  LocateFixed,
  MapPinned,
  LogOut,
  Menu,
  MessageCircle,
  PenTool,
  RadioTower,
  Search,
  ScanLine,
  Satellite,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "../app/auth";
import {
  fetchJson,
  inputStyle,
  cleanString,
  firstNonEmptyString,
  getPointCollectionCode,
  getPointCollectionIdentifiers,
  getPointCollectionKey,
  getPointCollectionTitle,
} from "./map/shared";
import type { Camera, CameraIntel, CameraLpr, Radar } from "./map/types";
import {
  canAccessAdminBackoffice,
  canAccessSmartCameraStreaming,
  canAccessStreaming,
  normalizeRole,
} from "./map/roles";
import "./map/map.css";
import atlasBrand from "@/assets/atlas-brand.png";
import cameraIcon from "@/assets/camera-icon.png";
import radarIconSatellite from "@/assets/radar-icon-satellite.png";
import cameraIntelIcon from "@/assets/cameras-inteligentes-icon.png";
import cameraLprIconSatellite from "@/assets/camera-lpr-icon-satellite.png";
import mapPinRed from "@/assets/map-pin-red.svg";
import civitasActionSymbol from "@/assets/civitas-action-symbol.png";
import { AdminWorkspace } from "./map/AdminWorkspace";
import { NotificationCenter } from "./map/NotificationCenter";
import { LayerToggle } from "./map/LayerToggle";
import { ClusterSummary, type ClusterCounts } from "./map/ClusterSummary";
import { useEquipmentLayer } from "./map/useEquipmentLayer";
import {
  getLat,
  getLng,
  metersToPixelsAtLat,
  normalizeBearingDegrees,
  buildGpsConePolygon,
  clamp,
} from "./map/coordinates";
import { useMapSearch } from "./map/useMapSearch";
import { civitasTabLabel, civitasContactWhatsappHref } from "./map/civitasContent";
import { useCivitasScroll } from "./map/useCivitasScroll";
import { CivitasPanel } from "./map/CivitasPanel";
import { GeometrySummaryCard } from "./map/GeometrySummaryCard";
import {
  createMapLayers,
  updateAreaDrawData,
  updateBairrosData,
  updateBairrosLineData,
  updateRispData,
  updateAispData,
  updateCispData,
  applyBairrosVisibility,
  applyCodeVisibility,
  buildMatchExpr,
  applyCodeColors,
} from "./map/mapLayers";
import {
  createCameraStreaming,
  shouldDisableSmartCameraStreaming,
  getSmartCameraSessionErrorMessage,
  shouldRetryCommonCameraSession,
  escapeHtml,
  isHttpsUrl,
} from "./map/streaming";
import { createReportDownloads } from "./map/reportDownloads";
import {
  areaGeometryFromPolygons,
  getAreaDrawInsertInfo,
  areaDrawContainsPoint,
  areaDrawIsNearExistingVertex,
  getAreaDrawExpandedPoints,
  insertAreaDrawPoint,
  replaceAreaDrawPoint,
  areaDrawHasSelfIntersection,
} from "./map/areaDrawing";
import {
  formatSecurityAreaLabel,
  type BairrosFeature,
  type SecurityAreaFeature,
  type GeometryStats,
  buildBairrosLineGeoData,
  mergePolygonalGeometries,
  normalizeBairrosGeoData,
  getBairroFeatureName,
  emptyGeometrySelectionIds,
  buildGeometryStats,
  buildGeometrySelectionIds,
  getSecurityAreaFeatureCode,
  mergeSecurityAreaFeatures,
  getGeometryBbox,
  pointInGeometry,
  normalizeCodeGeoByName,
  keepOnlyCodes,
} from "./map/geometry";
import { usePasswordChange } from "./map/usePasswordChange";
import { ProfilePanel } from "./map/ProfilePanel";
import {
  type TabKey,
  type PanelKey,
  type AdminTab,
  type ListMode,
  type SecurityAreaKind,
  type AreaDrawPolygonPoints,
  type PreviewPopupAnchor,
  ADMIN_TAB_OPTIONS,
  EQUIPMENT_ADMIN_TABS,
  REPORT_LAYER_RULES,
  LIST_MODE_OPTIONS,
  API_BASE,
  MAPBOX_TOKEN,
  type MapBaseStyle,
  MAP_STYLE_DARK,
  MAP_STYLE_SATELLITE,
  PAGE_SIZE,
  SMART_CAMERA_PREVIEW_DURATION_SECONDS,
  SMART_CAMERA_STREAM_DURATION_SECONDS,
  SOURCES,
  LAYERS,
  POI_LAYER_IDS,
  IMAGES,
} from "./map/mapConfig";
import {
  getCameraMarkerImageId,
  getCameraMarkerImageSource,
  getRadarMarkerImageSource,
  getCameraLprMarkerImageSource,
  upsertMapImage,
} from "./map/mapImages";
import {
  getLprNeighborhood,
  camerasToFeatures,
  camerasIntelToFeatures,
  camerasLprToFeatures,
  radaresToFeatures,
  normalizeCameras,
  normalizeCamerasIntel,
  normalizeCamerasLpr,
  normalizeRadares,
} from "./map/equipment";
import {
  type PoiKind,
  POI_KIND_ORDER,
  POI_MARKER_PIXEL_SIZES,
  sortStackedPoiFeatures,
  asPoiKind,
  getPoiVisual,
  getPoiIconSource,
  getPoiListIconBubbleStyle,
  getPoiListIconStyle,
  getPoiCodePillStyle,
  poiCoordKey,
  featureCoordKey,
} from "./map/poiFeatures";

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
  const cinematicModeRef = useRef(false);
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
  const hoverPreviewAnchorRef = useRef<PreviewPopupAnchor>("bottom");
  const hoverPreviewTimerRef = useRef<number | null>(null);
  const hoverPreviewCloseTimerRef = useRef<number | null>(null);
  const hoverPreviewCountdownTimerRef = useRef<number | null>(null);
  const hoverPreviewGenerationRef = useRef(0);
  const hideStackCirclePreviewRef = useRef<(() => void) | null>(null);
  const poiCoordIndexRef = useRef<Map<string, Feature<Point, any>[]>>(new Map());
  const stackCircleMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const stackCircleConnectionsRef = useRef<mapboxgl.Marker | null>(null);
  const stackCircleLayerOpacityRef = useRef<Array<{ layerId: string; opacity: mapboxgl.DataDrivenPropertyValueSpecification<number> | undefined }>>([]);
  const stackCircleKeyRef = useRef<string | null>(null);
  const stackCircleCenterRef = useRef<[number, number] | null>(null);
  const stackCircleRadiusRef = useRef(0);
  const stackCircleAnimationRef = useRef(0);
  const stackPreviewPanActiveRef = useRef(false);
  const stackPreviewPanGenerationRef = useRef(0);
  const stackPreviewLockedMarkerRef = useRef<HTMLButtonElement | null>(null);
  const stackCirclePointerLeaveRef = useRef<((event: PointerEvent) => void) | null>(null);
  const suppressHoverHideRef = useRef(false);
  const suppressHoverHideTimerRef = useRef<number | null>(null);
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const unavailableSmartCameraIdsRef = useRef<Record<string, true>>({});
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);

  const handlersBoundRef = useRef(false);
  const selectionRingTimerRef = useRef<number | null>(null);
  const syncMapStyleStateRef = useRef<(map: mapboxgl.Map) => void | Promise<void>>(() => {});

  const [panel, setPanel] = useState<PanelKey>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileNotificationMenuTarget, setMobileNotificationMenuTarget] = useState<HTMLDivElement | null>(null);
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

  const equipmentScope = `${me?.id || me?.email || ""}:${me?.organization_id || ""}:${me?.role || ""}`;
  const equipmentReady = !authLoading && !!accessToken;
  const { data: cameras, loading: loadingCameras, reload: loadCameras } = useEquipmentLayer({
    url: `${API_BASE}/cameras?active_only=true`, token: accessToken, scope: equipmentScope,
    enabled: equipmentReady && canViewCameras, normalize: normalizeCameras,
    failureMessage: "Falha ao carregar câmeras",
  });
  const { data: camerasIntel, loading: loadingCamerasIntel, reload: loadCamerasIntel } = useEquipmentLayer({
    url: `${API_BASE}/cameras-inteligentes?only_active=true`, token: accessToken, scope: equipmentScope,
    enabled: equipmentReady && canViewCamerasIntel, normalize: normalizeCamerasIntel,
    failureMessage: "Falha ao carregar câmeras inteligentes",
  });
  const { data: camerasLpr, loading: loadingCamerasLpr, reload: loadCamerasLpr } = useEquipmentLayer({
    url: `${API_BASE}/cameras-lpr?only_active=true`, token: accessToken, scope: equipmentScope,
    enabled: equipmentReady && canViewCamerasLpr, normalize: normalizeCamerasLpr,
    failureMessage: "Falha ao carregar câmeras LPR",
  });
  const { data: radares, loading: loadingRadares, reload: loadRadares } = useEquipmentLayer({
    url: `${API_BASE}/radares?only_active=true`, token: accessToken, scope: equipmentScope,
    enabled: equipmentReady && canViewRadares, normalize: normalizeRadares,
    failureMessage: "Falha ao carregar radares",
  });
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedRadar, setSelectedRadar] = useState<string | null>(null);

  const [showCameras, setShowCameras] = useState(canViewCameras);
  const [showCamerasIntel, setShowCamerasIntel] = useState(canViewCamerasIntel);
  const [showCamerasLpr, setShowCamerasLpr] = useState(canViewCamerasLpr);
  const [showRadares, setShowRadares] = useState(canViewRadares);
  const [showBairros, setShowBairros] = useState(false);
  const [bairroIntroOpen, setBairroIntroOpen] = useState(false);
  const [bairroSearchMinimized, setBairroSearchMinimized] = useState(false);
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
  const [areaDrawAwaitingStart, setAreaDrawAwaitingStart] = useState(false);
  const [areaDrawMinimized, setAreaDrawMinimized] = useState(false);
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
    areaDrawModeRef.current = areaDrawMode && !areaDrawAwaitingStart && !areaDrawMinimized;
  }, [areaDrawMode, areaDrawAwaitingStart, areaDrawMinimized]);

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

  const password = usePasswordChange(accessToken);

  const [adminTab, setAdminTab] = useState<AdminTab>("users");
  const [cinematicMode, setCinematicMode] = useState(false);
  const [hoveredCluster, setHoveredCluster] = useState<{ id: number; counts: ClusterCounts } | null>(null);
  const [adminMenuExpanded, setAdminMenuExpanded] = useState(true);
  const [equipmentMenuExpanded, setEquipmentMenuExpanded] = useState(true);
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

  const developmentTabLabel = "ADMINISTRADOR";

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

  const [dockOpen, setDockOpen] = useState(false);
  const dockHandleRef = useRef<HTMLButtonElement | null>(null);
  const dockCloseRef = useRef<HTMLButtonElement | null>(null);
  const dockPanelRef = useRef<HTMLDivElement | null>(null);
  const wasDesktopDockOpenRef = useRef(false);
  const DOCK_AUTOHIDE_MS = 0;
  const dockTimerRef = useRef<number | null>(null);

  const {
    searchQuery, setSearchQuery, searchMode, setSearchMode, searchErr, setSearchErr, searchPin, searchEquipmentPoint, setSearchEquipmentPoint, searchEquipmentViewport, setSearchEquipmentViewport, searchedEquipment, setSearchedEquipment, searchEquipmentTitle, setSearchEquipmentTitle, nearbyVisibleCount, setNearbyVisibleCount, addressSearchFlyPendingRef, searchTimerRef, automaticSearchTimerRef, searchGenerationRef, handleSearch, scheduleAutomaticSearch, submitMobileSearch,
  } = useMapSearch({ cameras, camerasIntel, camerasLpr, radares, flyToPoint, setPanel, setPanelOpen, setMobileSearchOpen });

  const panelRef = useRef<PanelKey>(null);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const adminWorkspaceMainRef = useRef<HTMLElement | null>(null);
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

  const civitasScroll = useCivitasScroll(panel);

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

  useEffect(() => {
    const desktopOpen = dockOpen && !isMobile;
    const wasOpen = wasDesktopDockOpenRef.current;
    wasDesktopDockOpenRef.current = desktopOpen;

    if (!desktopOpen) {
      if (wasOpen) dockHandleRef.current?.focus();
      return;
    }

    dockCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDockOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dockPanelRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])"
        ) ?? []
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !dockPanelRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dockPanelRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dockOpen, isMobile]);

  const role = normalizeRole(me?.role ?? me?.roles?.[0]);
  const canAccessAdmin = canAccessAdminBackoffice(role);
  useEffect(() => {
    if (!canAccessAdmin || isMobile) setCinematicMode(false);
  }, [canAccessAdmin, isMobile]);
  const hasStreamingAccess = canAccessStreaming(role);
  const hasSmartCameraStreamingAccess = canAccessSmartCameraStreaming(role);
  const adminTabOptions = useMemo(() => {
    return ADMIN_TAB_OPTIONS.filter((option) =>
      (!isMobile || option.key !== "cinematic") &&
      (role !== "manager" || option.key === "users" || option.key === "organizations" || option.key === "cinematic")
    );
  }, [role, isMobile]);
  const activeAdminTab = adminTabOptions.some((option) => option.key === adminTab)
    ? adminTab
    : adminTabOptions[0]?.key ?? "users";
  const activeAdminLabel = adminTabOptions.find((option) => option.key === activeAdminTab)?.label ?? "Usuários";
  const activeAdminIsEquipment = EQUIPMENT_ADMIN_TABS.includes(activeAdminTab);
  function adminTabIcon(key: AdminTab) {
    if (key === "notifications") return <Bell aria-hidden="true" />;
    if (key === "cinematic") return <Clapperboard aria-hidden="true" />;
    if (key === "users") return <UserRound aria-hidden="true" />;
    if (key === "organizations") return <Building2 aria-hidden="true" />;
    if (key === "cameras" || key === "smart_cameras" || key === "lpr") return <Eye aria-hidden="true" />;
    if (key === "radares") return <RadioTower aria-hidden="true" />;
    if (key === "usage") return <ChartNoAxesCombined aria-hidden="true" />;
    return <ShieldCheck aria-hidden="true" />;
  }
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
    setShowCameras(canViewCameras);
  }, [canViewCameras]);

  useEffect(() => {
    setShowCamerasIntel(canViewCamerasIntel);
  }, [canViewCamerasIntel]);

  useEffect(() => {
    setShowCamerasLpr(canViewCamerasLpr);
  }, [canViewCamerasLpr]);

  useEffect(() => {
    setShowRadares(canViewRadares);
  }, [canViewRadares]);

  useEffect(() => {
    if (!canViewBairros) {
      setShowBairros(false);
      setBairroIntroOpen(false);
      setBairroSearchMinimized(false);
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
      setAreaDrawAwaitingStart(false);
      setAreaDrawMinimized(false);
      setAreaToolsOpen(false);
      setAreaDrawPoints([]);
      setAreaReportMsg(null);
    }
  }, [canUseAreaDraw]);

  function togglePanel(next: TabKey) {
    if (next === "map") {
      setSearchEquipmentPoint(null);
      setSearchedEquipment([]);
      setSearchEquipmentTitle("");
    }
    if (next === "civitas") {
      setPanelOpen(false);
      setMobileSearchOpen(false);
    }
    setPanel((cur) => (cur === next ? null : next));
  }

  useEffect(() => {
    if (panel === "admin" && !canAccessAdmin) setPanel(null);
  }, [panel, canAccessAdmin]);

  useEffect(() => {
    if (panel !== "admin") return;
    if (adminTab === activeAdminTab) return;
    setAdminTab(activeAdminTab);
  }, [panel, adminTab, activeAdminTab]);

  useEffect(() => {
    adminWorkspaceMainRef.current?.scrollTo(0, 0);
  }, [activeAdminTab]);

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

  function focusOnEquipment(kind: "camera" | "camera_intel" | "camera_lpr" | "radar", lng: number, lat: number, zoom = 17.2) {
    const layer = {
      camera: { visible: showCameras, name: "Câmeras" },
      camera_intel: { visible: showCamerasIntel, name: "Super Câmeras Inteligentes" },
      camera_lpr: { visible: showCamerasLpr, name: "LPR" },
      radar: { visible: showRadares, name: "Radares" },
    }[kind];

    if (!layer.visible) {
      void showAppAlert({
        icon: "info",
        title: "Camada desativada",
        text: `Ative a camada de ${layer.name} para visualizar este equipamento no mapa.`,
        confirmButtonText: "Entendi",
      });
      return false;
    }

    focusOnDetection(lng, lat, zoom);
    return true;
  }

  function closeSearchEquipmentResults() {
    addressSearchFlyPendingRef.current = false;
    setSearchEquipmentPoint(null);
    setSearchEquipmentViewport(null);
    setSearchedEquipment([]);
    setSearchEquipmentTitle("");
    setPanel(null);
    setPanelOpen(false);
  }

  function updatePoisData(map: mapboxgl.Map, geo: FeatureCollection<Point, any>) {
    setHoveredCluster(null);
    const src: any = map.getSource(SOURCES.pois);
    if (src && typeof src.setData === "function") src.setData(geo);
  }

  function clearStackCircle() {
    stackPreviewPanGenerationRef.current += 1;
    stackPreviewPanActiveRef.current = false;
    stackPreviewLockedMarkerRef.current = null;
    if (stackCircleKeyRef.current) hideStackCirclePreviewRef.current?.();
    stackCircleAnimationRef.current += 1;
    const map = mapRef.current;
    for (const { layerId, opacity } of stackCircleLayerOpacityRef.current) {
      if (map?.getLayer(layerId)) map.setPaintProperty(layerId, "icon-opacity", opacity ?? 1);
    }
    stackCircleLayerOpacityRef.current = [];
    stackCircleConnectionsRef.current?.remove();
    stackCircleConnectionsRef.current = null;
    stackCircleMarkersRef.current.forEach((marker) => marker.remove());
    stackCircleMarkersRef.current = [];
    stackCircleKeyRef.current = null;
    stackCircleCenterRef.current = null;
    stackCircleRadiusRef.current = 0;
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

  function syncMapStyleState(map: mapboxgl.Map) {
    const currentStyle = mapBaseStyleRef.current;
    const cameraImageId = getCameraMarkerImageId(currentStyle, "camera");
    const cameraIntelImageId = getCameraMarkerImageId(currentStyle, "camera_intel");
    const cameraImageSrc = getCameraMarkerImageSource(currentStyle, "camera");
    const cameraIntelImageSrc = getCameraMarkerImageSource(currentStyle, "camera_intel");
    const radarImageSrc = getRadarMarkerImageSource(currentStyle);
    const cameraLprImageSrc = getCameraLprMarkerImageSource(currentStyle);
    void Promise.allSettled([
      upsertMapImage(map, cameraImageId, cameraImageSrc),
      upsertMapImage(map, cameraIntelImageId, cameraIntelImageSrc),
      upsertMapImage(map, IMAGES.radar, radarImageSrc),
      upsertMapImage(map, IMAGES.camera_lpr, cameraLprImageSrc),
      upsertMapImage(map, IMAGES.search_pin, mapPinRed),
    ]).then((results) => {
      for (const result of results) {
        if (result.status === "rejected") console.warn("Falha ao carregar ícone do mapa:", result.reason);
      }
      if (mapRef.current === map && mapBaseStyleRef.current === currentStyle && map.isStyleLoaded()) {
        ensureSourcesAndLayers(map, currentStyle);
      }
    });

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
    setHoveredCluster(null);
    clearStackCircle();
    mapBaseStyleRef.current = next;
    setMapBaseStyle(next);
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(next === "satellite" ? MAP_STYLE_SATELLITE : MAP_STYLE_DARK);
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

    function ensureHoverPreviewPopup(anchor: PreviewPopupAnchor) {
      if (hoverPreviewPopupRef.current && hoverPreviewAnchorRef.current === anchor) {
        return hoverPreviewPopupRef.current;
      }
      hoverPreviewPopupRef.current?.remove();
      hoverPreviewPopupRef.current = new mapboxgl.Popup({
        offset: 14,
        closeButton: false,
        closeOnClick: false,
        maxWidth: "360px",
        className: "cameraHoverPreviewPopup",
        anchor,
      });
      hoverPreviewAnchorRef.current = anchor;
      return hoverPreviewPopupRef.current;
    }

    function getHoverPreviewPlacement(
      position: [number, number],
      pointY: number,
      stackAnchor?: PreviewPopupAnchor
    ) {
      const minTop = 96 + 6;
      const isNearTop = pointY < minTop + 240;
      const offsetY = isNearTop ? Math.max(14, minTop - pointY + 14) : 14;
      const opensDownward = stackAnchor === "top" || stackAnchor === "top-left" || stackAnchor === "top-right";
      const panY = opensDownward ? Math.max(0, pointY + 30 + 240 - (map.getContainer().clientHeight - 12)) : 0;
      return {
        position,
        anchor: panY > 0 ? "top" : stackAnchor ?? (isNearTop ? "top" : "bottom"),
        offset: stackAnchor ? 30 : isNearTop ? [0, offsetY] as [number, number] : 14,
        panY,
      };
    }

    function releaseStackPreviewPointerLock() {
      const lockedMarker = stackPreviewLockedMarkerRef.current;
      stackPreviewLockedMarkerRef.current = null;
      lockedMarker?.dispatchEvent(new MouseEvent("mouseleave"));
    }

    function panStackPreviewIntoView(position: [number, number], panY: number, button?: HTMLButtonElement) {
      if (panY <= 0) return;
      const mapContainer = map.getContainer();
      const pointX = map.project(position).x;
      const generation = ++stackPreviewPanGenerationRef.current;
      stackPreviewPanActiveRef.current = true;
      stackPreviewLockedMarkerRef.current = button ?? null;
      map.once("moveend", () => {
        if (generation === stackPreviewPanGenerationRef.current) stackPreviewPanActiveRef.current = false;
      });
      map.panBy([pointX - mapContainer.clientWidth / 2, panY], {
        duration: 750,
        easing: (t) => t * t * (3 - 2 * t),
      });
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
    hideStackCirclePreviewRef.current = hideHoverPreview;

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

    function bindSmartCameraPopupActions(targetPopup: mapboxgl.Popup | null = popup) {
      if (!targetPopup?.isOpen()) return;
      const popupEl = targetPopup.getElement();
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
        };
      }
      return null;
    }

    function openStackedPopupIfNeeded(coords: [number, number], selectedIndex = -1) {
      const key = poiCoordKey(Number(coords[0]), Number(coords[1]));
      const stack = sortStackedPoiFeatures(poiCoordIndexRef.current.get(key) || []);
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
        .map((feature, index) => {
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
              : hasStreamingAccessRef.current && info.cameraId
              ? `<button type="button" class="cameraPopupStreamLink stackPopupStreamLink" data-camera-stream data-camera-id="${escapeHtml(
                  info.cameraId
                )}" data-camera-duration="0">Abrir streaming</button>`
              : "";

          return `
            <div class="stackPopupItem ${kindItemCardClass[info.kind]}${index === selectedIndex ? " stackPopupItemSelected" : ""}" style="--equipment-accent:${visual.accent};">
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

      bindPopupCloseButton();
      bindSmartCameraPopupActions();
      centerMobilePopup();
      if (selectedIndex >= 0) {
        const list = popup?.getElement()?.querySelector<HTMLElement>(".stackPopupList");
        const selected = list?.querySelector<HTMLElement>(".stackPopupItemSelected");
        if (list && selected) list.scrollTop = selected.offsetTop - list.offsetTop;
      }
      return true;
    }

    function showStackCircle(e: mapboxgl.MapLayerMouseEvent, fromTap = false): boolean {
      const mobile = isMobileRef.current;
      if (areaDrawModeRef.current) return false;
      if (!fromTap && (mobile || !window.matchMedia("(hover: hover)").matches)) return false;
      const feature = e.features?.[0];
      if (feature?.geometry?.type !== "Point") return false;
      const coords = feature.geometry.coordinates as [number, number];
      const key = poiCoordKey(coords[0], coords[1]);
      if (stackCircleKeyRef.current === key) return true;
      const activeCenter = stackCircleCenterRef.current;
      if (activeCenter && !fromTap) {
        const centerPoint = map.project(activeCenter);
        if (Math.hypot(e.point.x - centerPoint.x, e.point.y - centerPoint.y) <= stackCircleRadiusRef.current + 44) return true;
      }

      clearStackCircle();
      const stack = sortStackedPoiFeatures(poiCoordIndexRef.current.get(key) || []);
      if (stack.length <= 1) return false;

      hideHoverPreview();
      const radius = Math.max(50, (stack.length * 56) / (2 * Math.PI));
      stackCircleKeyRef.current = key;
      stackCircleCenterRef.current = coords;
      stackCircleRadiusRef.current = radius;
      for (const layerId of [LAYERS.cameras_points, LAYERS.cameras_intel_points, LAYERS.cameras_lpr_points, LAYERS.radares_points]) {
        if (!map.getLayer(layerId)) continue;
        stackCircleLayerOpacityRef.current.push({ layerId, opacity: map.getPaintProperty(layerId, "icon-opacity") });
        map.setPaintProperty(layerId, "icon-opacity", 0.2);
      }

      const extent = radius + 28;
      const connections = document.createElement("div");
      connections.className = "stackCircleConnections";
      connections.style.width = `${2 * extent}px`;
      connections.style.height = connections.style.width;
      connections.setAttribute("aria-hidden", "true");
      const svgNamespace = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNamespace, "svg");
      svg.setAttribute("viewBox", `${-extent} ${-extent} ${2 * extent} ${2 * extent}`);
      svg.setAttribute("focusable", "false");
      connections.appendChild(svg);
      stackCircleConnectionsRef.current = new mapboxgl.Marker({ element: connections, anchor: "center" })
        .setLngLat(coords)
        .addTo(map);
      const spokes: Array<{ halo: SVGLineElement; line: SVGLineElement; angle: number; length: number }> = [];
      const previewPopupAnchors: PreviewPopupAnchor[] = [
        "bottom", "bottom-left", "left", "top-left",
        "top", "top-right", "right", "bottom-right",
      ];

      stackCircleMarkersRef.current = stack.map((item, index) => {
        const kind = asPoiKind(item.properties?.kind);
        const info = getPoiInfo(item);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "stackCircleMarker";
        const accent = kind ? getPoiVisual(kind).accent : "#64748b";
        const iconSize = kind ? POI_MARKER_PIXEL_SIZES[kind] : 24;
        button.style.setProperty("--equipment-accent", accent);
        button.style.setProperty("--equipment-icon-size", `${iconSize}px`);
        const label = getPointCollectionCode(item.properties) || info?.title || `Aparelho ${index + 1}`;
        const accessibleLabel = `${info?.title || "Equipamento"} · ${label}`;
        button.setAttribute("aria-label", accessibleLabel);
        if (kind !== "camera" && kind !== "camera_intel") button.title = accessibleLabel;

        const icon = document.createElement("img");
        icon.className = "stackCircleMarkerIcon";
        icon.alt = "";
        icon.draggable = false;
        if (kind) {
          icon.src = getPoiIconSource(mapBaseStyleRef.current, kind);
        }
        button.appendChild(icon);

        const spoke = document.createElementNS(svgNamespace, "g");
        spoke.classList.add("stackCircleSpoke");
        spoke.style.setProperty("--equipment-accent", accent);
        const halo = document.createElementNS(svgNamespace, "line");
        halo.classList.add("stackCircleSpokeHalo");
        const line = document.createElementNS(svgNamespace, "line");
        line.classList.add("stackCircleSpokeLine");
        spoke.append(halo, line);
        svg.appendChild(spoke);
        spokes.push({ halo, line, angle: -Math.PI / 2 + (2 * Math.PI * index) / stack.length, length: radius - iconSize / 2 - 4 });
        let pointerOver = false;
        let focused = false;
        const updateSpokeHighlight = () => spoke.classList.toggle("stackCircleSpokeActive", pointerOver || focused);
        button.addEventListener("mouseenter", () => { pointerOver = true; updateSpokeHighlight(); });
        button.addEventListener("mouseleave", () => {
          if (stackPreviewLockedMarkerRef.current === button) return;
          pointerOver = false;
          updateSpokeHighlight();
        });
        button.addEventListener("focus", () => { focused = true; updateSpokeHighlight(); });
        button.addEventListener("blur", () => { focused = false; updateSpokeHighlight(); });

        const code = document.createElement("span");
        code.className = "stackCircleMarkerCode";
        code.textContent = label;
        button.appendChild(code);
        if (kind === "camera" || kind === "camera_intel") {
          const angle = spokes[index].angle;
          const previewPopupAnchor = previewPopupAnchors[Math.round((angle + Math.PI / 2) / (Math.PI / 4)) % 8];
          button.addEventListener("mouseenter", () => {
            if (isMobileRef.current) return;
            if (stackPreviewLockedMarkerRef.current === button) {
              stackPreviewLockedMarkerRef.current = null;
              return;
            }
            releaseStackPreviewPointerLock();
            hideHoverPreview();
            const markerRect = button.getBoundingClientRect();
            const mapRect = map.getContainer().getBoundingClientRect();
            const point = {
              x: markerRect.left + markerRect.width / 2 - mapRect.left,
              y: markerRect.top + markerRect.height / 2 - mapRect.top,
            };
            const anchor = map.unproject([point.x, point.y]).toArray() as [number, number];
            const previewEvent = { features: [item], point };
            if (kind === "camera") showCommonCameraHoverPreview(previewEvent, true, anchor, previewPopupAnchor, button);
            else showSmartCameraHoverPreview(previewEvent, true, anchor, previewPopupAnchor, button);
          });
          button.addEventListener("mouseleave", () => {
            if (stackPreviewLockedMarkerRef.current !== button && !stackPreviewPanActiveRef.current) hideHoverPreview();
          });
        } else {
          button.addEventListener("mouseenter", () => {
            if (!stackPreviewLockedMarkerRef.current) return;
            releaseStackPreviewPointerLock();
            hideHoverPreview();
          });
        }
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          stackPreviewLockedMarkerRef.current = null;
          hideHoverPreview();
          setSelectionRing(coords[0], coords[1]);
          openStackedPopupIfNeeded(coords, index);
        });

        const marker = new mapboxgl.Marker({ element: button, anchor: "center", offset: [0, 0] })
          .setLngLat(coords)
          .addTo(map);
        return marker;
      });

      const origin = document.createElementNS(svgNamespace, "circle");
      origin.classList.add("stackCircleOrigin");
      origin.setAttribute("r", "3.5");
      svg.appendChild(origin);

      const setCircleProgress = (progress: number) => {
        svg.style.opacity = String(progress);
        stackCircleMarkersRef.current.forEach((marker, index) => {
          const { halo, line, angle, length } = spokes[index];
          const x = Math.cos(angle);
          const y = Math.sin(angle);
          for (const segment of [halo, line]) {
            segment.setAttribute("x2", String(x * length * progress));
            segment.setAttribute("y2", String(y * length * progress));
          }
          marker.setOffset([
            x * radius * progress,
            y * radius * progress,
          ]);
        });
      };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setCircleProgress(1);
      } else {
        const animation = stackCircleAnimationRef.current;
        const duration = 260;
        let startedAt: number | null = null;
        const animate = (now: number) => {
          if (stackCircleAnimationRef.current !== animation) return;
          if (startedAt === null) startedAt = now;
          const elapsed = Math.min((now - startedAt) / duration, 1);
          const progress = 1 - Math.pow(1 - elapsed, 3);
          setCircleProgress(progress);
          if (elapsed < 1) window.requestAnimationFrame(animate);
        };
        window.requestAnimationFrame(animate);
      }
      return true;
    }

    const handledMobileStackTaps = new WeakSet<Event>();
    function handleMobileStackTap(e: mapboxgl.MapLayerMouseEvent): boolean {
      if (!isMobileRef.current) return false;
      if (suppressNextMapClickRef.current || areaDrawModeRef.current) return true;
      if (handledMobileStackTaps.has(e.originalEvent)) return true;
      const expanded = showStackCircle(e, true);
      if (expanded) handledMobileStackTaps.add(e.originalEvent);
      return expanded;
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

    const hideClusterSummary = () => setHoveredCluster(null);
    const showClusterSummary = (event: mapboxgl.MapLayerMouseEvent) => {
      const properties = event.features?.[0]?.properties;
      if (areaDrawModeRef.current || map.isMoving() || !properties) {
        hideClusterSummary();
        return;
      }
      const id = Number(properties.cluster_id);
      setHoveredCluster((current) => current?.id === id ? current : {
        id,
        counts: {
          camera: Number(properties.camera) || 0,
          camera_intel: Number(properties.camera_intel) || 0,
          camera_lpr: Number(properties.camera_lpr) || 0,
          radar: Number(properties.radar) || 0,
        },
      });
    };
    map.on("mouseenter", LAYERS.clusters, showClusterSummary);
    map.on("mousemove", LAYERS.clusters, showClusterSummary);
    map.on("mouseleave", LAYERS.clusters, hideClusterSummary);
    map.on("mouseout", hideClusterSummary);
    map.on("movestart", hideClusterSummary);

    for (const lid of [LAYERS.cameras_points, LAYERS.cameras_intel_points, LAYERS.cameras_lpr_points, LAYERS.radares_points]) {
      map.on("mouseenter", lid, showStackCircle);
    }
    map.on("mousemove", (e) => {
      const center = stackCircleCenterRef.current;
      if (isMobileRef.current || !center || stackPreviewPanActiveRef.current) return;
      if (stackPreviewLockedMarkerRef.current) {
        if (hoverPreviewPopupRef.current?.isOpen()) return;
        releaseStackPreviewPointerLock();
      }
      const point = map.project(center);
      const distance = Math.hypot(e.point.x - point.x, e.point.y - point.y);
      if (distance > stackCircleRadiusRef.current + 44) clearStackCircle();
    });
    map.on("movestart", () => {
      if (!stackPreviewPanActiveRef.current) clearStackCircle();
    });
    const handleStackPointerLeave = (event: PointerEvent) => {
      if (isMobileRef.current || event.pointerType === "touch") return;
      clearStackCircle();
    };
    map.getContainer().addEventListener("pointerleave", handleStackPointerLeave);
    stackCirclePointerLeaveRef.current = handleStackPointerLeave;

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

    function showCommonCameraHoverPreview(
      e: { features?: readonly unknown[]; point?: { y: number } },
      fromStack = false,
      previewAnchor?: [number, number],
      stackPopupAnchor?: PreviewPopupAnchor,
      stackButton?: HTMLButtonElement
    ) {
      if (isMobileRef.current) return;
      if (stackCircleKeyRef.current && !fromStack) return;
      setCursorPointer();
      clearHoverPreviewTimer();
      clearHoverPreviewCloseTimer();
      clearHoverPreviewCountdownTimer();
      const f: any = e.features?.[0];
      if (!f) return;
      const coords = (f.geometry as any).coordinates as [number, number];
      if (!fromStack && (poiCoordIndexRef.current.get(poiCoordKey(coords[0], coords[1])) || []).length > 1) return;
      const anchor = previewAnchor ?? coords;
      if (!hasStreamingAccessRef.current) return;

      const p = f.properties || {};
      const cameraId = cleanString(p.camera_id || p.id);
      if (!cameraId) return;
      const requestGeneration = hoverPreviewGenerationRef.current;
      const pointY = e.point?.y ?? map.project({ lng: anchor[0], lat: anchor[1] }).y;
      const placement = getHoverPreviewPlacement(anchor, pointY, stackPopupAnchor);
      const hoverPreviewPopup = ensureHoverPreviewPopup(placement.anchor);
      panStackPreviewIntoView(anchor, placement.panY, stackButton);
      const playerAspectRatio = 16 / 9;
      // O player da Tixxi confunde iframes menores que a janela com DevTools aberto
      // e apaga o próprio vídeo. Mantemos um viewport interno do tamanho da tela e
      // o reduzimos apenas visualmente para caber no preview.
      const playerViewportWidth = Math.ceil(
        Math.max(
          1600,
          window.outerWidth || 0,
          window.screen?.width || 0,
          (window.outerHeight || 0) * playerAspectRatio,
          (window.screen?.height || 0) * playerAspectRatio
        )
      );
      const playerViewportHeight = Math.ceil(playerViewportWidth / playerAspectRatio);
      const playerPreviewScale = 360 / playerViewportWidth;

      hoverPreviewTimerRef.current = window.setTimeout(async () => {
        hoverPreviewPopup
          ?.setLngLat(placement.position)
          .setOffset(placement.offset)
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
          let session: Awaited<ReturnType<typeof requestCommonCameraSession>>;
          try {
            session = await requestCommonCameraSession(cameraId, SMART_CAMERA_PREVIEW_DURATION_SECONDS);
          } catch (error) {
            if (!shouldRetryCommonCameraSession(error)) throw error;
            session = await requestCommonCameraSession(cameraId, SMART_CAMERA_PREVIEW_DURATION_SECONDS);
          }
          if (requestGeneration !== hoverPreviewGenerationRef.current) return;

          hoverPreviewPopup
            ?.setLngLat(placement.position)
            .setOffset(placement.offset)
            .setHTML(`
              <div style="width:360px;background:#000;">
                <div style="width:360px;height:203px;overflow:hidden;position:relative;background:#000;">
                  <iframe
                    src="${escapeHtml(session.sessionUrl)}"
                    title="Preview streaming"
                    loading="lazy"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowfullscreen
                    referrerpolicy="no-referrer"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    scrolling="no"
                    style="position:absolute;top:0;left:0;width:${playerViewportWidth}px;height:${playerViewportHeight}px;border:0;background:#000;transform:scale(${playerPreviewScale});transform-origin:top left;"
                  ></iframe>
                  <div class="smartPreviewCountdown" data-smart-preview-countdown>
                    ${SMART_CAMERA_PREVIEW_DURATION_SECONDS}s
                  </div>
                </div>
                <div style="padding:6px 8px;color:#fff;font-size:11px;line-height:1.3;opacity:.92;">
                  Para abrir o streaming maior, clique na c&acirc;mera e abra o link.
                </div>
              </div>
          `)
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
          clearHoverPreviewCountdownTimer();
          hoverPreviewPopup
            ?.setLngLat(placement.position)
            .setOffset(placement.offset)
            .setHTML(`
              <div style="width:360px;background:#000;">
                <div style="width:360px;height:203px;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-size:13px;line-height:1.5;text-align:center;padding:20px;box-sizing:border-box;">
                  Streaming indispon&iacute;vel. Tente abrir o streaming pela lista ou pela pop-up da câmera.
                </div>
              </div>
            `)
            .addTo(map);
        }
      }, 120);
    }

    map.on("mouseenter", LAYERS.cameras_points, showCommonCameraHoverPreview);

    map.on("mouseleave", LAYERS.cameras_points, () => {
      setCursorDefault();
      if (!stackCircleKeyRef.current) hideHoverPreview();
    });

    function showSmartCameraHoverPreview(
      e: { features?: readonly unknown[]; point?: { y: number } },
      fromStack = false,
      previewAnchor?: [number, number],
      stackPopupAnchor?: PreviewPopupAnchor,
      stackButton?: HTMLButtonElement
    ) {
      if (isMobileRef.current) return;
      if (stackCircleKeyRef.current && !fromStack) return;
      clearHoverPreviewTimer();
      clearHoverPreviewCloseTimer();
      clearHoverPreviewCountdownTimer();
      setCursorPointer();

      const f: any = e.features?.[0];
      if (!f) return;
      const coords = (f.geometry as any).coordinates as [number, number];
      if (!fromStack && (poiCoordIndexRef.current.get(poiCoordKey(coords[0], coords[1])) || []).length > 1) return;
      const anchor = previewAnchor ?? coords;
      if (!hasSmartCameraStreamingAccessRef.current) return;

      const p = f.properties || {};
      const smartId = cleanString(p.id);
      if (!smartId) return;
      if (isSmartCameraStreamingUnavailable(smartId)) return;

      const pointY = e.point?.y ?? map.project({ lng: anchor[0], lat: anchor[1] }).y;
      const placement = getHoverPreviewPlacement(anchor, pointY, stackPopupAnchor);
      const hoverPreviewPopup = ensureHoverPreviewPopup(placement.anchor);
      panStackPreviewIntoView(anchor, placement.panY, stackButton);
      const requestGeneration = hoverPreviewGenerationRef.current;

      hoverPreviewTimerRef.current = window.setTimeout(async () => {
        hoverPreviewPopup
          ?.setLngLat(placement.position)
          .setOffset(placement.offset)
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

          if (!isHttpsUrl(session.sessionUrl)) {
            clearHoverPreviewCountdownTimer();
            hoverPreviewPopup
              ?.setLngLat(placement.position)
              .setOffset(placement.offset)
              .setHTML(`
                <div style="width:360px;background:#000;">
                  <div style="width:360px;height:203px;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-size:13px;line-height:1.5;text-align:center;padding:20px;box-sizing:border-box;">
                    Preview indispon&iacute;vel. Clique na c&acirc;mera e abra o streaming.
                  </div>
                </div>
              `)
              .addTo(map);
            centerMobilePopup(hoverPreviewPopup);
            return;
          }

          hoverPreviewPopup
            ?.setLngLat(placement.position)
            .setOffset(placement.offset)
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
              ?.setLngLat(placement.position)
              .setOffset(placement.offset)
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
            ?.setLngLat(placement.position)
            .setOffset(placement.offset)
            .setHTML(`
              <div style="width:360px;background:#000;">
                <div style="width:360px;height:203px;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-size:13px;line-height:1.5;text-align:center;padding:20px;box-sizing:border-box;">
                  Streaming indispon&iacute;vel. Para acessar mais informa&ccedil;&otilde;es, clique na c&acirc;mera.
                </div>
              </div>
            `)
            .addTo(map);
          await showStreamingAlert({
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
      if (!stackCircleKeyRef.current) hideHoverPreview();
    });

    map.on("click", LAYERS.clusters, (e) => {
      if (areaDrawModeRef.current || suppressNextMapClickRef.current) return;
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
      if (handleMobileStackTap(e)) return;
      hideHoverPreview();
      const f: any = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const coords = (f.geometry as any).coordinates as [number, number];
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
              ${allowStreaming && cleanString(p.camera_id || p.id)
                ? `<button type="button" class="cameraPopupStreamLink" data-camera-stream data-camera-id="${escapeHtml(
                    cleanString(p.camera_id || p.id)
                  )}" data-camera-duration="0">Abrir streaming</button>`
                : ""}
            </div>
          </div>
        `)
        .addTo(map);
      bindPopupCloseButton();
      bindSmartCameraPopupActions();
      if (allowStreaming) centerMobilePopup();
    });

    map.on("click", LAYERS.cameras_intel_points, (e) => {
      if (handleMobileStackTap(e)) return;
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
      if (handleMobileStackTap(e)) return;
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
      if (handleMobileStackTap(e)) return;
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
      releaseStackPreviewPointerLock();
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
        clearStackCircle();
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

    if (authLoading || !accessToken || !showBairros || bairrosGeo) {
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
  }, [accessToken, authLoading, canViewBairros, showBairros, bairrosGeo]);

  useEffect(() => {
    if (!canViewRisp) {
      setRispGeo(null);
      return;
    }

    if (!showRisp || rispGeo) return;

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
  }, [canViewRisp, showRisp, rispGeo]);

  useEffect(() => {
    if (!canViewAisp) {
      setAispGeo(null);
      return;
    }

    if (!showAisp || aispGeo) return;

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
  }, [canViewAisp, showAisp, aispGeo]);

  useEffect(() => {
    if (!canViewCisp) {
      setCispGeo(null);
      return;
    }

    if (!showCisp || cispGeo) return;

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
  }, [canViewCisp, showCisp, cispGeo]);

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
      if (stackCirclePointerLeaveRef.current) {
        map.getContainer().removeEventListener("pointerleave", stackCirclePointerLeaveRef.current);
        stackCirclePointerLeaveRef.current = null;
      }
      clearStackCircle();
      popupRef.current?.remove();
      popupRef.current = null;
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;
      // These timer refs retain the stable identity created inside useMapSearch.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (automaticSearchTimerRef.current) window.clearTimeout(automaticSearchTimerRef.current);
      searchGenerationRef.current += 1;
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

  useEffect(() => {
    if (!searchEquipmentPoint) return;
    const map = mapRef.current;
    if (!map) return;

    let zoomAtStart: number | null = null;
    const updateViewport = () => {
      if (addressSearchFlyPendingRef.current) return;
      setSearchEquipmentViewport(map.getBounds());
    };
    const handleMoveEnd = () => {
      addressSearchFlyPendingRef.current = false;
      updateViewport();
    };
    const handleZoomStart = () => {
      zoomAtStart = map.getZoom();
    };
    const handleZoomEnd = () => {
      if (!addressSearchFlyPendingRef.current && zoomAtStart !== null && map.getZoom() < zoomAtStart - 0.01) {
        closeSearchEquipmentResults();
      }
      zoomAtStart = null;
    };

    map.on("moveend", handleMoveEnd);
    map.on("resize", updateViewport);
    map.on("zoomstart", handleZoomStart);
    map.on("zoomend", handleZoomEnd);
    if (!addressSearchFlyPendingRef.current) updateViewport();

    return () => {
      map.off("moveend", handleMoveEnd);
      map.off("resize", updateViewport);
      map.off("zoomstart", handleZoomStart);
      map.off("zoomend", handleZoomEnd);
    };
    // The search refs/setters, including those used by closeSearchEquipmentResults, are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchEquipmentPoint]);

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

  function clearAreaDrawing() {
    areaDrawPointsRef.current = [];
    areaDrawPolygonsRef.current = [];
    setAreaDrawPoints([]);
    setAreaDrawPolygons([]);
    setAreaReportMsg(null);
  }

  function toggleAreaDrawing() {
    if (!canUseAreaDraw) return;
    if (areaDrawMode) {
      clearAreaDrawing();
      setAreaDrawMode(false);
      setAreaDrawAwaitingStart(false);
      setAreaDrawMinimized(false);
      setAreaToolsOpen(false);
      return;
    }
    setAreaToolsOpen(true);
    setAreaDrawMode(true);
    setAreaDrawAwaitingStart(true);
    setAreaDrawMinimized(false);
    setAreaReportMsg(null);
  }

  function closeBairroSearch() {
    setShowBairros(false);
    setBairroIntroOpen(false);
    setBairroSearchMinimized(false);
    setSelectedBairro("");
    setBairroQuery("");
    setBairroReportMsg(null);
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

  const cameraFeatures = useMemo(() => camerasToFeatures(cameras), [cameras]);
  const cameraIntelFeatures = useMemo(() => camerasIntelToFeatures(camerasIntel), [camerasIntel]);
  const cameraLprFeatures = useMemo(() => camerasLprToFeatures(camerasLpr), [camerasLpr]);
  const radarFeatures = useMemo(() => radaresToFeatures(radares), [radares]);
  const poisGeo = useMemo<FeatureCollection<Point, any>>(
    () => ({
      type: "FeatureCollection",
      features: [
        ...(showCameras ? cameraFeatures : []),
        ...(showCamerasIntel ? cameraIntelFeatures : []),
        ...(showCamerasLpr ? cameraLprFeatures : []),
        ...(showRadares ? radarFeatures : []),
      ],
    }),
    [cameraFeatures, cameraIntelFeatures, cameraLprFeatures, radarFeatures,
      showCameras, showCamerasIntel, showCamerasLpr, showRadares]
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
    clearStackCircle();
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
    // isStyleLoaded() also becomes false while sources process setData().
    // An existing source accepts the next response immediately; "load" only fires once.
    if (map.getSource(SOURCES.pois)) {
      updatePoisData(map, poisGeo);
      return;
    }

    const handleStyleLoad = () => {
      updatePoisData(map, poisGeo);
    };
    map.once("style.load", handleStyleLoad);
    return () => {
      map.off("style.load", handleStyleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poisGeo]);

  useEffect(() => {
    if (cinematicModeRef.current === cinematicMode) return;
    cinematicModeRef.current = cinematicMode;
    const map = mapRef.current;
    if (!map || !map.getSource(SOURCES.pois)) return;

    for (const layerId of POI_LAYER_IDS) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    if (map.getSource(SOURCES.pois)) map.removeSource(SOURCES.pois);
    ensureSourcesAndLayers(map);
    updatePoisData(map, poisGeo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cinematicMode]);

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
    map.getCanvas().style.cursor = areaDrawMode && !areaDrawAwaitingStart && !areaDrawMinimized ? "crosshair" : "";
    return () => {
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
    };
  }, [areaDrawMode, areaDrawAwaitingStart, areaDrawMinimized]);

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

  const nearbySearchEquipment = useMemo(() => {
    if (!searchEquipmentPoint || !searchEquipmentViewport) return [];
    const { lng, lat } = searchEquipmentPoint;
    const distance = (item: any) => {
      const itemLat = getLat(item);
      const itemLng = getLng(item);
      if (itemLat == null || itemLng == null) return Infinity;
      const dLat = (itemLat - lat) * 111_000;
      const dLng = (itemLng - lng) * 111_000 * Math.cos((lat * Math.PI) / 180);
      return Math.sqrt(dLat * dLat + dLng * dLng);
    };
    const groups = [
      ...(showCameras ? cameras.map((item: any) => ({ item, kind: "Câmera" })) : []),
      ...(showCamerasIntel ? camerasIntel.map((item: any) => ({ item, kind: "Super Câmera" })) : []),
      ...(showCamerasLpr ? camerasLpr.map((item: any) => ({ item, kind: "LPR" })) : []),
      ...(showRadares ? radares.map((item: any) => ({ item, kind: "Radar" })) : []),
    ];
    return groups
      .map((entry) => ({ ...entry, meters: distance(entry.item) }))
      .filter((entry) => {
        const itemLng = getLng(entry.item);
        const itemLat = getLat(entry.item);
        return itemLng != null && itemLat != null && searchEquipmentViewport.contains([itemLng, itemLat]);
      })
      .sort((a, b) => a.meters - b.meters);
  }, [searchEquipmentPoint, searchEquipmentViewport, cameras, camerasIntel, camerasLpr, radares, showCameras, showCamerasIntel, showCamerasLpr, showRadares]);

  const displayedSearchEquipment = searchEquipmentPoint ? nearbySearchEquipment : searchedEquipment;
  const visibleSearchEquipment = searchEquipmentPoint
    ? displayedSearchEquipment
    : displayedSearchEquipment.slice(0, nearbyVisibleCount);

  useEffect(() => {
    setNearbyVisibleCount(7);
    // useMapSearch returns the original stable React state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchEquipmentPoint, searchedEquipment]);

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
    if (!mobileSearchOpen) setMobileSearchFocused(false);
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

  const panelWidth = 560;
  const panelSideInset = 82;
  const panelShiftRight = 0;
  const panelMaxHeight = "56vh";
  const equipmentVisual = getPoiVisual(
    listMode === "inteligentes" ? "camera_intel"
      : listMode === "lpr" ? "camera_lpr"
      : listMode === "radares" ? "radar" : "camera"
  );
  const equipmentListStyle = {
    "--equipment-accent": equipmentVisual.accent,
    "--equipment-hover-border": equipmentVisual.border,
    display: "grid",
    gap: 10,
    maxHeight: panelMaxHeight,
    overflow: "auto",
  } as CSSProperties;
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

  const { downloadReportFile, waitForReportCompletion } = createReportDownloads(accessToken);

  const {
    markSmartCameraStreamingUnavailable,
    isSmartCameraStreamingUnavailable,
    requestSmartCameraSession,
    requestCommonCameraSession,
    openSmartCameraStreamWindow,
    openCommonCameraStreamWindow,
  } = createCameraStreaming({
    accessToken, hasStreamingAccessRef, hasSmartCameraStreamingAccessRef,
    unavailableSmartCameraIdsRef, setUnavailableSmartCameraIds,
  });

  const { ensureSourcesAndLayers } = createMapLayers({
    mapBaseStyleRef, cinematicModeRef, rispColorExpr, aispColorExpr, cispColorExpr,
  });

  const mobileLayersVisible = dockOpen && !panelOpen && !mobileMenuOpen && !mobileSearchOpen;
  const gpsCenterVisible = canUseGps && gpsOn && !dockOpen && !panelOpen && !mobileMenuOpen && !mobileSearchOpen;
  const activeLayerPanelOpen = !isMobile && (panel === "map" || panel === "profile");

  return (
    <div className={`mapRoot ${panelOpen || mobileMenuOpen ? "menuOpen" : ""}`}>
      <div
        ref={mapContainerRef}
        className="mapCanvas"
        onClick={() => {
          if (panel !== null) setPanel(null);
          if (panelOpen) setPanelOpen(false);
          if (mobileMenuOpen) setMobileMenuOpen(false);
          if (mobileSearchOpen) setMobileSearchOpen(false);
        }}
      />

      {hoveredCluster && !areaDrawMode && !cinematicMode && (
        <ClusterSummary counts={hoveredCluster.counts} />
      )}

      {canViewBairros && showBairros && bairroIntroOpen && (
        <div className="areaDrawIntroBackdrop">
          <div className="areaDrawIntro" role="dialog" aria-modal="true" aria-labelledby="bairroIntroTitle">
            <div className="areaDrawIntroArt bairroIntroArt" aria-hidden="true">
              <Building2 size={86} strokeWidth={1.2} />
            </div>
            <h2 id="bairroIntroTitle">Explore os bairros no mapa</h2>
            <p>Busque um bairro pelo nome ou selecione sua área no mapa. O contorno será destacado.</p>
            <button type="button" className="areaDrawIntroStart" onClick={() => { setBairroIntroOpen(false); if (areaDrawMode) setAreaDrawMinimized(true); }}>
              Buscar bairro
            </button>
            <button type="button" className="areaDrawIntroCancel" onClick={() => { setShowBairros(false); setBairroIntroOpen(false); }}>Cancelar</button>
          </div>
        </div>
      )}

      {canUseAreaDraw && areaDrawMode && areaDrawAwaitingStart && (
        <div className="areaDrawIntroBackdrop">
          <div className="areaDrawIntro" role="dialog" aria-modal="true" aria-labelledby="areaDrawIntroTitle">
            <div className="areaDrawIntroArt" aria-hidden="true">
              <svg viewBox="0 0 280 160">
                <path className="areaDrawIntroShape" d="M38 54 181 26 245 102 109 136Z" />
                <path className="areaDrawIntroPending" d="M109 136 38 54" />
                <circle cx="38" cy="54" r="6" /><circle cx="181" cy="26" r="6" />
                <circle cx="245" cy="102" r="6" /><circle cx="109" cy="136" r="6" />
              </svg>
            </div>
            <h2 id="areaDrawIntroTitle">Desenhe uma ou mais áreas no mapa</h2>
            <p>Clique em 3 ou mais pontos para formar uma área. Use “Novo polígono” para desenhar outra, “Desfazer ponto” para corrigir e “Baixar PDF” para gerar o relatório.</p>
            <button type="button" className="areaDrawIntroStart" onClick={() => { setAreaDrawAwaitingStart(false); if (showBairros) setBairroSearchMinimized(true); }}>
              Começar desenho
            </button>
            <button type="button" className="areaDrawIntroCancel" onClick={toggleAreaDrawing}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="mapTaskPanels">
      {canUseAreaDraw && areaDrawMode && !areaDrawAwaitingStart && areaDrawMinimized && (
        <div className="mapTaskRestore">
          <button type="button" className="areaDrawRestore" onClick={() => { setAreaDrawMinimized(false); if (showBairros) setBairroSearchMinimized(true); }}>
            <PenTool size={16} aria-hidden="true" />
            Desenhar área
          </button>
          <button type="button" className="mapTaskRestoreClose" onClick={toggleAreaDrawing} aria-label="Desativar desenho de área" title="Desativar desenho de área">
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}

      {canUseAreaDraw && areaDrawMode && !areaDrawAwaitingStart && !areaDrawMinimized && (
        <div className="areaDrawToolbar" aria-label="Ferramentas de desenho">
          <div className="areaDrawToolbarHeader">
            <div>
              <strong>Desenhar área</strong>
              <span>{areaDrawPoints.length} ponto(s) em edição · {areaDrawPolygons.length} polígono(s)</span>
            </div>
            <div className="mapTaskPanelHeaderActions">
              <button type="button" onClick={() => setAreaDrawMinimized(true)} title="Minimizar desenho">Minimizar</button>
              <button type="button" onClick={toggleAreaDrawing} title="Parar desenho">Parar</button>
            </div>
          </div>
          <div className="areaDrawToolbarActions">
            <button type="button" onClick={removeLastAreaPoint} disabled={areaDrawPoints.length === 0 || areaReportLoading}>Desfazer ponto</button>
            <button type="button" onClick={finalizeCurrentAreaPolygon} disabled={areaDrawPoints.length < 3 || areaReportLoading}>Novo polígono</button>
            <button type="button" onClick={clearAreaDrawing} disabled={(areaDrawPoints.length === 0 && areaDrawPolygons.length === 0) || areaReportLoading}>Limpar tudo</button>
            <button type="button" className="areaDrawToolbarDownload" onClick={downloadAreaReport} disabled={!canRequestAreaReport || totalAreaPolygonCount === 0 || areaReportLoading}>
              {areaReportLoading ? "Gerando..." : "Baixar PDF"}
            </button>
          </div>
          {areaReportMsg && <p className="areaDrawToolbarMessage" role="status">{areaReportMsg}</p>}
          {!canRequestAreaReport && <p className="areaDrawToolbarMessage">Ative uma camada autorizada para gerar o PDF.</p>}
        </div>
      )}

      {canViewBairros && showBairros && !bairroIntroOpen && bairroSearchMinimized && (
        <div className="mapTaskRestore">
          <button
            type="button"
            className="bairroSearchRestore"
            onClick={() => { setBairroSearchMinimized(false); if (areaDrawMode) setAreaDrawMinimized(true); }}
          >
            <Building2 size={16} aria-hidden="true" />
            Buscar bairro
          </button>
          <button type="button" className="mapTaskRestoreClose" onClick={closeBairroSearch} aria-label="Desativar filtro de bairros" title="Desativar filtro de bairros">
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}

      {canViewBairros && showBairros && !bairroIntroOpen && !bairroSearchMinimized && (
        <div className="bairroSearchToolbar" aria-label="Buscar bairro no mapa">
          <div className="areaDrawToolbarHeader">
            <div>
              <strong>Buscar bairro</strong>
              <span>{selectedBairro || "Selecione um bairro no mapa ou na lista"}</span>
            </div>
            <button type="button" onClick={() => setBairroSearchMinimized(true)} title="Minimizar busca de bairros">Minimizar</button>
          </div>
          <input
            className="bairroSearchInput"
            type="search"
            value={bairroQuery}
            onChange={(e) => setBairroQuery(e.target.value)}
            placeholder="Digite o nome do bairro"
            aria-label="Nome do bairro"
          />
          <div className="bairroSearchResults">
            <button type="button" className={!selectedBairro ? "bairroSearchResultSelected" : ""} onClick={() => { setSelectedBairro(""); setBairroQuery(""); }}>Todos os bairros</button>
            {bairrosFiltered.length === 0 && <p>Nenhum bairro encontrado.</p>}
            {bairrosFiltered.map((nome) => (
              <button type="button" key={nome} className={selectedBairro === nome ? "bairroSearchResultSelected" : ""} onClick={() => { setSelectedBairro(nome); setBairroQuery(""); }}>
                {nome}
              </button>
            ))}
          </div>
          {loadingBairros && <p className="areaDrawToolbarMessage">Carregando bairros...</p>}
          {bairrosErr && <p className="areaDrawToolbarMessage" role="alert">{bairrosErr}</p>}
          {!canExtractBairroData && selectedBairro && <p className="areaDrawToolbarMessage">Esta camada exibe somente o contorno do bairro.</p>}
        </div>
      )}

      </div>

      {(canViewCameras && showCameras || canViewCamerasIntel && showCamerasIntel || canViewCamerasLpr && showCamerasLpr || canViewRadares && showRadares || canViewCisp && showCisp || canViewRisp && showRisp || canViewAisp && showAisp) && (
        <div
          className={`mapActiveLayers ${activeLayerPanelOpen ? "mapActiveLayersWithPanel" : ""}`}
          style={activeLayerPanelOpen ? {
            "--map-active-panel-right": `calc(${panelSideInset}px + min(${panelWidth}px, calc(100vw - ${panelSideInset * 2}px)) + 16px)`,
          } as CSSProperties : undefined}
          aria-label="Camadas ativas"
        >
          {canViewCameras && showCameras && (
            <button type="button" className="mapActiveLayer mapActiveLayerEquipment" onClick={() => setShowCameras(false)} aria-label="Desativar câmeras">
              Câmeras <X size={16} aria-hidden="true" />
            </button>
          )}
          {canViewCamerasIntel && showCamerasIntel && (
            <button type="button" className="mapActiveLayer mapActiveLayerEquipment" onClick={() => setShowCamerasIntel(false)} aria-label="Desativar super câmeras inteligentes">
              Super Câmeras Inteligentes <X size={16} aria-hidden="true" />
            </button>
          )}
          {canViewCamerasLpr && showCamerasLpr && (
            <button type="button" className="mapActiveLayer mapActiveLayerEquipment" onClick={() => setShowCamerasLpr(false)} aria-label="Desativar LPR">
              LPR <X size={16} aria-hidden="true" />
            </button>
          )}
          {canViewRadares && showRadares && (
            <button type="button" className="mapActiveLayer mapActiveLayerEquipment" onClick={() => setShowRadares(false)} aria-label="Desativar radares">
              Radares <X size={16} aria-hidden="true" />
            </button>
          )}
          {canViewCisp && showCisp && (
            <button type="button" className="mapActiveLayer" onClick={() => setShowCisp(false)} aria-label="Desativar CISP">
              CISP <X size={16} aria-hidden="true" />
            </button>
          )}
          {canViewRisp && showRisp && (
            <button type="button" className="mapActiveLayer" onClick={() => setShowRisp(false)} aria-label="Desativar RISP">
              RISP <X size={16} aria-hidden="true" />
            </button>
          )}
          {canViewAisp && showAisp && (
            <button type="button" className="mapActiveLayer" onClick={() => setShowAisp(false)} aria-label="Desativar AISP">
              AISP <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div className="mobileMapBrandPill">
        <img src={atlasBrand} alt="Prefeitura do Rio e CIVITAS Rio" />
      </div>
      {isMobile && me?.id && (
        <NotificationCenter key={me.id} apiBase={API_BASE} token={accessToken} isMobile mobileMenuTarget={mobileNotificationMenuTarget} onOpen={() => setMobileMenuOpen(false)} />
      )}
      <button
        type="button"
        className={`mobileLayersToggle ${mobileLayersVisible ? "mobileLayersToggleActive" : ""} ${gpsCenterVisible ? "mobileLayersToggleWithGps" : ""}`}
        onClick={() => {
          setPanelOpen(false);
          setMobileMenuOpen(false);
          setMobileSearchOpen(false);
          setDockOpen((open) => panelOpen || mobileMenuOpen ? true : !open);
        }}
        aria-label={mobileLayersVisible ? "Fechar camadas" : "Abrir camadas"}
        aria-expanded={mobileLayersVisible}
        aria-controls="mapLayersPanel"
        title={mobileLayersVisible ? "Fechar camadas" : "Abrir camadas"}
      >
        <Layers size={18} strokeWidth={2.1} aria-hidden="true" />
      </button>

      {gpsCenterVisible && (
        <button
          type="button"
          className="gpsMapCenter"
          disabled={!gps || !!gpsErr}
          onClick={() => {
            if (!gps) return;
            flyToPoint(gps.lng, gps.lat, 16);
          }}
          aria-label={gps && !gpsErr ? "Centralizar no GPS" : "Centralizar no GPS (aguardando localização)"}
          title={gps && !gpsErr ? "Centralizar no GPS" : "Aguardando localização do GPS"}
        >
          <LocateFixed size={20} strokeWidth={2.1} aria-hidden="true" />
        </button>
      )}

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

      <div className="geometrySummaryWrap">
        {showBairros &&
          canExtractBairroData &&
          selectedBairro &&
          selectedBairroStats &&
          <GeometrySummaryCard isMobile={isMobile} hasAuthorizedReportLayers={hasAuthorizedReportLayers} {...{
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
          }} />}

        {selectedSecurityArea &&
          (selectedSecuritySummaryLoading || selectedSecurityStats) &&
          <GeometrySummaryCard isMobile={isMobile} hasAuthorizedReportLayers={hasAuthorizedReportLayers} {...{
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
          }} />}

      </div>

      {/* DOCK */}
      <div
        className={`dockWrap ${isMobile ? "dockWrapMobile" : "dockWrapDesktop"}`}
        style={
          isMobile
            ? {
                display: mobileMenuOpen ? "none" : undefined,
                flexDirection: "column",
                alignItems: "stretch",
              }
            : undefined
        }
      >
        {!dockOpen && !isMobile && (
          <button
            type="button"
            ref={dockHandleRef}
            className="dockHandle"
            title="Abrir camadas"
            aria-label="Abrir camadas"
            aria-expanded={false}
            aria-controls="mapLayersPanel"
            onClick={() => {
              setDockOpen(true);
              bumpDockAutoHide();
            }}
          >
            <Layers size={20} strokeWidth={2.1} aria-hidden="true" />
          </button>
        )}

        {dockOpen && (
          <>
            {!isMobile && (
              <button
                type="button"
                className="dockBackdrop"
                aria-label="Fechar camadas"
                onClick={() => setDockOpen(false)}
              />
            )}
            <div
              className="dock"
              ref={dockPanelRef}
              id="mapLayersPanel"
              onTouchStart={isMobile ? (event) => { touchStartYRef.current = event.touches[0]?.clientY ?? null; } : undefined}
              onTouchEnd={isMobile ? () => { touchStartYRef.current = null; } : undefined}
              onTouchMove={isMobile ? (event) => {
                const startY = touchStartYRef.current;
                if (startY === null) return;
                if (event.touches[0].clientY - startY > 70 && (dockPanelRef.current?.scrollTop ?? 0) <= 0) {
                  setDockOpen(false);
                  touchStartYRef.current = null;
                }
              } : undefined}
              role={!isMobile ? "dialog" : undefined}
              aria-modal={!isMobile ? true : undefined}
              aria-labelledby={!isMobile ? "desktopLayersTitle" : undefined}
            >
              {!isMobile && (
                <div className="dockDesktopHeader">
                  <h2 id="desktopLayersTitle">Camadas</h2>
                  <button
                    type="button"
                    ref={dockCloseRef}
                    className="dockDesktopClose"
                    onClick={() => setDockOpen(false)}
                    aria-label="Fechar camadas"
                    title="Fechar camadas"
                  >
                    <X size={20} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                </div>
              )}
              {isMobile && (
                <div className="dockMobileHeader">
                  <div className="mobileEquipmentDragHandle" aria-hidden="true"><span /></div>
                  <div className="mobileEquipmentHeader">
                    <div>
                      <span className="mobileEquipmentEyebrow">MAPA · VISUALIZAÇÃO</span>
                      <h2>Camadas</h2>
                      <p>Escolha o que aparece no mapa</p>
                    </div>
                    <button type="button" onClick={() => setDockOpen(false)} aria-label="Voltar ao mapa">Voltar ao mapa</button>
                  </div>
                </div>
              )}
              <div className="dockSectionLabel">Base do mapa</div>
              <div className="dockBase">
                <button
                  type="button"
                  role="switch"
                  aria-label="Visualização por satélite"
                  aria-checked={mapBaseStyle === "satellite"}
                  className={`dockBaseToggle ${mapBaseStyle === "satellite" ? "dockBaseToggleSatellite" : ""}`}
                  onClick={() => switchMapBaseStyle(mapBaseStyle === "streets" ? "satellite" : "streets")}
                >
                  <span className="dockBaseChoice">
                    <MapPinned size={15} strokeWidth={2.1} aria-hidden="true" />
                    Mapa
                  </span>
                  <span className="dockBaseChoice">
                    <Satellite size={15} strokeWidth={2.1} aria-hidden="true" />
                    Satélite
                  </span>
                </button>
              </div>

              <div className="dockDivider" />
              <div className="dockTitle">Camadas</div>

            {canViewCameras && (
              <button
                className={`dockChip ${showCameras ? "dockChipOn" : ""}`}
                role="switch"
                aria-checked={showCameras}
                onClick={() => {
                  setShowCameras((v) => !v);
                  bumpDockAutoHide();
                }}
                title={showCameras ? "Desativar Câmeras" : "Ativar Câmeras"}
              >
                <span className="chipLeft">
                  <span className="chipIcon">
                    <img src={cameraIcon} alt="" />
                  </span>
                  <span className="chipText">
                    <span>Câmeras</span>
                    <span className="chipLegend">Gravação de imagens</span>
                  </span>
                </span>
                <LayerToggle checked={showCameras} />
              </button>
            )}

            {canViewCamerasIntel && (
              <button
                className={`dockChip ${showCamerasIntel ? "dockChipOn" : ""}`}
                role="switch"
                aria-checked={showCamerasIntel}
                onClick={() => {
                  setShowCamerasIntel((v) => !v);
                  bumpDockAutoHide();
                }}
                title={showCamerasIntel ? "Desativar Super Câmeras Inteligentes" : "Ativar Super Câmeras Inteligentes"}
              >
                <span className="chipLeft">
                  <span className="chipIcon">
                    <img src={cameraIntelIcon} alt="" />
                  </span>
                  <span className="chipText">
                    <span>Super Câmeras Inteligentes</span>
                    <span className="chipLegend">Gravações e analíticos de IA</span>
                  </span>
                </span>
                <LayerToggle checked={showCamerasIntel} />
              </button>
            )}

            {canViewCamerasLpr && (
              <button
                className={`dockChip ${showCamerasLpr ? "dockChipOn" : ""}`}
                role="switch"
                aria-checked={showCamerasLpr}
                onClick={() => {
                  setShowCamerasLpr((v) => !v);
                  bumpDockAutoHide();
                }}
                title={showCamerasLpr ? "Desativar LPR" : "Ativar LPR"}
              >
                <span className="chipLeft">
                  <span className="chipIcon">
                    <img src={cameraLprIconSatellite} alt="" />
                  </span>
                  <span className="chipText">
                    <span>LPR</span>
                    <span className="chipLegend">Leitura de radar</span>
                  </span>
                </span>
                <LayerToggle checked={showCamerasLpr} />
              </button>
            )}

            {canViewRadares && (
              <button
                className={`dockChip ${showRadares ? "dockChipOn" : ""}`}
                role="switch"
                aria-checked={showRadares}
                onClick={() => {
                  setShowRadares((v) => !v);
                  bumpDockAutoHide();
                }}
                title={showRadares ? "Desativar Radares" : "Ativar Radares"}
              >
                <span className="chipLeft">
                  <span className="chipIcon">
                    <img src={radarIconSatellite} alt="" />
                  </span>
                  <span className="chipText">
                    <span>Radares</span>
                    <span className="chipLegend">Leitura de radar</span>
                  </span>
                </span>
                <LayerToggle checked={showRadares} />
              </button>
            )}

            {canViewRisp && (
              <button
                className={`dockChip ${showRisp ? "dockChipOn" : ""}`}
                role="switch"
                aria-checked={showRisp}
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
                title={showRisp ? "Desativar RISP" : "Ativar RISP"}
              >
                <span className="chipLeft">
                  <span className="chipIcon" aria-hidden="true">
                    <Shield size={15} strokeWidth={2.1} />
                  </span>
                  <span className="chipText">
                    <span>RISP</span>
                    <span className="chipLegend">Regiões Integradas de Segurança Pública</span>
                  </span>
                </span>
                <LayerToggle checked={showRisp} />
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
                role="switch"
                aria-checked={showAisp}
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
                title={showAisp ? "Desativar AISP" : "Ativar AISP"}
              >
                <span className="chipLeft">
                  <span className="chipIcon" aria-hidden="true">
                    <ShieldAlert size={15} strokeWidth={2.1} />
                  </span>
                  <span className="chipText">
                    <span>AISP</span>
                    <span className="chipLegend">Áreas Integradas de Segurança Pública</span>
                  </span>
                </span>
                <LayerToggle checked={showAisp} />
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
                role="switch"
                aria-checked={showCisp}
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
                title={showCisp ? "Desativar CISP" : "Ativar CISP"}
              >
                <span className="chipLeft">
                  <span className="chipIcon" aria-hidden="true">
                    <ShieldCheck size={15} strokeWidth={2.1} />
                  </span>
                  <span className="chipText">
                    <span>CISP</span>
                    <span className="chipLegend">Circunscrições Integradas de Segurança Pública</span>
                  </span>
                </span>
                <LayerToggle checked={showCisp} />
              </button>
            )}
            {canViewCisp && showCisp && multiCodeWarnings.cisp.length > 0 && (
              <div className="dockNote">
                Aviso: {multiCodeWarnings.cisp.length} bairros com mais de uma CISP não foram coloridos. Ex.:{" "}
                {multiCodeWarnings.cisp.slice(0, 4).join(", ")}
              </div>
            )}

            {(canViewBairros || canUseAreaDraw || canUseGps) && (
              <>
                <div className="dockDivider" />
                <div className="dockTitle dockToolsTitle">Ferramentas</div>
              </>
            )}

            {canViewBairros && (
              <button
                className={`dockChip ${showBairros ? "dockChipOn" : ""}`}
                role="switch"
                aria-checked={showBairros}
                onClick={() => {
                  const next = !showBairros;
                  setShowBairros(next);
                  setBairroIntroOpen(next);
                  setBairroSearchMinimized(false);
                  if (next && areaDrawMode) setAreaDrawMinimized(true);
                  setSelectedBairro("");
                  setBairroQuery("");
                  setBairroReportMsg(null);
                  if (next) setDockOpen(false);
                  bumpDockAutoHide();
                }}
                title={showBairros ? "Desativar Bairros" : "Ativar Bairros"}
              >
                <span className="chipLeft">
                  <span className="chipIcon" aria-hidden="true">
                    <Building2 size={15} strokeWidth={2.1} />
                  </span>
                  <span>Bairros</span>
                </span>
                <LayerToggle checked={showBairros} />
              </button>
            )}

            {canUseAreaDraw && (
              <button
                className={`dockChip ${areaDrawMode ? "dockChipOn" : ""}`}
                role="switch"
                aria-checked={areaDrawMode}
                onClick={() => {
                  if (areaDrawMode) {
                    clearAreaDrawing();
                    setAreaDrawMode(false);
                    setAreaDrawAwaitingStart(false);
                    setAreaDrawMinimized(false);
                    setAreaToolsOpen(false);
                    return;
                  }
                  setAreaToolsOpen(true);
                  setAreaDrawMode(true);
                  setAreaDrawAwaitingStart(true);
                  setAreaDrawMinimized(false);
                  setAreaReportMsg(null);
                  setDockOpen(false);
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
                </span>
                <LayerToggle checked={areaDrawMode} />
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

            {canUseGps && (
              <button
                className={`dockChip ${gpsOn ? "dockChipOn" : ""} ${gpsErr ? "dockChipDisabled" : ""}`}
                role="switch"
                aria-checked={gpsOn}
                aria-disabled={!!gpsErr}
                onClick={() => {
                  if (gpsErr) return;
                  toggleGps();
                }}
                title={gpsOn ? "Desativar GPS" : "Ativar GPS"}
              >
                <span className="chipLeft">
                  <span className="chipIcon">
                    <img src={mapPinRed} alt="" />
                  </span>
                  <span>GPS</span>
                </span>
                <LayerToggle checked={gpsOn} />
              </button>
            )}

            {canUseGps && gpsErr && <div className="dockNote">GPS com erro</div>}

            {isMobile && (
              <>
                <div className="dockDivider" />
                <button
                  className="btnGhost"
                  onClick={() => setDockOpen(false)}
                  style={{ borderRadius: 999, padding: "8px 10px" }}
                  title="Esconder"
                >
                  Esconder
                </button>
              </>
            )}
          </div>
          </>
        )}
      </div>

      {/* Desktop navigation */}
      <aside className={`appSidebar desktopPanels ${panel === "admin" || panel === "civitas" ? "appSidebarExpanded" : ""}`} aria-label="Navegação principal">
        <p className="appSidebarSectionLabel">Navegação</p>
        <nav className="appSidebarNav" aria-label="Áreas do sistema">
          <button
            className={`appSidebarItem ${panel === "map" ? "appSidebarItemActive" : ""}`}
            onClick={() => togglePanel("map")}
            title="Equipamentos"
          >
            <LayoutDashboard aria-hidden="true" />
            <span>EQUIPAMENTOS</span>
          </button>
          <button
            className={`appSidebarItem appSidebarCivitas ${panel === "civitas" ? "appSidebarItemActive" : ""}`}
            onClick={() => togglePanel("civitas")}
            title={civitasTabLabel}
          >
            <RadioTower aria-hidden="true" />
            <span>{civitasTabLabel}</span>
          </button>
          {canAccessAdmin && (
            <>
              <button
                className={`appSidebarItem ${panel === "admin" ? "appSidebarItemActive" : ""}`}
                onClick={() => {
                  if (panel === "admin") setAdminMenuExpanded((expanded) => !expanded);
                  else {
                    setAdminMenuExpanded(true);
                    setEquipmentMenuExpanded(true);
                    setPanel("admin");
                  }
                }}
                title={developmentTabLabel}
                aria-expanded={panel === "admin" && adminMenuExpanded}
                aria-controls={panel === "admin" && adminMenuExpanded ? "admin-sidebar-sections" : undefined}
              >
                <SlidersHorizontal aria-hidden="true" />
                <span>{developmentTabLabel}</span>
                <ChevronRight className={`appSidebarGroupChevron ${adminMenuExpanded ? "appSidebarGroupChevronOpen" : ""}`} aria-hidden="true" />
              </button>
              {panel === "admin" && adminMenuExpanded && (
                <div className="appSidebarSubnav" id="admin-sidebar-sections">
                  {adminTabOptions.map((option) => {
                    if (option.key === "cameras") {
                      return (
                        <div className="appSidebarEquipmentGroup" key="equipment-group">
                          <button
                            type="button"
                            className={`appSidebarSubitem appSidebarEquipmentTrigger ${activeAdminIsEquipment ? "appSidebarSubitemActive" : ""}`}
                            onClick={() => setEquipmentMenuExpanded((expanded) => !expanded)}
                            aria-expanded={equipmentMenuExpanded}
                            aria-controls={equipmentMenuExpanded ? "admin-equipment-sections" : undefined}
                          >
                            <LayoutDashboard aria-hidden="true" />
                            <span>Equipamentos</span>
                            <ChevronRight className={`appSidebarEquipmentChevron ${equipmentMenuExpanded ? "appSidebarEquipmentChevronOpen" : ""}`} aria-hidden="true" />
                          </button>
                          {equipmentMenuExpanded && (
                            <div className="appSidebarEquipmentChildren" id="admin-equipment-sections">
                              {adminTabOptions.filter((item) => EQUIPMENT_ADMIN_TABS.includes(item.key)).map((item) => (
                                <button
                                  key={item.key}
                                  type="button"
                                  className={`appSidebarSubitem appSidebarEquipmentItem ${activeAdminTab === item.key ? "appSidebarSubitemActive" : ""}`}
                                  onClick={() => setAdminTab(item.key)}
                                  aria-current={activeAdminTab === item.key ? "page" : undefined}
                                >
                                  {adminTabIcon(item.key)}
                                  <span>{item.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (EQUIPMENT_ADMIN_TABS.includes(option.key)) return null;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`appSidebarSubitem ${activeAdminTab === option.key ? "appSidebarSubitemActive" : ""}`}
                        onClick={() => setAdminTab(option.key)}
                        aria-current={activeAdminTab === option.key ? "page" : undefined}
                      >
                        {adminTabIcon(option.key)}
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </nav>

        <div className="appSidebarFooter">
          <a
            className="appSidebarItem"
            href={civitasContactWhatsappHref}
            target="_blank"
            rel="noreferrer"
            title="Abrir suporte no WhatsApp"
          >
            <MessageCircle aria-hidden="true" />
            <span>Ajuda</span>
          </a>
          <button
            className="appSidebarItem appSidebarLogout"
            onClick={() => {
              auth?.logout?.();
              try {
                nav("/login", { replace: true });
              } catch {
                window.location.href = "/login";
              }
            }}
            title="Encerrar sessão"
          >
            <LogOut aria-hidden="true" />
            <span>Encerrar sessão</span>
          </button>
        </div>
      </aside>

      <header className="appTopbar desktopPanels">
        <img className="appTopbarBrand" src={atlasBrand} alt="Prefeitura do Rio e CIVITAS Rio" />
        <div className="mapCommandBar">
          <div className="mapSearchMode" role="group" aria-label="Tipo de busca">
            <button type="button" className={searchMode === "address" ? "mapSearchModeActive" : ""} onClick={() => { setSearchMode("address"); scheduleAutomaticSearch(searchQuery, "address"); }} aria-label="Buscar endereço" aria-describedby="address-search-tooltip">
              <MapPinned size={16} aria-hidden="true" />
              <span className="mapSearchTooltip" id="address-search-tooltip" role="tooltip">
                <strong>Buscar endereço</strong>
                <small>Ruas, bairros ou coordenadas</small>
              </span>
            </button>
            <button type="button" className={searchMode === "equipment" ? "mapSearchModeActive" : ""} onClick={() => { setSearchMode("equipment"); scheduleAutomaticSearch(searchQuery, "equipment"); }} aria-label="Buscar equipamento" aria-describedby="equipment-search-tooltip">
              <ScanLine size={16} aria-hidden="true" />
              <span className="mapSearchTooltip" id="equipment-search-tooltip" role="tooltip">
                <strong>Buscar equipamento</strong>
                <small>Encontre pelo código numérico</small>
              </span>
            </button>
          </div>
          <Search size={17} strokeWidth={2.2} aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchErr(null);
              setSearchQuery(e.target.value);
              scheduleAutomaticSearch(e.target.value, searchMode);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
            }}
            placeholder="Buscar"
            aria-label={searchMode === "address" ? "Buscar endereço ou coordenadas" : "Buscar equipamento"}
          />
          {searchErr && <div className="mapCommandBarError">{searchErr}</div>}
        </div>

        <div className="mapTopActions">
          <button
            type="button"
            className={`mapCivitasAction ${panel === "civitas" ? "mapCivitasActionActive" : ""}`}
            onClick={() => togglePanel("civitas")}
            title={panel === "civitas" ? "Fechar CIVITAS" : "Acionar CIVITAS"}
          >
            <span className="mapCivitasActionLogo" aria-hidden="true">
              <img src={civitasActionSymbol} alt="" />
            </span>
            <span>ACIONAR CIVITAS</span>
          </button>
          <div className="mapUtilityBar">
            {!isMobile && me?.id && (
              <NotificationCenter key={me.id} apiBase={API_BASE} token={accessToken} isMobile={false} />
            )}
            <button
              type="button"
              className={`mapUtilityBarIdentity mapUtilityProfile ${panel === "profile" ? "mapUtilityProfileActive" : ""}`}
              onClick={() => togglePanel("profile")}
              title={me?.full_name ? `Abrir perfil de ${me.full_name}` : "Abrir meu perfil"}
              aria-label="Abrir meu perfil"
            >
              <span className="mapUtilityProfileAvatar" aria-hidden="true">
                {(me?.full_name || "Usuário").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
              </span>
              <span className="mapUtilityProfileCopy">
                <strong>{me?.full_name || "Usuário"}</strong>
                <small title={auth.organizationName || "Sem organização"}>{auth.organizationName || "Sem organização"}</small>
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* LEFT PANEL (desktop) */}
      {panel !== null && panel !== "admin" && panel !== "civitas" && (
        <div
          className={`desktopPanels mapWorkspacePanel panelCard ${panel === "profile" ? "profilePanel" : ""} ${panel === "map" && (searchEquipmentPoint || searchedEquipment.length) ? "searchEquipmentOnly" : ""}`.trim()}
          style={{
            position: "absolute",
            top: 76,
            left: panelSideInset + panelShiftRight,
            width: panelWidth,
            maxWidth: `calc(100vw - ${panelSideInset * 2}px)`,
            zIndex: 20,
            padding: 14,
            color: "#0b0b0f",
            marginLeft: 0,
          }}
        >
          {panel === "map" && (
            <>
              {(searchEquipmentPoint || searchedEquipment.length > 0) && (
                <div className={`searchEquipmentResults ${displayedSearchEquipment.length > 5 ? "searchEquipmentResultsScrollable" : ""}`} onScroll={(event) => {
                  const target = event.currentTarget;
                  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 24) {
                    setNearbyVisibleCount((count) => Math.min(count + 7, displayedSearchEquipment.length));
                  }
                }}>
                  <div className="searchEquipmentResultsHeader">
                    <div className="searchEquipmentResultsTitle">{searchEquipmentTitle || "Equipamentos próximos da busca"}</div>
                    <button type="button" className="searchEquipmentResultsClose" onClick={closeSearchEquipmentResults} aria-label="Fechar equipamentos encontrados" title="Fechar">
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                  {displayedSearchEquipment.length ? (
                    visibleSearchEquipment.map(({ item, kind, meters }, index) => (
                      <button
                        type="button"
                        className="searchEquipmentResultCard"
                        key={`${kind}-${getPointCollectionCode(item)}-${index}`}
                        onClick={() => {
                          const lng = getLng(item);
                          const lat = getLat(item);
                          if (lng != null && lat != null) {
                            focusOnEquipment(kind === "Câmera" ? "camera" : kind === "Super Câmera" ? "camera_intel" : kind === "LPR" ? "camera_lpr" : "radar", lng, lat, 18);
                          }
                        }}
                        title="Centralizar equipamento no mapa"
                      >
                        <div className="searchEquipmentResultIcon">
                          <img
                            src={kind === "Câmera" ? cameraIcon : kind === "Super Câmera" ? cameraIntelIcon : kind === "LPR" ? cameraLprIconSatellite : radarIconSatellite}
                            alt=""
                          />
                        </div>
                        <div className="searchEquipmentResultBody">
                          <strong>{item.name || item.nome || `${kind} ${getPointCollectionCode(item) || ""}`}</strong>
                          <span>{kind} · {getPointCollectionCode(item) || "Sem código"}{typeof meters === "number" ? ` · ${Math.round(meters)} m` : ""}</span>
                        </div>
                      </button>
                    ))
                  ) : <div className="searchEquipmentEmpty">{searchEquipmentPoint ? (!searchEquipmentViewport ? "Localizando equipamentos no mapa..." : "Nenhum equipamento visível nesta área do mapa.") : "Nenhum equipamento encontrado."}</div>}
                </div>
              )}
              <div className="equipmentPanelHeader" style={{ marginBottom: 12, display: "grid", gap: 12 }}>
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
                  {isMobile ? "Limpar" : "✕"}
                </button>
              </div>

              <div
                key={listMode}
                ref={listScrollRef}
                className="scrollbarHidden equipmentList"
                style={equipmentListStyle}
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
                    return (
                      <div
                        key={c.code}
                        className="listItem"
                        onClick={() => {
                          if (!focusOnEquipment("camera", c.lng, c.lat)) return;
                          setSelectedCode(c.code);
                          setSelectedRadar(null);
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
                              {hasStreamingAccess && c.id && (
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
                      hasSmartCameraStreamingAccess && Boolean(smartId) && !unavailableSmartCameraIds[smartId];
                    return (
                      <div
                        key={smartId || c.code}
                        className="listItem"
                        onClick={() => {
                          if (!focusOnEquipment("camera_intel", c.lng, c.lat)) return;
                          setSelectedCode(null);
                          setSelectedRadar(null);
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
                          if (!focusOnEquipment("camera_lpr", c.lng, c.lat)) return;
                          setSelectedCode(null);
                          setSelectedRadar(null);
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
                          if (!focusOnEquipment("radar", lng, lat)) return;
                          setSelectedRadar(getPointCollectionKey(r) || r.codcet);
                          setSelectedCode(null);
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
            <ProfilePanel me={me} auth={auth} password={password} setPanel={setPanel} setPanelOpen={setPanelOpen} />
          )}

        </div>
      )}

      {panel === "civitas" && (
        <section className="civitasWorkspace" aria-label="Acionar CIVITAS">
          <div className="civitasWorkspaceTopline">
            <nav className="civitasWorkspaceBreadcrumb" aria-label="Caminho de navegação">
              <button type="button" onClick={() => { setPanel(null); setPanelOpen(false); }}>Mapa</button>
              <ChevronRight size={14} aria-hidden="true" />
              <span aria-current="page">Acionar CIVITAS</span>
            </nav>
            <button type="button" className="adminWorkspaceClose civitasWorkspaceClose" aria-label="Voltar ao mapa" onClick={() => { setPanel(null); setPanelOpen(false); }}>
              <X size={16} className="workspaceCloseIcon" aria-hidden="true" />
              <span>Voltar ao mapa</span>
            </button>
          </div>
          {<CivitasPanel {...civitasScroll} isMobile={isMobile} />}
        </section>
      )}

      {panel === "admin" && canAccessAdmin && (
        <AdminWorkspace
          activeAdminIsEquipment={activeAdminIsEquipment}
          activeAdminTab={activeAdminTab}
          adminWorkspaceMainRef={adminWorkspaceMainRef}
          adminTabOptions={adminTabOptions}
          setAdminTab={setAdminTab}
          setPanel={setPanel}
          setPanelOpen={setPanelOpen}
          activeAdminLabel={activeAdminLabel}
          isMobile={isMobile}
          adminUsersOrgOpen={adminUsersOrgOpen}
          accessToken={accessToken}
          role={role}
          setAdminUsersOrgOpen={setAdminUsersOrgOpen}
          me={me}
          cinematicMode={cinematicMode}
          setCinematicMode={setCinematicMode}
          poisGeo={poisGeo}
          loadCameras={loadCameras}
          loadCamerasIntel={loadCamerasIntel}
          loadCamerasLpr={loadCamerasLpr}
          loadRadares={loadRadares}
        />
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
              aria-label={mobileMenuOpen ? "Voltar ao mapa" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-quick-menu"
              title={mobileMenuOpen ? "Voltar ao mapa" : "Menu"}
            >
              {mobileMenuOpen ? "Voltar" : <Menu size={18} strokeWidth={2.4} />}
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
                    <button type="button" className="mobileMenuClose" onClick={() => setMobileMenuOpen(false)}>
                      Voltar
                    </button>
                  </div>

                  <div className="mobileMenuActions">
                    <div className="mobileNotificationsMenuSlot" ref={setMobileNotificationMenuTarget} />
                    {canAccessAdmin && (
                      <button
                        type="button"
                        className="mobileMenuAction"
                        onClick={() => {
                          setMobileSearchOpen(false);
                          setMobileMenuOpen(false);
                          setPanel("admin");
                          setPanelOpen(false);
                        }}
                      >
                        <span className="mobileMenuActionIcon">
                          <SlidersHorizontal size={16} strokeWidth={2.4} />
                        </span>
                        <span className="mobileMenuActionText">
                          <span className="mobileMenuActionLabel">{developmentTabLabel}</span>
                          <span className="mobileMenuActionSub">Gestão de usuários e equipamentos</span>
                        </span>
                        <ChevronRight className="mobileMenuActionChevron" size={16} strokeWidth={2.4} />
                      </button>
                    )}

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

        {panelOpen && panel !== "admin" && panel !== "civitas" && (
          <div
            ref={mobileDrawerRef}
            className={`mobileDrawer glassStrong scrollbarHidden ${panel === "profile" ? "mobileProfileWorkspace" : ""} ${panel === "map" && !searchEquipmentPoint && !searchedEquipment.length ? "mobileEquipmentWorkspace" : ""}`}
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
            {panel === "map" && (
              (searchEquipmentPoint || searchedEquipment.length > 0) ? (
                <div
                  className="searchEquipmentResults searchEquipmentResultsScrollable"
                  onScroll={(event) => {
                    const target = event.currentTarget;
                    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 24) {
                      setNearbyVisibleCount((count) => Math.min(count + 7, displayedSearchEquipment.length));
                    }
                  }}
                >
                  <div className="searchEquipmentResultsHeader">
                    <div className="searchEquipmentResultsTitle">{searchEquipmentTitle || "Equipamentos próximos da busca"}</div>
                    <button type="button" className="searchEquipmentResultsClose" onClick={closeSearchEquipmentResults} aria-label="Fechar equipamentos encontrados" title="Fechar">
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                  {displayedSearchEquipment.length ? visibleSearchEquipment.map(({ item, kind, meters }, index) => (
                    <button
                      type="button"
                      className="searchEquipmentResultCard"
                      key={`mobile-${kind}-${getPointCollectionCode(item)}-${index}`}
                      onClick={() => {
                        const lng = getLng(item);
                        const lat = getLat(item);
                        if (lng != null && lat != null) {
                          if (focusOnEquipment(kind === "Câmera" ? "camera" : kind === "Super Câmera" ? "camera_intel" : kind === "LPR" ? "camera_lpr" : "radar", lng, lat, 18)) {
                            setPanelOpen(false);
                          }
                        }
                      }}
                    >
                      <div className="searchEquipmentResultIcon"><img src={kind === "Câmera" ? cameraIcon : kind === "Super Câmera" ? cameraIntelIcon : kind === "LPR" ? cameraLprIconSatellite : radarIconSatellite} alt="" /></div>
                      <div className="searchEquipmentResultBody">
                        <strong>{item.name || item.nome || `${kind} ${getPointCollectionCode(item) || ""}`}</strong>
                        <span>{kind} · {getPointCollectionCode(item) || "Sem código"}{typeof meters === "number" ? ` · ${Math.round(meters)} m` : ""}</span>
                      </div>
                    </button>
                  )) : <div className="searchEquipmentEmpty">{searchEquipmentPoint ? (!searchEquipmentViewport ? "Localizando equipamentos no mapa..." : "Nenhum equipamento visível nesta área do mapa.") : "Nenhum equipamento encontrado."}</div>}
                </div>
              ) : (
              <>
                <div className="mobileEquipmentDragHandle" aria-hidden="true"><span /></div>
                <div className="mobileEquipmentHeader">
                  <div>
                    <span className="mobileEquipmentEyebrow">MAPA · EQUIPAMENTOS</span>
                    <h2>Equipamentos</h2>
                    <p>Explore os pontos disponíveis no mapa</p>
                  </div>
                  <button type="button" onClick={() => setPanelOpen(false)} aria-label="Voltar ao mapa">Voltar ao mapa</button>
                </div>
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
                    <div className="mobileEquipmentTabs" role="tablist" aria-label="Tipos de equipamento">
                      {availableListModes.map((option) => {
                        const active = listMode === option.mode;
                        return (
                          <button
                            key={option.mode}
                            type="button"
                            onClick={() => setListMode(option.mode)}
                            role="tab"
                            aria-selected={active}
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
                    Limpar
                  </button>
                </div>

                <div
                  key={listMode}
                  ref={listScrollMobileRef}
                  className="scrollbarHidden mobileEquipmentList"
                  style={equipmentListStyle}
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
                      return (
                        <div
                          key={c.code}
                          className="listItem"
                          onClick={() => {
                            if (!focusOnEquipment("camera", c.lng, c.lat)) return;
                            setSelectedCode(c.code);
                            setSelectedRadar(null);
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
                                {hasStreamingAccess && c.id && (
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
                        hasSmartCameraStreamingAccess && Boolean(smartId) && !unavailableSmartCameraIds[smartId];
                      return (
                        <div
                          key={smartId || c.code}
                          className="listItem"
                          onClick={() => {
                            if (!focusOnEquipment("camera_intel", c.lng, c.lat)) return;
                            setSelectedCode(null);
                            setSelectedRadar(null);
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
                            if (!focusOnEquipment("camera_lpr", c.lng, c.lat)) return;
                            setSelectedCode(null);
                            setSelectedRadar(null);
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
                            if (!focusOnEquipment("radar", lng, lat)) return;
                            setSelectedRadar(getPointCollectionKey(r) || r.codcet);
                            setSelectedCode(null);
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
              )
            )}

            {panel === "profile" && (
              <ProfilePanel me={me} auth={auth} password={password} setPanel={setPanel} setPanelOpen={setPanelOpen} isMobile />
            )}

          </div>
        )}
      </div>

      <nav className="mobileBottomNav" aria-label="Navegação principal">
        <button
          type="button"
          className={panelOpen && panel === "map" ? "mobileBottomNavActive" : ""}
          onClick={() => {
            setMobileMenuOpen(false);
            setMobileSearchOpen(false);
            setSearchEquipmentPoint(null);
            setSearchedEquipment([]);
            setSearchEquipmentTitle("");
            setPanel("map");
            setPanelOpen(true);
          }}
        >
          <LayoutDashboard size={19} aria-hidden="true" />
          <span>Equipamentos</span>
        </button>
        <button
          type="button"
          className={mobileSearchOpen ? "mobileBottomNavActive" : ""}
          onClick={() => {
            setSearchErr(null);
            setPanelOpen(false);
            setMobileMenuOpen(false);
            setMobileSearchFocused(true);
            setMobileSearchOpen(true);
          }}
        >
          <Search size={19} aria-hidden="true" />
          <span>Buscar</span>
        </button>
        <button
          type="button"
          className={`mobileBottomNavCivitas ${panel === "civitas" ? "mobileBottomNavActive" : ""}`}
          onClick={() => {
            setMobileSearchOpen(false);
            setMobileMenuOpen(false);
            setPanel("civitas");
            setPanelOpen(false);
          }}
          aria-label="Acionar CIVITAS"
        >
          <span className="mobileBottomNavCivitasLogo"><img src={civitasActionSymbol} alt="" /></span>
          <span>Acionar</span>
        </button>
        <button
          type="button"
          className={panelOpen && panel === "profile" ? "mobileBottomNavActive" : ""}
          onClick={() => {
            setMobileSearchOpen(false);
            setMobileMenuOpen(false);
            setPanel("profile");
            setPanelOpen(true);
          }}
          aria-label="Meu perfil"
          title="Meu perfil"
        >
          <UserRound size={20} aria-hidden="true" />
          <span>Perfil</span>
        </button>
        <button
          type="button"
          className={mobileMenuOpen ? "mobileBottomNavActive" : ""}
          onClick={() => {
            setMobileSearchOpen(false);
            setPanelOpen(false);
            setMobileMenuOpen((open) => !open);
          }}
          aria-label="Mais opções"
          title="Mais opções"
        >
          <Menu size={20} aria-hidden="true" />
          <span>Mais</span>
        </button>
      </nav>

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
                aria-label="Voltar ao mapa"
                title="Voltar ao mapa"
              >
                Voltar
              </button>
            </div>

            <div className="mobileSearchCopy">
              {searchMode === "address" ? "Digite rua, bairro, ponto de referência ou coordenada no mapa." : "Digite o código numérico do equipamento."}
            </div>

            <div className="mobileSearchMode" role="group" aria-label="Tipo de busca">
              <button type="button" className={searchMode === "address" ? "mobileSearchModeActive" : ""} onPointerDown={(event) => event.preventDefault()} onClick={() => { setSearchMode("address"); scheduleAutomaticSearch(searchQuery, "address"); }} title="Buscar local" aria-label="Buscar local">
                <MapPinned size={17} aria-hidden="true" />
              </button>
              <button type="button" className={searchMode === "equipment" ? "mobileSearchModeActive" : ""} onPointerDown={(event) => event.preventDefault()} onClick={() => { setSearchMode("equipment"); scheduleAutomaticSearch(searchQuery, "equipment"); }} title="Buscar equipamento" aria-label="Buscar equipamento">
                <ScanLine size={17} aria-hidden="true" />
              </button>
            </div>

            <div className="mobileSearchFieldShell">
              <span className="mobileSearchFieldIcon" aria-hidden="true">
                <Search size={16} strokeWidth={2.35} />
              </span>
              <input
                ref={mobileSearchInputRef}
                autoFocus
                value={searchQuery}
                onFocus={() => setMobileSearchFocused(true)}
                onBlur={() => setMobileSearchFocused(false)}
                onChange={(e) => {
                  setSearchErr(null);
                  setSearchQuery(e.target.value);
                  scheduleAutomaticSearch(e.target.value, searchMode);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void submitMobileSearch();
                  }
                  if (e.key === "Escape") {
                    setMobileSearchOpen(false);
                  }
                }}
                placeholder="Busca"
                className="mobileSearchInput"
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  className="mobileSearchClearBtn"
                  onClick={() => {
                    setSearchErr(null);
                    setSearchQuery("");
                    scheduleAutomaticSearch("", searchMode);
                  }}
                  aria-label="Limpar busca"
                  title="Limpar"
                >
                  Limpar
                </button>
              )}
            </div>

            {searchErr && <div className="mobileSearchError">{searchErr}</div>}

            <div className="mobileSearchHint">A busca começa automaticamente. Toque fora para ver o mapa.</div>
          </div>
        </div>
      )}
    </div>
  );
}
