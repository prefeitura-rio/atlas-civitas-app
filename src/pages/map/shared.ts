import type { CSSProperties } from "react";

let authRedirecting = false;
let refreshPromise: Promise<string | null> | null = null;

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.toString() ||
  (import.meta as any).env?.VITE_API_BASE_URL?.toString() ||
  "http://127.0.0.1:8000";

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
