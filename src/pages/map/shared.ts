import type { CSSProperties } from "react";

let authRedirecting = false;
let refreshPromise: Promise<string | null> | null = null;

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.toString() ||
  (import.meta as any).env?.VITE_API_BASE_URL?.toString() ||
  "http://127.0.0.1:8000";

export function cleanString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanString(value);
    if (text) return text;
  }
  return "";
}

export function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const text = cleanString(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    next.push(text);
  }

  return next;
}

export function coerceCoord(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export function getLat(value: any) {
  return coerceCoord(value?.lat ?? value?.latitude ?? value?.latitud ?? value?.y);
}

export function getLng(value: any) {
  return coerceCoord(value?.lng ?? value?.lon ?? value?.long ?? value?.longitude ?? value?.longitud ?? value?.x);
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

export function getPointCollectionIdentifiers(value: any): string[] {
  return uniqueStrings([
    value?.id_ponto_coleta,
    value?.id,
    value?.code,
    value?.codcet,
  ]);
}

export function getPointCollectionKey(value: any) {
  return firstNonEmptyString(value?.id_ponto_coleta, value?.id, value?.code, value?.codcet);
}

export function getPointCollectionCode(value: any) {
  return firstNonEmptyString(value?.id_ponto_coleta, value?.code, value?.codcet, value?.id);
}

export function getPointCollectionTitle(value: any) {
  return firstNonEmptyString(
    value?.local,
    value?.logradouro,
    value?.localidade,
    value?.name,
    value?.code,
    value?.codcet
  );
}

function getStoredAccessToken() {
  return sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
}

function getStoredRefreshToken() {
  return sessionStorage.getItem("refresh_token") || localStorage.getItem("refresh_token");
}

function storeTokens(accessToken: string, refreshToken?: string | null) {
  sessionStorage.setItem("access_token", accessToken);
  localStorage.removeItem("access_token");
  if (refreshToken) {
    sessionStorage.setItem("refresh_token", refreshToken);
    localStorage.removeItem("refresh_token");
  }
  try {
    window.dispatchEvent(
      new CustomEvent("auth:tokens", {
        detail: {
          accessToken,
          refreshToken: refreshToken ?? null,
        },
      })
    );
  } catch {}
}

function clearAuthStorage() {
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("refresh_token");
  sessionStorage.removeItem("user");
  sessionStorage.removeItem("user_role");
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  localStorage.removeItem("user_role");
}

async function tryRefreshToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) return null;

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;

    const payload = await res.json().catch(() => null);
    const nextAccessToken = payload?.access_token;
    const nextRefreshToken = payload?.refresh_token;
    if (!nextAccessToken) return null;
    storeTokens(nextAccessToken, nextRefreshToken || refreshToken);
    return nextAccessToken as string;
  })()
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function withLatestAuthorization(opts: RequestInit = {}) {
  const headers = new Headers(opts.headers || {});
  const latestAccessToken = getStoredAccessToken();
  if (headers.has("Authorization") && latestAccessToken) {
    headers.set("Authorization", `Bearer ${latestAccessToken}`);
  }
  return {
    ...opts,
    headers,
  };
}

export async function fetchJson<T>(url: string, opts: RequestInit = {}) {
  let req = withLatestAuthorization(opts);
  let res = await fetch(url, req);

  if (res.status === 401) {
    const nextAccessToken = await tryRefreshToken();
    if (nextAccessToken) {
      const headers = new Headers(req.headers || {});
      if (headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${nextAccessToken}`);
      }
      req = {
        ...req,
        headers,
      };
      res = await fetch(url, req);
    }
  }

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    if (res.status === 401 && !authRedirecting) {
      authRedirecting = true;
      localStorage.setItem(
        "auth_toast",
        "Sua sessão expirou. Faça login novamente para continuar."
      );
      clearAuthStorage();
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

export function inputStyle(): CSSProperties {
  return {
    boxSizing: "border-box",
    minWidth: 0,
    maxWidth: "100%",
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    outline: "none",
    background: "rgba(255,255,255,0.95)",
    color: "rgba(0,0,0,0.88)",
  };
}
