import { useEffect, useState } from "react";
import type { Radar } from "./types";
import {
  fetchJson,
  getLat,
  getLng,
  getPointCollectionCode,
  getPointCollectionIdentifiers,
  getPointCollectionKey,
  getPointCollectionTitle,
  isEntityActive,
} from "./shared";
import Swal from "sweetalert2";
import radarIcon from "@/assets/radar-icon.png";

const ADMIN_PAGE_SIZE = 50;
type StatusFilter = "all" | "active" | "inactive";

export function AdminRadaresPanel({
  apiBase,
  token,
  onStatusChanged,
  isMobile,
}: {
  apiBase: string;
  token: string;
  onStatusChanged?: () => void;
  isMobile: boolean;
}) {
  const RADARES_URL = `${apiBase}/radares`;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Radar[]>([]);
  const [page, setPage] = useState(1);
  const [mobileCount, setMobileCount] = useState(ADMIN_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [statusLoadingKey, setStatusLoadingKey] = useState<string | null>(null);
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
  const statusSwitchStyle = (active: boolean, disabled: boolean) =>
    ({
      width: 46,
      height: 28,
      borderRadius: 999,
      border: active ? "1px solid rgba(22,163,74,0.65)" : "1px solid rgba(100,116,139,0.42)",
      background: active ? "linear-gradient(135deg, #34d399, #22c55e)" : "linear-gradient(135deg, #d4d4d8, #cbd5e1)",
      position: "relative",
      padding: 0,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all .2s ease",
      boxShadow: active ? "0 6px 16px rgba(34,197,94,0.28)" : "0 4px 12px rgba(15,23,42,0.12)",
      opacity: disabled ? 0.7 : 1,
    }) as const;
  const statusKnobStyle = (active: boolean) =>
    ({
      position: "absolute",
      top: 2,
      left: active ? 20 : 2,
      width: 22,
      height: 22,
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "0 3px 8px rgba(15,23,42,0.22)",
      transition: "left .2s ease",
    }) as const;
  const filterBtnStyle = (active: boolean) =>
    ({
      padding: "4px 10px",
      borderRadius: 999,
      border: active ? "1px solid rgba(15,23,42,0.3)" : "1px solid rgba(15,23,42,0.14)",
      background: active ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.92)",
      color: active ? "#0f172a" : "rgba(15,23,42,0.72)",
      fontSize: 11,
      fontWeight: 800,
      cursor: "pointer",
    }) as const;
  const swalBase = {
    customClass: {
      popup: "atlasSwalPopup",
      title: "atlasSwalTitle",
      htmlContainer: "atlasSwalHtml",
      footer: "atlasSwalFooter",
      confirmButton: "atlasSwalBtn atlasSwalBtnPrimary",
      cancelButton: "atlasSwalBtn atlasSwalBtnGhost",
    },
    buttonsStyling: false,
    backdrop: "rgba(2, 6, 23, 0.74)",
  } as const;

  function getRadarActive(radar: Radar) {
    return isEntityActive(radar);
  }

  function applyStatusFilter(list: Radar[], filter: StatusFilter) {
    if (filter === "all") return list;
    if (filter === "active") return list.filter((r) => getRadarActive(r));
    return list.filter((r) => !getRadarActive(r));
  }

  function getRadarKey(radar: Radar) {
    return getPointCollectionKey(radar);
  }

  async function saveRadarStatus(radar: Radar, nextActive: boolean) {
    const action = nextActive ? "reactivate" : "deactivate";
    const candidates = getPointCollectionIdentifiers(radar);
    if (!candidates.length) {
      throw new Error("Não foi possível identificar este radar para atualizar o status.");
    }

    let lastErr: any = null;
    for (const key of candidates) {
      try {
        await fetchJson(`${RADARES_URL}/${encodeURIComponent(key)}/${action}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        return;
      } catch (err: any) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("Falha ao atualizar status do radar.");
  }

  function patchLocalStatus(radar: Radar, nextActive: boolean) {
    const targetIds = new Set(getPointCollectionIdentifiers(radar));
    setItems((prev) =>
      prev.map((row) =>
        getPointCollectionIdentifiers(row).some((candidate) => targetIds.has(candidate))
          ? {
              ...row,
              is_active: nextActive,
              status_ativo: nextActive,
              status: nextActive ? "ATIVO" : "INATIVO",
            }
          : row
      )
    );
  }

  const filteredItems = applyStatusFilter(items, statusFilter);

  async function toggleRadarStatus(radar: Radar) {
    const key = getRadarKey(radar);
    if (!key) {
      setErr("Não foi possível identificar este radar para atualizar o status.");
      return;
    }
    const active = getRadarActive(radar);
    const nextActive = !active;
    const radarName = getPointCollectionTitle(radar) || "Radar";

    const confirm = await Swal.fire({
      ...swalBase,
      icon: "warning",
      title: nextActive ? "Ativar radar?" : "Desativar radar?",
      text: nextActive
        ? "Ele voltará a aparecer no mapa assim que a atualização automática for aplicada."
        : "Ao desativar, esse radar deixará de aparecer no mapa.",
      showCancelButton: true,
      confirmButtonText: nextActive ? "Sim, ativar" : "Sim, desativar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      focusCancel: true,
      footer: `Radar: <strong>${radarName}</strong>`,
    });
    if (!confirm.isConfirmed) return;

    setErr(null);
    setStatusLoadingKey(key);
    try {
      await saveRadarStatus(radar, nextActive);
      patchLocalStatus(radar, nextActive);
      onStatusChanged?.();
      await Swal.fire({
        ...swalBase,
        icon: "success",
        title: nextActive ? "Radar ativado" : "Radar desativado",
        text: nextActive
          ? "Tudo certo. Ele ficará disponível no mapa novamente."
          : "Pronto. Ele sairá do mapa após a atualização.",
        timer: 1700,
        showConfirmButton: false,
      });
    } catch (e: any) {
      const msg = e?.message || "Não foi possível atualizar o status deste radar.";
      setErr(msg);
      await Swal.fire({
        ...swalBase,
        icon: "error",
        title: "Não foi possível concluir",
        text: msg,
        confirmButtonText: "Fechar",
      });
    } finally {
      setStatusLoadingKey(null);
    }
  }

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchJson<any>(`${RADARES_URL}?only_active=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list: Radar[] = Array.isArray(data) ? data : [];

      const normalized = list
        .map((r) => ({
          ...r,
          lat: getLat(r) ?? NaN,
          lng: getLng(r) ?? NaN,
        }))
        .filter((r) => Number.isFinite(r.lat as any) && Number.isFinite(r.lng as any));

      setItems(normalized);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar radares");
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
  }, [items.length, statusFilter]);

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
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Radares</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{loading ? "Carregando..." : `${filteredItems.length} itens`}</div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button type="button" style={filterBtnStyle(statusFilter === "all")} onClick={() => setStatusFilter("all")}>
              Todos
            </button>
            <button
              type="button"
              style={filterBtnStyle(statusFilter === "active")}
              onClick={() => setStatusFilter("active")}
            >
              Ativos
            </button>
            <button
              type="button"
              style={filterBtnStyle(statusFilter === "inactive")}
              onClick={() => setStatusFilter("inactive")}
            >
              Desativados
            </button>
          </div>
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
            ? filteredItems.slice(0, mobileCount)
              : filteredItems.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE)
          ).map((r) => {
            const active = getRadarActive(r);
            const loadingStatus = statusLoadingKey === getRadarKey(r);
            return (
              <div
                key={getRadarKey(r) || r.codcet}
                style={{
                  ...cardRowStyle,
                  alignItems: "flex-start",
                }}
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                      <div
                        style={{
                          fontWeight: 900,
                        fontSize: 13,
                        whiteSpace: "normal",
                        overflow: "visible",
                        textOverflow: "clip",
                        wordBreak: "break-word",
                          color: "#0f172a",
                        }}
                      >
                      {getPointCollectionTitle(r) || "Radar"}
                      </div>
                      <span
                        style={{
                          ...chipStyle,
                          borderColor: "rgba(234,88,12,0.30)",
                          background: "rgba(255,237,213,0.92)",
                          color: "#c2410c",
                        }}
                      >
                      {getPointCollectionCode(r)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={chipStyle}>Local: {r.local || r.logradouro || r.localidade || "-"}</span>
                      <span style={chipStyle}>Bairro: {r.bairro || "-"}</span>
                      <span style={chipStyle}>Sentido: {r.sentido || "-"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={chipStyle}>Origem: {r.origem_equipamento || "-"}</span>
                      <span style={chipStyle}>Status: {r.status || (active ? "ATIVO" : "INATIVO")}</span>
                    </div>
                  </div>
                <div style={{ display: "grid", justifyItems: "end", gap: 6, flex: "0 0 auto" }}>
                  <button
                    type="button"
                    onClick={() => toggleRadarStatus(r)}
                    disabled={loadingStatus}
                    style={statusSwitchStyle(active, loadingStatus)}
                    title={active ? "Desativar radar" : "Ativar radar"}
                    aria-label={active ? "Desativar radar" : "Ativar radar"}
                  >
                    <span style={statusKnobStyle(active)} />
                  </button>
                  <span
                    style={{
                      ...chipStyle,
                      minWidth: 72,
                      justifyContent: "center",
                      borderColor: active ? "rgba(22,163,74,0.35)" : "rgba(100,116,139,0.30)",
                      background: active ? "rgba(220,252,231,0.95)" : "rgba(241,245,249,0.95)",
                      color: active ? "#166534" : "#475569",
                    }}
                  >
                    {active ? "ATIVO" : "INATIVO"}
                  </span>
                </div>
              </div>
            );
          })}

          {!filteredItems.length && !loading && <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhum radar encontrado.</div>}
        </div>

        {!isMobile && filteredItems.length > ADMIN_PAGE_SIZE && (
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
              Página {page} de {Math.max(1, Math.ceil(filteredItems.length / ADMIN_PAGE_SIZE))}
            </div>
            <button
              className="btnGhost"
              onClick={() => setPage((v) => Math.min(Math.ceil(filteredItems.length / ADMIN_PAGE_SIZE), v + 1))}
              disabled={page >= Math.ceil(filteredItems.length / ADMIN_PAGE_SIZE)}
              style={{ opacity: page >= Math.ceil(filteredItems.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
      {err && (
        <div style={{ fontSize: 12, opacity: 0.9, color: "#991b1b" }}>
          {err}
        </div>
      )}
    </div>
  );
}
