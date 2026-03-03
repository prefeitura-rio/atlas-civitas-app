import type { CSSProperties } from "react";

let authRedirecting = false;

export async function fetchJson<T>(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, opts);
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
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("user_role");
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
