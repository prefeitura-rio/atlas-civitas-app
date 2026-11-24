import type { CSSProperties } from "react";
import type { Feature, Point } from "geojson";
import { getPointCollectionCode } from "./shared";
import {
  type MapBaseStyle,
  CAMERA_MARKER_ICON_SIZE,
  CAMERA_INTEL_MARKER_ICON_SIZE,
  CAMERA_LPR_MARKER_ICON_SIZE,
  RADAR_MARKER_ICON_SIZE,
} from "./mapConfig";
import {
  getCameraMarkerImageSource,
  getRadarMarkerImageSource,
  getCameraLprMarkerImageSource,
} from "./mapImages";

export type PoiKind = "camera" | "camera_intel" | "camera_lpr" | "radar";

export const POI_KIND_ORDER: PoiKind[] = ["camera_intel", "camera_lpr", "camera", "radar"];

export const POI_MARKER_PIXEL_SIZES: Record<PoiKind, number> = {
  camera: 24 * CAMERA_MARKER_ICON_SIZE,
  camera_intel: 24 * CAMERA_INTEL_MARKER_ICON_SIZE,
  camera_lpr: 24 * CAMERA_LPR_MARKER_ICON_SIZE,
  radar: 24 * RADAR_MARKER_ICON_SIZE,
};

export function sortStackedPoiFeatures(stack: Feature<Point, Record<string, unknown>>[]) {
  return stack.slice().sort((a, b) => {
    const aKind = asPoiKind(a.properties?.kind);
    const bKind = asPoiKind(b.properties?.kind);
    const aWeight = aKind ? POI_KIND_ORDER.indexOf(aKind) : 999;
    const bWeight = bKind ? POI_KIND_ORDER.indexOf(bKind) : 999;
    if (aWeight !== bWeight) return aWeight - bWeight;
    const aCode = getPointCollectionCode(a.properties) || "";
    const bCode = getPointCollectionCode(b.properties) || "";
    return String(aCode).localeCompare(String(bCode), "pt-BR", { numeric: true });
  });
}

export function asPoiKind(value: unknown): PoiKind | null {
  if (value === "camera" || value === "camera_intel" || value === "camera_lpr" || value === "radar") {
    return value;
  }
  return null;
}

export const POI_KIND_VISUALS: Record<
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

export function getPoiVisual(kind: PoiKind) {
  return POI_KIND_VISUALS[kind];
}

export function getPoiIconSource(style: MapBaseStyle, kind: PoiKind) {
  if (kind === "camera") return getCameraMarkerImageSource(style, "camera");
  if (kind === "camera_intel") return getCameraMarkerImageSource(style, "camera_intel");
  if (kind === "camera_lpr") return getCameraLprMarkerImageSource(style);
  return getRadarMarkerImageSource(style);
}

export function getPoiListIconBubbleStyle(kind: PoiKind): CSSProperties {
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

export function getPoiListIconStyle(): CSSProperties {
  return {
    width: 10,
    height: 10,
    objectFit: "contain",
    opacity: 1,
  };
}

export function getPoiCodePillStyle(kind: PoiKind, compact = false): CSSProperties {
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

export function poiCoordKey(lng: number, lat: number) {
  return `${lng.toFixed(6)}|${lat.toFixed(6)}`;
}

export function featureCoordKey(feature: Feature<Point, any>): string | null {
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return poiCoordKey(lng, lat);
}
