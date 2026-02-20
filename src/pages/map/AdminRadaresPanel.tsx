import { useEffect, useState } from "react";
import type { Radar } from "./types";
import { fetchJson } from "./shared";

const ADMIN_PAGE_SIZE = 50;

export function AdminRadaresPanel({
  apiBase,
  token,
  onSynced,
  isMobile,
}: {
  apiBase: string;
  token: string;
  onSynced?: () => void;
  isMobile: boolean;
}) {
  const RADARES_URL = `${apiBase}/api/v1/radares`;
  const SYNC_RADARES_URL = `${apiBase}/api/v1/sync/radares`;

  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [items, setItems] = useState<Radar[]>([]);
  const [deactivateMissing, setDeactivateMissing] = useState(true);
  const [page, setPage] = useState(1);
  const [mobileCount, setMobileCount] = useState(ADMIN_PAGE_SIZE);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchJson<any>(RADARES_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list: Radar[] = Array.isArray(data) ? data : [];

      const normalized = list
        .map((r) => ({
          ...r,
          lat: r.lat === undefined || r.lat === null ? null : Number(r.lat),
          lng: r.lng === undefined || r.lng === null ? null : Number(r.lng),
        }))
        .filter((r) => Number.isFinite(r.lat as any) && Number.isFinite(r.lng as any));

      setItems(normalized);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar radares");
    } finally {
      setLoading(false);
    }
  }

  async function runSyncRadares() {
    setErr(null);
    setSyncMsg(null);

    setSyncLoading(true);
    try {
      const resp = await fetchJson<any>(SYNC_RADARES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deactivate_missing: !!deactivateMissing,
        }),
      });

      setSyncMsg(
        `Sincronização concluída. (criados=${resp?.result?.created ?? "-"}, atualizados=${resp?.result?.updated ?? "-"}, desativados=${
          resp?.result?.deactivated ?? "-"
        })`
      );

      await load();
      onSynced?.();
    } catch (e: any) {
      setErr(e?.message || "Erro na sincronização de radares");
    } finally {
      setSyncLoading(false);
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
        <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>Sincronização de Radares</div>

        <div style={{ display: "grid", gap: 10 }}>
          <button
            onClick={runSyncRadares}
            disabled={syncLoading}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(0,0,0,0.86)",
              color: "#fff",
              cursor: syncLoading ? "not-allowed" : "pointer",
              fontWeight: 900,
              opacity: syncLoading ? 0.7 : 1,
            }}
          >
            {syncLoading ? "Sincronizando..." : "Sincronizar Radares"}
          </button>

          <label
            className="adminLabelWrap"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "rgba(255,255,255,0.95)",
              fontWeight: 900,
              color: "rgba(0,0,0,0.82)",
            }}
          >
            <input
              type="checkbox"
              checked={deactivateMissing}
              onChange={(e) => setDeactivateMissing(e.target.checked)}
              style={{ transform: "scale(1.1)" }}
            />
            Desativar registros ausentes na fonte de dados
          </label>

          <button
            onClick={load}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.90)",
              cursor: "pointer",
              fontWeight: 900,
              color: "rgba(0,0,0,0.85)",
            }}
          >
            Recarregar lista
          </button>
        </div>

        {syncMsg && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>{syncMsg}</div>}
        {err && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#991b1b" }}>{err}</div>}
      </div>

      <div
        className="adminCard"
        style={{
          padding: 12,
          borderRadius: 16,
          background: "rgba(255,255,255,0.90)",
          border: "1px solid rgba(0,0,0,0.10)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Radares</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{loading ? "Carregando..." : `${items.length} itens`}</div>
        </div>

        <div
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
          ).map((r) => (
            <div
              key={r.id || r.codcet}
              style={{
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 14,
                padding: 10,
                background: "rgba(255,255,255,0.75)",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 13 }}>
                Radar <span style={{ opacity: 0.65 }}>({r.codcet})</span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.78, marginTop: 4 }}>
                {r.bairro || "-"} • {r.logradouro || r.localidade || "-"} • {r.sentido || "-"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.78, marginTop: 4 }}>
                Empresa: {r.empresa || "-"} • Vel: {r.velofisc ?? "-"} • Equip: {r.numero_equipamento || "-"} • Status:{" "}
                {r.status || (r.is_active !== false ? "ATIVO" : "INATIVO")}
              </div>
            </div>
          ))}

          {!items.length && !loading && <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhum radar encontrado.</div>}
        </div>

        {!isMobile && items.length > ADMIN_PAGE_SIZE && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
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
