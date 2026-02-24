import { useEffect, useState } from "react";
import type { Radar } from "./types";
import { fetchJson } from "./shared";
import radarIcon from "@/assets/radar-icon.png";

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
  const cardRowStyle = {
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 14,
    padding: 12,
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
    boxShadow: "0 6px 20px rgba(15,23,42,0.06)",
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "nowrap",
  } as const;
  const chipStyle = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "3px 9px",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.2,
    border: "1px solid rgba(15,23,42,0.14)",
    background: "rgba(248,250,252,0.95)",
    color: "rgba(15,23,42,0.85)",
  } as const;

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
          ).map((r) => (
            <div
              key={r.id || r.codcet}
              style={cardRowStyle}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  border: "1px solid rgba(234,88,12,0.30)",
                  background: "rgba(255,237,213,0.92)",
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 auto",
                }}
              >
                <img src={radarIcon} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "#0f172a",
                    }}
                  >
                    {r.logradouro || r.localidade || "Radar"}
                  </div>
                  <span
                    style={{
                      ...chipStyle,
                      borderColor: "rgba(234,88,12,0.30)",
                      background: "rgba(255,237,213,0.92)",
                      color: "#c2410c",
                    }}
                  >
                    {r.codcet}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={chipStyle}>Bairro: {r.bairro || "-"}</span>
                  <span style={chipStyle}>Sentido: {r.sentido || "-"}</span>
                  <span style={chipStyle}>Empresa: {r.empresa || "-"}</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={chipStyle}>Vel: {r.velofisc ?? "-"}</span>
                  <span style={chipStyle}>Equip: {r.numero_equipamento || "-"}</span>
                  <span style={chipStyle}>Status: {r.status || (r.is_active !== false ? "ATIVO" : "INATIVO")}</span>
                </div>
              </div>
            </div>
          ))}

          {!items.length && !loading && <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhum radar encontrado.</div>}
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
