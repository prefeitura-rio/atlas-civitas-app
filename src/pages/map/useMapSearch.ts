import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type * as mapboxgl from "mapbox-gl";
import { MAPBOX_TOKEN, type PanelKey } from "./mapConfig";
import { fetchJson, getPointCollectionIdentifiers } from "./shared";
import type { Camera, CameraIntel, CameraLpr, Radar } from "./types";

type Options = {
  cameras: Camera[];
  camerasIntel: CameraIntel[];
  camerasLpr: CameraLpr[];
  radares: Radar[];
  flyToPoint: (lng: number, lat: number, zoom?: number) => void;
  setPanel: Dispatch<SetStateAction<PanelKey>>;
  setPanelOpen: Dispatch<SetStateAction<boolean>>;
  setMobileSearchOpen: Dispatch<SetStateAction<boolean>>;
};

export function useMapSearch({
  cameras, camerasIntel, camerasLpr, radares, flyToPoint, setPanel, setPanelOpen, setMobileSearchOpen,
}: Options) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"address" | "equipment">("address");
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchPin, setSearchPin] = useState<{ lng: number; lat: number } | null>(null);
  const [searchEquipmentPoint, setSearchEquipmentPoint] = useState<{ lng: number; lat: number } | null>(null);
  const [searchEquipmentViewport, setSearchEquipmentViewport] = useState<mapboxgl.LngLatBounds | null>(null);
  const [searchedEquipment, setSearchedEquipment] = useState<Array<{ item: any; kind: string; meters?: number }>>([]);
  const [searchEquipmentTitle, setSearchEquipmentTitle] = useState("");
  const [nearbyVisibleCount, setNearbyVisibleCount] = useState(7);
  const addressSearchFlyPendingRef = useRef(false);
  const searchTimerRef = useRef<number | null>(null);
  const automaticSearchTimerRef = useRef<number | null>(null);
  const searchGenerationRef = useRef(0);

  const mobileSearchSubmittingRef = useRef(false);

  async function handleSearch(queryOverride?: string, modeOverride?: "address" | "equipment", generation?: number): Promise<boolean> {
    const q = (queryOverride ?? searchQuery).trim();
    if (!q) return false;
    const currentGeneration = generation ?? ++searchGenerationRef.current;
    const isCurrentSearch = () => currentGeneration === searchGenerationRef.current;
    if (!isCurrentSearch()) return false;
    setSearchErr(null);
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);

    if ((modeOverride ?? searchMode) === "equipment") {
      if (!/^\d+$/.test(q)) {
        setSearchErr("Informe somente o número do equipamento.");
        return false;
      }
      const requestedCode = q.replace(/^0+(?=\d)/, "");
      const hasRequestedCode = (item: any) =>
        getPointCollectionIdentifiers(item).some((identifier) => {
          const numericIdentifier = String(identifier).replace(/\D/g, "");
          return numericIdentifier.replace(/^0+(?=\d)/, "") === requestedCode;
        });
      const entries = [
        ...cameras.map((item: any) => ({ item, kind: "Câmera" })),
        ...camerasIntel.map((item: any) => ({ item, kind: "Super Câmera" })),
        ...camerasLpr.map((item: any) => ({ item, kind: "LPR" })),
        ...radares.map((item: any) => ({ item, kind: "Radar" })),
      ].filter(({ item }) => hasRequestedCode(item));

      if (!entries.length) {
        setSearchedEquipment([]);
        setSearchErr("Nenhum equipamento encontrado.");
        return false;
      }
      setSearchEquipmentPoint(null);
      setSearchedEquipment(entries);
      setSearchEquipmentTitle("Equipamentos encontrados");
      setPanel("map");
      return true;
    }

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
        setSearchEquipmentPoint({ lng, lat });
        setSearchEquipmentViewport(null);
        addressSearchFlyPendingRef.current = true;
        setSearchedEquipment([]);
        setSearchEquipmentTitle("Equipamentos próximos da busca");
        setPanel("map");
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
        if (!isCurrentSearch()) return false;
        if (!features.length) features = await fetchFeatures({ types: "address", autocomplete: true, limit: 5 });
        if (!isCurrentSearch()) return false;
        if (!features.length) features = await fetchFeatures({ limit: 5 });
      } else {
        features = await fetchFeatures({ limit: 3 });
      }
      if (!isCurrentSearch()) return false;

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
      setSearchEquipmentPoint({ lng, lat });
      setSearchEquipmentViewport(null);
      addressSearchFlyPendingRef.current = true;
      setSearchedEquipment([]);
      setSearchEquipmentTitle("Equipamentos próximos da busca");
      setPanel("map");
      const isAddress =
        Array.isArray(f.place_type) && (f.place_type.includes("address") || f.place_type.includes("poi"));
      flyToPoint(lng, lat, isAddress ? 17.5 : 16);
      searchTimerRef.current = window.setTimeout(() => setSearchPin(null), 4000);
      return true;
    } catch (e: any) {
      if (isCurrentSearch()) setSearchErr(e?.message || "Falha ao buscar endereço.");
      return false;
    }
  }

  function scheduleAutomaticSearch(nextQuery: string, nextMode: "address" | "equipment") {
    const generation = ++searchGenerationRef.current;
    if (automaticSearchTimerRef.current) window.clearTimeout(automaticSearchTimerRef.current);
    setSearchErr(null);
    setSearchPin(null);
    setSearchEquipmentPoint(null);
    setSearchedEquipment([]);
    const trimmedQuery = nextQuery.trim();
    if (!trimmedQuery) return;
    if (nextMode === "address" && trimmedQuery.length < 3) return;
    automaticSearchTimerRef.current = window.setTimeout(() => {
      void handleSearch(trimmedQuery, nextMode, generation);
      automaticSearchTimerRef.current = null;
    }, 700);
  }

  async function submitMobileSearch(queryOverride?: string) {
    if (mobileSearchSubmittingRef.current) return;
    mobileSearchSubmittingRef.current = true;
    try {
      const ok = await handleSearch(queryOverride);
      if (ok) {
        setMobileSearchOpen(false);
        setPanelOpen(true);
      }
    } finally {
      mobileSearchSubmittingRef.current = false;
    }
  }

  return {
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    searchErr,
    setSearchErr,
    searchPin,
    setSearchPin,
    searchEquipmentPoint,
    setSearchEquipmentPoint,
    searchEquipmentViewport,
    setSearchEquipmentViewport,
    searchedEquipment,
    setSearchedEquipment,
    searchEquipmentTitle,
    setSearchEquipmentTitle,
    nearbyVisibleCount,
    setNearbyVisibleCount,
    addressSearchFlyPendingRef,
    searchTimerRef,
    automaticSearchTimerRef,
    searchGenerationRef,
    handleSearch,
    scheduleAutomaticSearch,
    submitMobileSearch,
  };
}
