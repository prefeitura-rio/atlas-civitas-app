import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type User = {
  id?: string;
  email?: string;
  role?: string;
  roles?: string[];
  name?: string;
};

type AuthCtx = {
  isAuthed: boolean;
  loading: boolean;
  accessToken: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    // carrega estado inicial do storage
    const token = migrateItem("access_token");
    migrateItem("refresh_token");
    const storedUser = safeJsonParse<User>(migrateItem("user"));
    migrateItem("user_role");

    setAccessToken(token);
    setUser(storedUser);
    setLoading(false);
  }, []);

  function clearAuthStorage() {
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
  }

  function persistUser(nextUser: User | null) {
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
  }

  async function loadCurrentUser(token: string) {
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return;
      const payload = await res.json().catch(() => null);
      const nextUser: User | null = payload
        ? {
            id: payload.id,
            email: payload.email,
            role: payload.role,
            name: payload.full_name || payload.name,
          }
        : null;
      persistUser(nextUser);
    } catch {}
  }

  async function login(email: string, password: string) {
    const body = new URLSearchParams();
    body.set("username", email);
    body.set("password", password);

    const res = await fetch(`${API_BASE}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    // tenta ler json; se falhar, lê texto
    const contentType = res.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => "");

    if (!res.ok) {
      // tenta pegar uma mensagem padrão do back
      const msg =
        (payload && (payload.detail || payload.message || payload.error)) ||
        (typeof payload === "string" && payload) ||
        `Falha no login (${res.status})`;

      // joga erro pra cair no catch do Login.tsx
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
      const next = custom.detail?.accessToken;
      if (typeof next === "string" && next) {
        setAccessToken(next);
      }
    };
    window.addEventListener("auth:tokens", onTokens as EventListener);
    return () => window.removeEventListener("auth:tokens", onTokens as EventListener);
  }, []);

  const isAuthed = !!accessToken;

  const value = useMemo(
    () => ({ isAuthed, loading, accessToken, user, login, logout }),
    [isAuthed, loading, accessToken, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
