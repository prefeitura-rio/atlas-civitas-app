import { useEffect, useState } from "react";
import type { AdminLog } from "./types";
import { fetchJson } from "./shared";

const ADMIN_PAGE_SIZE = 50;

export function AdminLogsPanel({
  apiBase,
  token,
  isMobile,
}: {
  apiBase: string;
  token: string;
  isMobile: boolean;
}) {
  const LOGS_URL = `${apiBase}/logs`;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<AdminLog[]>([]);
  const [page, setPage] = useState(1);
  const [mobileCount, setMobileCount] = useState(ADMIN_PAGE_SIZE);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchJson<any>(LOGS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list: AdminLog[] = Array.isArray(data) ? data : [];
      setItems(list);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    setMobileCount(ADMIN_PAGE_SIZE);
  }, [items.length]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        className="adminCard"
        style={{
          padding: 12,
          borderRadius: 16,
          background: "rgba(255,255,255,0.90)",
          border: "1px solid rgba(0,0,0,0.10)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Logs</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{loading ? "Carregando..." : `${items.length} itens`}</div>
          <div style={{ flex: 1 }} />
          <button
            onClick={load}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(10,40,75,0.82)",
              background: "rgba(255,255,255,0.96)",
              cursor: "pointer",
              fontWeight: 900,
              color: "#0a284b",
            }}
          >
            Recarregar
          </button>
        </div>

        {err && <div style={{ marginTop: 10, fontSize: 12, color: "#991b1b" }}>{err}</div>}
      </div>

      <div
        className="adminCard"
        style={{
          padding: 12,
          borderRadius: 16,
          background: "rgba(255,255,255,0.90)",
          border: "1px solid rgba(66, 66, 66, 0.1)",
        }}
      >
        <div
          className="scrollbarHidden"
          style={{ display: "grid", gap: 8, maxHeight: "50vh", overflow: "auto" }}
          onScroll={(e) => {
            if (!isMobile) return;
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
              setMobileCount((v) => v + ADMIN_PAGE_SIZE);
            }
          }}
        >
          {(isMobile
            ? items.slice(0, mobileCount)
            : items.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE)
          ).map((l, idx) => (
            <div
              key={l.id || idx}
              style={{
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 14,
                padding: 10,
                background: "rgba(255,255,255,0.75)",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 12 }}>
                {l.message || `${l.user_email || "Usuário"} • ${l.action}`}
              </div>

              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                {l.created_at ? new Date(l.created_at).toLocaleString("pt-BR") : "-"}
                {l.entity_type ? ` • ${l.entity_type}` : ""}
                {l.target?.id_ponto_coleta ? ` • ${l.target.id_ponto_coleta}` : ""}
                {l.target?.code ? ` • ${l.target.code}` : ""}
                {l.target?.codcet ? ` • ${l.target.codcet}` : ""}
                {l.target?.email ? ` • ${l.target.email}` : ""}
              </div>
            </div>
          ))}

          {!items.length && !loading && <div style={{ fontSize: 12, opacity: 0.75 }}>Sem logs ainda.</div>}
        </div>

        {!isMobile && items.length > ADMIN_PAGE_SIZE && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
            <button
              className="btnGhost"
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              disabled={page <= 1}
              style={{ opacity: page <= 1 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Página {page} de {Math.max(1, Math.ceil(items.length / ADMIN_PAGE_SIZE))}
            </div>
            <button
              className="btnGhost"
              onClick={() => setPage((v) => Math.min(Math.ceil(items.length / ADMIN_PAGE_SIZE), v + 1))}
              disabled={page >= Math.ceil(items.length / ADMIN_PAGE_SIZE)}
              style={{ opacity: page >= Math.ceil(items.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
