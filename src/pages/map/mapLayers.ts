import {
  LAYERS,
  type MapBaseStyle,
  type AreaDrawPolygonPoints,
  SOURCES,
  IMAGES,
  CAMERA_MARKER_ICON_SIZE,
  CAMERA_INTEL_MARKER_ICON_SIZE,
  CAMERA_LPR_MARKER_ICON_SIZE,
  RADAR_MARKER_ICON_SIZE,
} from "./mapConfig";
import type * as mapboxgl from "mapbox-gl";
import type { FeatureCollection, Polygon, MultiPolygon, LineString, MultiLineString } from "geojson";
import { getCameraMarkerImageId } from "./mapImages";
import { makeAreaDrawGeoJSON } from "./areaDrawing";

export function colorForIndex(i: number) {
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

export function buildMatchExpr(key: string, values: number[]) {
  if (!values.length) return "rgba(0,0,0,0)";
  const expr: any[] = ["match", ["to-number", ["get", key]]];
  values.forEach((v, i) => {
    expr.push(v, colorForIndex(i));
  });
  expr.push("rgba(0,0,0,0)");
  return expr;
}

export function applyCodeColors(
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

type MapLayerContext = {
  mapBaseStyleRef: import("react").RefObject<MapBaseStyle>;
  cinematicModeRef: import("react").RefObject<boolean>;
  rispColorExpr: ReturnType<typeof buildMatchExpr>;
  aispColorExpr: ReturnType<typeof buildMatchExpr>;
  cispColorExpr: ReturnType<typeof buildMatchExpr>;
};

export function createMapLayers({
  mapBaseStyleRef, cinematicModeRef, rispColorExpr, aispColorExpr, cispColorExpr,
}: MapLayerContext) {
  function ensureSourcesAndLayers(map: mapboxgl.Map, style: MapBaseStyle = mapBaseStyleRef.current) {
    const cameraImageId = getCameraMarkerImageId(style, "camera");
    const cameraIntelImageId = getCameraMarkerImageId(style, "camera_intel");

    if (!map.getSource(SOURCES.pois)) {
      map.addSource(SOURCES.pois, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: !cinematicModeRef.current,
        clusterRadius: 60,
        clusterMaxZoom: 14,
        clusterProperties: {
          camera: ["+", ["case", ["==", ["get", "kind"], "camera"], 1, 0]],
          camera_intel: ["+", ["case", ["==", ["get", "kind"], "camera_intel"], 1, 0]],
          camera_lpr: ["+", ["case", ["==", ["get", "kind"], "camera_lpr"], 1, 0]],
          radar: ["+", ["case", ["==", ["get", "kind"], "radar"], 1, 0]],
        },
        ...(cinematicModeRef.current ? { maxzoom: 14, buffer: 32 } : {}),
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
  return { ensureSourcesAndLayers };
}

export function updateAreaDrawData(
    map: mapboxgl.Map,
    polygons: AreaDrawPolygonPoints[],
    currentPoints: AreaDrawPolygonPoints
  ) {
    const src: any = map.getSource(SOURCES.area_draw);
    if (!src || typeof src.setData !== "function") return;
    src.setData(makeAreaDrawGeoJSON(polygons, currentPoints));
  }

export function updateBairrosData(
    map: mapboxgl.Map,
    data: FeatureCollection<Polygon | MultiPolygon, any>
  ) {
    const src: any = map.getSource(SOURCES.bairros);
    if (src && typeof src.setData === "function") src.setData(data);
  }

export function updateBairrosLineData(
    map: mapboxgl.Map,
    data: FeatureCollection<LineString | MultiLineString, any>
  ) {
    const src: any = map.getSource(SOURCES.bairros_lines);
    if (src && typeof src.setData === "function") src.setData(data);
  }

export function updateRispData(
    map: mapboxgl.Map,
    data: FeatureCollection<Polygon | MultiPolygon, any>
  ) {
    const src: any = map.getSource(SOURCES.risp);
    if (src && typeof src.setData === "function") src.setData(data);
  }

export function updateAispData(
    map: mapboxgl.Map,
    data: FeatureCollection<Polygon | MultiPolygon, any>
  ) {
    const src: any = map.getSource(SOURCES.aisp);
    if (src && typeof src.setData === "function") src.setData(data);
  }

export function updateCispData(
    map: mapboxgl.Map,
    data: FeatureCollection<Polygon | MultiPolygon, any>
  ) {
    const src: any = map.getSource(SOURCES.cisp);
    if (src && typeof src.setData === "function") src.setData(data);
  }

export function applyBairrosVisibility(map: mapboxgl.Map, visible: boolean, selected: string) {
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

export function applyCodeVisibility(
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
