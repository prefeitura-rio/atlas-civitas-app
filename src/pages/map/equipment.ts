import { getLat, getLng } from "./coordinates";
import type { Feature, Point } from "geojson";
import type { Camera, CameraIntel, CameraLpr, Radar } from "./types";
import { cleanString, firstNonEmptyString, getPointCollectionTitle } from "./shared";
import { getSmartCameraId, getSmartCameraExternalId } from "./streaming";

export function getLprNeighborhood(value: any) {
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

export function isEntityActive(value: any) {
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

export function camerasToFeatures(list: Camera[]): Feature<Point, any>[] {
  return list.map((c) => {
    const cameraId = cleanString((c as any).camera_id || c.id);

    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      properties: {
        kind: "camera",
        id: c.id ?? "",
        camera_id: cameraId,
        code: c.code,
        name: c.name,
        zona_camera: (c as any).zona_camera ?? (c as any).zone ?? "",
        sistema_origem: (c as any).sistema_origem ?? "",
        responsavel: (c as any).responsavel ?? "",
        city: c.city,
        uf: c.uf,
        address: c.address || "",
        is_active: c.is_active ? 1 : 0,
      },
    };
  });
}

export function camerasIntelToFeatures(list: CameraIntel[]): Feature<Point, any>[] {
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

export function camerasLprToFeatures(list: CameraLpr[]): Feature<Point, any>[] {
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

export function radaresToFeatures(list: Radar[]): Feature<Point, any>[] {
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

export function normalizeEquipmentPoints<T>(data: unknown): T[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((item) => item && typeof item === "object" && isEntityActive(item))
    .map((item) => ({ ...item, lat: getLat(item) ?? NaN, lng: getLng(item) ?? NaN }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)) as T[];
}

export function normalizeCameras(data: unknown) {
  return normalizeEquipmentPoints<Camera>(data);
}

export function normalizeCamerasIntel(data: unknown) {
  return normalizeEquipmentPoints<CameraIntel>(data).map((camera) => ({
    ...camera,
    id: cleanString(camera.id) || undefined,
    external_camera_id: cleanString(camera.external_camera_id) || null,
  }));
}

export function normalizeCamerasLpr(data: unknown) {
  return normalizeEquipmentPoints<CameraLpr>(data).map((camera) => ({
    ...camera, neighborhood: getLprNeighborhood(camera),
  }));
}

export function normalizeRadares(data: unknown) {
  return normalizeEquipmentPoints<Radar>(data);
}
