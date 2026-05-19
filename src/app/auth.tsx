import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { normalizeFeatureCode, normalizeFeatureCodes } from "./featureCodes";

export type AuthUser = {
  id?: string;
  email?: string;
  full_name?: string;
  name?: string;
  role?: string;
  roles?: string[];
  matricula?: string | null;
  is_active?: boolean;
  organization_id?: string | null;
  organization_name?: string | null;
  feature_codes: string[];
  expires_at?: string | null;
  last_login_at?: string | null;
};

type AuthCtx = {
  isAuthed: boolean;
  loading: boolean;
  accessToken: string | null;
  user: AuthUser | null;
  organizationId: string | null;
  organizationName: string | null;
  featureCodes: string[];
  hasFeature: (code: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  reloadCurrentUser: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthCtx | null>(null);

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.toString() ||
  (import.meta as any).env?.VITE_API_BASE_URL?.toString() ||
  "http://127.0.0.1:8000";

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRoles(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item).toLowerCase())
    .filter(Boolean);
}

function normalizeUser(payload: any): AuthUser | null {
  if (!payload || typeof payload !== "object") return null;

  const role = cleanString(payload.role || payload.user_role).toLowerCase();
  const roles = normalizeRoles(payload.roles);
  const fullName = cleanString(payload.full_name || payload.name);
  const featureCodes = normalizeFeatureCodes(payload.feature_codes);
  const organizationId =
    cleanString(payload.organization_id || payload.organization?.id || payload.org_id) || null;
  const organizationName =
    cleanString(payload.organization_name || payload.organization?.name || payload.org_name) || null;
  const matricula = cleanString(payload.matricula) || null;

  return {
    id: cleanString(payload.id) || undefined,
    email: cleanString(payload.email) || undefined,
    full_name: fullName || undefined,
    name: fullName || undefined,
    role: role || roles[0] || undefined,
    roles: roles.length ? roles : undefined,
    matricula,
    is_active: typeof payload.is_active === "boolean" ? payload.is_active : undefined,
    organization_id: organizationId,
    organization_name: organizationName,
    feature_codes: featureCodes,
    expires_at: cleanString(payload.expires_at) || null,
    last_login_at: cleanString(payload.last_login_at) || null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuthStorage = useCallback(() => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("user_role");
    sessionStorage.removeItem("tokens");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    localStorage.removeItem("user_role");
    localStorage.removeItem("tokens");
  }, []);

  const persistUser = useCallback((nextUser: AuthUser | null) => {
    if (nextUser) {
      sessionStorage.setItem("user", JSON.stringify(nextUser));
      localStorage.removeItem("user");
      setUser(nextUser);
      const role = nextUser.role || nextUser.roles?.[0];
      if (role) {
        sessionStorage.setItem("user_role", role);
        localStorage.removeItem("user_role");
      } else {
        sessionStorage.removeItem("user_role");
        localStorage.removeItem("user_role");
      }
      return;
    }

    setUser(null);
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("user_role");
    localStorage.removeItem("user");
    localStorage.removeItem("user_role");
  }, []);

  const loadCurrentUser = useCallback(
    async (token: string) => {
      try {
        const res = await fetch(`${API_BASE}/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            clearAuthStorage();
            setAccessToken(null);
            persistUser(null);
          }
          return null;
        }

        const payload = await res.json().catch(() => null);
        const nextUser = normalizeUser(payload);
        persistUser(nextUser);
        return nextUser;
      } catch {
        return null;
      }
    },
    [clearAuthStorage, persistUser]
  );

  useEffect(() => {
    let active = true;

    const migrateItem = (key: string) => {
      const existing = sessionStorage.getItem(key);
      if (existing !== null) return existing;
      const legacy = localStorage.getItem(key);
      if (legacy !== null) {
        sessionStorage.setItem(key, legacy);
        localStorage.removeItem(key);
      }
      return legacy;
    };

    async function bootstrap() {
      const token = migrateItem("access_token");
      migrateItem("refresh_token");
      const storedUser = normalizeUser(safeJsonParse<any>(migrateItem("user")));
      migrateItem("user_role");

      if (!active) return;
      setAccessToken(token);
      setUser(storedUser);

      if (token) {
        await loadCurrentUser(token);
      }

      if (!active) return;
      setLoading(false);
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadCurrentUser]);

  const reloadCurrentUser = useCallback(async () => {
    if (!accessToken) {
      persistUser(null);
      return null;
    }
    return loadCurrentUser(accessToken);
  }, [accessToken, loadCurrentUser, persistUser]);

  async function login(email: string, password: string) {
    const body = new URLSearchParams();
    body.set("username", email);
    body.set("password", password);

    const res = await fetch(`${API_BASE}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const contentType = res.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => "");

    if (!res.ok) {
      const msg =
        (payload && (payload.detail || payload.message || payload.error)) ||
        (typeof payload === "string" && payload) ||
        `Falha no login (${res.status})`;
      throw new Error(msg);
    }

    const token =
      payload?.access_token ||
      payload?.token ||
      payload?.accessToken ||
      payload?.data?.access_token ||
      null;
    const refreshToken =
      payload?.refresh_token ||
      payload?.data?.refresh_token ||
      null;

    if (!token) {
      throw new Error("Login OK, mas não veio access_token na resposta.");
    }

    sessionStorage.setItem("access_token", token);
    localStorage.removeItem("access_token");
    if (refreshToken) {
      sessionStorage.setItem("refresh_token", refreshToken);
      localStorage.removeItem("refresh_token");
    }

    setAccessToken(token);
    await loadCurrentUser(token);
  }

  function logout() {
    clearAuthStorage();
    setAccessToken(null);
    setUser(null);
  }

  useEffect(() => {
    const onTokens = (event: Event) => {
      const custom = event as CustomEvent<{ accessToken?: string | null }>;
      const nextToken = custom.detail?.accessToken;
      if (typeof nextToken === "string" && nextToken) {
        setAccessToken(nextToken);
        void loadCurrentUser(nextToken);
      }
    };

    window.addEventListener("auth:tokens", onTokens as EventListener);
    return () => window.removeEventListener("auth:tokens", onTokens as EventListener);
  }, [loadCurrentUser]);

  const featureCodes = user?.feature_codes || [];
  const organizationId = user?.organization_id || null;
  const organizationName = user?.organization_name || null;
  const hasFeature = useCallback(
    (code: string) => {
      const normalized = normalizeFeatureCode(code);
      if (!normalized) return false;
      return featureCodes.includes(normalized);
    },
    [featureCodes]
  );

  const isAuthed = !!accessToken;

  const value = useMemo(
    () => ({
      isAuthed,
      loading,
      accessToken,
      user,
      organizationId,
      organizationName,
      featureCodes,
      hasFeature,
      login,
      logout,
      reloadCurrentUser,
    }),
    [isAuthed, loading, accessToken, user, organizationId, organizationName, featureCodes, hasFeature, reloadCurrentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
