import type * as mapboxgl from "mapbox-gl";
import cameraIcon from "@/assets/camera-icon.png";
import radarIconSatellite from "@/assets/radar-icon-satellite.png";
import cameraIntelIcon from "@/assets/cameras-inteligentes-icon.png";
import cameraLprIconSatellite from "@/assets/camera-lpr-icon-satellite.png";
import type { MapBaseStyle, CameraMarkerKind } from "./mapConfig";

export const CAMERA_MARKER_IMAGE_IDS: Record<MapBaseStyle, Record<CameraMarkerKind, string>> = {
  streets: {
    camera: "camera_icon_streets",
    camera_intel: "camera_intel_icon_streets",
  },
  satellite: {
    camera: "camera_icon_satellite",
    camera_intel: "camera_intel_icon_satellite",
  },
} as const;

export const CAMERA_MARKER_IMAGE_SOURCES: Record<MapBaseStyle, Record<CameraMarkerKind, string>> = {
  streets: {
    camera: cameraIcon,
    camera_intel: cameraIntelIcon,
  },
  satellite: {
    camera: cameraIcon,
    camera_intel: cameraIntelIcon,
  },
} as const;

export function getCameraMarkerImageId(style: MapBaseStyle, kind: CameraMarkerKind) {
  return CAMERA_MARKER_IMAGE_IDS[style][kind];
}

export function getCameraMarkerImageSource(style: MapBaseStyle, kind: CameraMarkerKind) {
  return CAMERA_MARKER_IMAGE_SOURCES[style][kind];
}

export const POI_MARKER_IMAGE_SOURCES: Record<MapBaseStyle, { radar: string; camera_lpr: string }> = {
  streets: {
    radar: radarIconSatellite,
    camera_lpr: cameraLprIconSatellite,
  },
  satellite: {
    radar: radarIconSatellite,
    camera_lpr: cameraLprIconSatellite,
  },
} as const;

export function getRadarMarkerImageSource(style: MapBaseStyle) {
  return POI_MARKER_IMAGE_SOURCES[style].radar;
}

export function getCameraLprMarkerImageSource(style: MapBaseStyle) {
  return POI_MARKER_IMAGE_SOURCES[style].camera_lpr;
}

export function loadImagePromise(map: mapboxgl.Map, url: string) {
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

export async function upsertMapImage(map: mapboxgl.Map, id: string, url: string) {
  const image = await loadImagePromise(map, url);
  if (map.hasImage(id)) {
    map.removeImage(id);
  }
  map.addImage(id, image as any, { pixelRatio: 2 });
}
