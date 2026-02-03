import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL as string;

type Tokens = { access_token: string; refresh_token: string };

function getTokens(): Tokens | null {
  const raw = localStorage.getItem("tokens");
  if (!raw) return null;
  try { return JSON.parse(raw) as Tokens; } catch { return null; }
}
function setTokens(t: Tokens) {
  localStorage.setItem("tokens", JSON.stringify(t));
}
function clearTokens() {
  localStorage.removeItem("tokens");
}

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const tokens = getTokens();
  if (tokens?.access_token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${tokens.access_token}`;
  }
  return config;
});

let isRefreshing = false;
let pending: Array<(token: string | null) => void> = [];

function resolvePending(token: string | null) {
  pending.forEach((cb) => cb(token));
  pending = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    const original = err.config;

    // Se não for 401, só devolve
    if (status !== 401 || original?._retry) throw err;

    const tokens = getTokens();
    if (!tokens?.refresh_token) {
      clearTokens();
      throw err;
    }

    // Evita loop
    original._retry = true;

    if (isRefreshing) {
      // espera refresh terminar
      return new Promise((resolve, reject) => {
        pending.push((newToken) => {
          if (!newToken) return reject(err);
          original.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(original));
        });
      });
    }

    isRefreshing = true;

    try {
      const r = await axios.post<Tokens>(`${API_URL}/auth/refresh`, {
        refresh_token: tokens.refresh_token,
      });

      setTokens(r.data);
      resolvePending(r.data.access_token);

      original.headers.Authorization = `Bearer ${r.data.access_token}`;
      return api(original);
    } catch (e) {
      resolvePending(null);
      clearTokens();
      throw err;
    } finally {
      isRefreshing = false;
    }
  }
);
