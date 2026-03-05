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
    const storedUser = safeJsonParse<User>(migrateItem("user"));
    migrateItem("user_role");

    setAccessToken(token);
    setUser(storedUser);
    setLoading(false);
  }, []);

  function clearAuthStorage() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("user_role");
    sessionStorage.removeItem("tokens");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("user_role");
    localStorage.removeItem("tokens");
  }

  async function login(email: string, password: string) {
    // DEBUG (você vai ver isso no console)
    console.log("POST", `${API_BASE}/api/v1/auth/login`);

    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // ajuste os nomes se teu back pedir diferente
      body: JSON.stringify({ email, password }),
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

    // aceita formatos comuns:
    // { access_token: "...", user: {...} }
    // { token: "...", user: {...} }
    // ou qualquer variação parecida
    const token =
      payload?.access_token ||
      payload?.token ||
      payload?.accessToken ||
      payload?.data?.access_token ||
      null;

    if (!token) {
      throw new Error("Login OK, mas não veio access_token na resposta.");
    }

    // tenta pegar user/role se o back mandar
    const nextUser: User | null =
      payload?.user ||
      payload?.me ||
      payload?.data?.user ||
      null;

    sessionStorage.setItem("access_token", token);
    localStorage.removeItem("access_token");
    setAccessToken(token);

    if (nextUser) {
      sessionStorage.setItem("user", JSON.stringify(nextUser));
      localStorage.removeItem("user");
      setUser(nextUser);

      // opcional: se você usa user_role em algum lugar
      const role = nextUser.role || nextUser.roles?.[0];
      if (role) {
        sessionStorage.setItem("user_role", role);
        localStorage.removeItem("user_role");
      } else {
        sessionStorage.removeItem("user_role");
        localStorage.removeItem("user_role");
      }
    } else {
      setUser(null);
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("user_role");
      localStorage.removeItem("user");
      localStorage.removeItem("user_role");
    }
  }

  function logout() {
    clearAuthStorage();
    setAccessToken(null);
    setUser(null);
  }

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
