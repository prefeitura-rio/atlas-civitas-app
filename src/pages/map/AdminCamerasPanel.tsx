import { useEffect, useState } from "react";
import type { Camera, CameraIntel, CameraLpr } from "./types";
import {
  fetchJson,
  getPointCollectionCode,
  getPointCollectionIdentifiers,
  getPointCollectionKey,
  getPointCollectionTitle,
  isEntityActive,
} from "./shared";
import Swal from "sweetalert2";
import cameraIcon from "@/assets/camera-icon.png";
import cameraIntelIcon from "@/assets/cameras-inteligentes-icon.png";
import cameraLprIcon from "@/assets/camera-lpr-icon.png";

const ADMIN_PAGE_SIZE = 50;
type StatusFilter = "all" | "active" | "inactive";

function coerceCoord(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function getLat(value: any) {
  return coerceCoord(value?.lat ?? value?.latitude ?? value?.latitud ?? value?.y);
}

function getLng(value: any) {
  return coerceCoord(value?.lng ?? value?.lon ?? value?.long ?? value?.longitude ?? value?.longitud ?? value?.x);
}

export function AdminCamerasPanel({
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
  const CAMS_URL = `${apiBase}/cameras`;
  const CAMS_INTEL_URL = `${apiBase}/cameras-inteligentes`;
  const CAMS_LPR_URL = `${apiBase}/cameras-lpr`;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Camera[]>([]);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelItems, setIntelItems] = useState<CameraIntel[]>([]);
  const [lprLoading, setLprLoading] = useState(false);
  const [lprItems, setLprItems] = useState<CameraLpr[]>([]);

  const [camTab, setCamTab] = useState<"cameras" | "civitas">("cameras");
  const [civitasTab, setCivitasTab] = useState<"inteligentes" | "lpr">("inteligentes");
  const [pageCams, setPageCams] = useState(1);
  const [pageIntel, setPageIntel] = useState(1);
  const [pageLpr, setPageLpr] = useState(1);
  const [mobileCountCams, setMobileCountCams] = useState(ADMIN_PAGE_SIZE);
  const [mobileCountIntel, setMobileCountIntel] = useState(ADMIN_PAGE_SIZE);
  const [mobileCountLpr, setMobileCountLpr] = useState(ADMIN_PAGE_SIZE);
  const [camsStatusFilter, setCamsStatusFilter] = useState<StatusFilter>("all");
  const [intelStatusFilter, setIntelStatusFilter] = useState<StatusFilter>("all");
  const [lprStatusFilter, setLprStatusFilter] = useState<StatusFilter>("all");
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

  type CameraScope = "cameras" | "inteligentes" | "lpr";

  function applyStatusFilter<T extends { is_active?: boolean; status_ativo?: boolean | number | string | null }>(
    list: T[],
    filter: StatusFilter
  ) {
    if (filter === "all") return list;
    if (filter === "active") return list.filter((item) => isEntityActive(item));
    return list.filter((item) => !isEntityActive(item));
  }

  function renderStatusFilter(value: StatusFilter, onChange: (next: StatusFilter) => void) {
    const btnStyle = (active: boolean) =>
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

    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <button type="button" style={btnStyle(value === "all")} onClick={() => onChange("all")}>
          Todos
        </button>
        <button type="button" style={btnStyle(value === "active")} onClick={() => onChange("active")}>
          Ativos
        </button>
        <button type="button" style={btnStyle(value === "inactive")} onClick={() => onChange("inactive")}>
          Desativados
        </button>
      </div>
    );
  }

  function getResourceBase(scope: CameraScope) {
    if (scope === "cameras") return CAMS_URL;
    if (scope === "inteligentes") return CAMS_INTEL_URL;
    return CAMS_LPR_URL;
  }

  function getCameraKey(item: Camera | CameraIntel | CameraLpr) {
    return getPointCollectionKey(item);
  }

  function getCameraActive(item: Camera | CameraIntel | CameraLpr) {
    return isEntityActive(item);
  }

  function patchLocalStatus(scope: CameraScope, item: Camera | CameraIntel | CameraLpr, nextActive: boolean) {
    const targetIds = new Set(getPointCollectionIdentifiers(item));
    const patch = <T extends { is_active?: boolean; status_ativo?: boolean | number | string | null }>(arr: T[]) =>
      arr.map((row) =>
        getPointCollectionIdentifiers(row as any).some((candidate) => targetIds.has(candidate))
          ? { ...row, is_active: nextActive, status_ativo: nextActive }
          : row
      );

    if (scope === "cameras") {
      setItems((prev) => patch(prev as any) as Camera[]);
      return;
    }
    if (scope === "inteligentes") {
      setIntelItems((prev) => patch(prev as any) as CameraIntel[]);
      return;
    }
    setLprItems((prev) => patch(prev as any) as CameraLpr[]);
  }

  const filteredCams = applyStatusFilter(items, camsStatusFilter);
  const filteredIntel = applyStatusFilter(intelItems, intelStatusFilter);
  const filteredLpr = applyStatusFilter(lprItems, lprStatusFilter);

  async function saveCameraStatus(scope: CameraScope, item: Camera | CameraIntel | CameraLpr, nextActive: boolean) {
    const baseUrl = getResourceBase(scope);
    const authHeaders = { Authorization: `Bearer ${token}` };
    const jsonHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const body = JSON.stringify({ is_active: nextActive });
    const candidates = getPointCollectionIdentifiers(item);
    if (!candidates.length) {
      throw new Error("Não foi possível identificar esta câmera para atualizar o status.");
    }

    let lastErr: any = null;
    for (const key of candidates) {
      const encoded = encodeURIComponent(key);
      const attempts = [
        () =>
          fetchJson<any>(`${baseUrl}/${encoded}`, {
            method: "PUT",
            headers: jsonHeaders,
            body,
          }),
        () =>
          fetchJson<any>(`${baseUrl}/${encoded}`, {
            method: "PATCH",
            headers: jsonHeaders,
            body,
          }),
        () =>
          fetchJson<any>(`${baseUrl}/${encoded}/${nextActive ? "reactivate" : "deactivate"}`, {
            method: "POST",
            headers: authHeaders,
          }),
      ];

      for (const run of attempts) {
        try {
          await run();
          return;
        } catch (err: any) {
          lastErr = err;
        }
      }
    }
    throw lastErr || new Error("Falha ao atualizar status da câmera.");
  }

  async function toggleCameraStatus(scope: CameraScope, item: Camera | CameraIntel | CameraLpr) {
    const key = getCameraKey(item);
    if (!key) {
      setErr("Não foi possível identificar esta câmera para atualizar o status.");
      return;
    }
    const name = getPointCollectionTitle(item) || "câmera";
    const isActive = getCameraActive(item);
    const nextActive = !isActive;

    const result = await Swal.fire({
      ...swalBase,
      icon: "warning",
      title: nextActive ? "Ativar câmera?" : "Desativar câmera?",
      text: nextActive
        ? "Ela voltará a aparecer no mapa assim que a atualização automática for aplicada."
        : "Ao desativar, essa câmera deixará de aparecer no mapa.",
      showCancelButton: true,
      confirmButtonText: nextActive ? "Sim, ativar" : "Sim, desativar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: nextActive ? "#15803d" : "#b91c1c",
      cancelButtonColor: "#334155",
      reverseButtons: true,
      focusCancel: true,
      footer: `Câmera: <strong>${name}</strong>`,
    });
    if (!result.isConfirmed) return;

    setErr(null);
    setStatusLoadingKey(`${scope}:${key}`);
    try {
      await saveCameraStatus(scope, item, nextActive);
      patchLocalStatus(scope, item, nextActive);
      onStatusChanged?.();

      await Swal.fire({
        ...swalBase,
        icon: "success",
        title: nextActive ? "Câmera ativada" : "Câmera desativada",
        text: nextActive
          ? "Tudo certo. Ela ficará disponível no mapa novamente."
          : "Pronto. Ela sairá do mapa após a atualização.",
        timer: 1700,
        showConfirmButton: false,
      });
    } catch (e: any) {
      const msg = e?.message || "Não foi possível atualizar o status desta câmera.";
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
      const data = await fetchJson<any>(CAMS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list: Camera[] = Array.isArray(data) ? data : [];
      const normalized = list
        .map((c) => {
          const lat = getLat(c);
          const lng = getLng(c);
          return { ...c, lat: lat ?? NaN, lng: lng ?? NaN };
        })
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
      setItems(normalized);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar câmeras");
    } finally {
      setLoading(false);
    }
  }

  async function loadIntel() {
    setIntelLoading(true);
    try {
      const data = await fetchJson<any>(CAMS_INTEL_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list: CameraIntel[] = Array.isArray(data) ? data : [];
      const normalized = list
        .map((c) => {
          const lat = getLat(c);
          const lng = getLng(c);
          return { ...c, lat: lat ?? NaN, lng: lng ?? NaN };
        })
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
      setIntelItems(normalized);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar câmeras inteligentes");
    } finally {
      setIntelLoading(false);
    }
  }

  async function loadLpr() {
    setLprLoading(true);
    try {
      const data = await fetchJson<any>(`${CAMS_LPR_URL}?only_active=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list: CameraLpr[] = Array.isArray(data) ? data : [];
      const normalized = list
        .map((c) => {
          const lat = getLat(c);
          const lng = getLng(c);
          return { ...c, lat: lat ?? NaN, lng: lng ?? NaN };
        })
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
      setLprItems(normalized);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar câmeras LPR");
    } finally {
      setLprLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (camTab !== "civitas") return;
    if (civitasTab === "inteligentes") loadIntel();
    if (civitasTab === "lpr") loadLpr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camTab, civitasTab]);

  useEffect(() => {
    setPageCams(1);
    setPageIntel(1);
    setPageLpr(1);
    setMobileCountCams(ADMIN_PAGE_SIZE);
    setMobileCountIntel(ADMIN_PAGE_SIZE);
    setMobileCountLpr(ADMIN_PAGE_SIZE);
  }, [
    camTab,
    civitasTab,
    items.length,
    intelItems.length,
    lprItems.length,
    camsStatusFilter,
    intelStatusFilter,
    lprStatusFilter,
  ]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {!isMobile ? (
        <div className="tabsRail tabsRailSection">
          <button className={`subTab ${camTab === "cameras" ? "subTabActive" : ""}`} onClick={() => setCamTab("cameras")}>
            Câmeras
          </button>
          <button className={`subTab ${camTab === "civitas" ? "subTabActive" : ""}`} onClick={() => setCamTab("civitas")}>
            Câmeras Civitas
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 6,
            padding: "10px 12px",
            borderRadius: 16,
            border: "1px solid rgba(10,40,75,0.08)",
            background: "rgba(255,255,255,0.88)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: "rgba(10,40,75,0.58)" }}>ORIGEM</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { key: "cameras" as const, label: "Câmeras" },
              { key: "civitas" as const, label: "Câmeras Civitas" },
            ].map((option) => {
              const active = camTab === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setCamTab(option.key)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 999,
                    border: active ? "1px solid rgba(10,40,75,0.16)" : "1px solid rgba(15,23,42,0.12)",
                    background: active ? "rgba(10,40,75,0.10)" : "rgba(255,255,255,0.96)",
                    color: active ? "#0a284b" : "rgba(10,40,75,0.76)",
                    fontSize: 11,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {camTab === "civitas" && (
        !isMobile ? (
          <div className="tabsRail tabsRailSection tabsRailCompact">
            <button
              className={`subTab ${civitasTab === "inteligentes" ? "subTabActive" : ""}`}
              onClick={() => setCivitasTab("inteligentes")}
            >
              Inteligentes
            </button>
            <button className={`subTab ${civitasTab === "lpr" ? "subTabActive" : ""}`} onClick={() => setCivitasTab("lpr")}>
              LPR
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 6,
              padding: "10px 12px",
              borderRadius: 16,
              border: "1px solid rgba(10,40,75,0.08)",
              background: "rgba(255,255,255,0.88)",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: "rgba(10,40,75,0.58)" }}>TIPO</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { key: "inteligentes" as const, label: "Inteligentes" },
                { key: "lpr" as const, label: "LPR" },
              ].map((option) => {
                const active = civitasTab === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setCivitasTab(option.key)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 999,
                      border: active ? "1px solid rgba(10,40,75,0.16)" : "1px solid rgba(15,23,42,0.12)",
                      background: active ? "rgba(10,40,75,0.10)" : "rgba(255,255,255,0.96)",
                      color: active ? "#0a284b" : "rgba(10,40,75,0.76)",
                      fontSize: 11,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )
      )}

      {err && (
        <div style={{ fontSize: 12, opacity: 0.9, color: "#991b1b" }}>
          {err}
        </div>
      )}

      {camTab === "cameras" && (
        <>
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
              <div style={{ fontWeight: 900, fontSize: 13 }}>Câmeras</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{loading ? "Carregando..." : `${filteredCams.length} itens`}</div>
              <div style={{ flex: 1 }} />
              {renderStatusFilter(camsStatusFilter, setCamsStatusFilter)}
            </div>

            <div
              className="scrollbarHidden"
              style={{ display: "grid", gap: 8, maxHeight: "50vh", overflow: "auto" }}
              onScroll={(e) => {
                if (!isMobile) return;
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                  setMobileCountCams((v) => v + ADMIN_PAGE_SIZE);
                }
              }}
            >
              {(isMobile
                ? filteredCams.slice(0, mobileCountCams)
                : filteredCams.slice((pageCams - 1) * ADMIN_PAGE_SIZE, pageCams * ADMIN_PAGE_SIZE)
              ).map((c) => {
                const key = getCameraKey(c);
                const active = getCameraActive(c);
                const loadingStatus = statusLoadingKey === `cameras:${key}`;
                return (
                  <div
                    key={key || c.id || c.code}
                    className="adminRow"
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
                        border: "1px solid rgba(59,130,246,0.30)",
                        background: "rgba(219,234,254,0.90)",
                        display: "grid",
                        placeItems: "center",
                        flex: "0 0 auto",
                      }}
                    >
                      <img src={cameraIcon} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
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
                          {c.name}
                        </div>
                      <span
                        style={{
                          ...chipStyle,
                          borderColor: "rgba(59,130,246,0.32)",
                          background: "rgba(219,234,254,0.92)",
                          color: "#1d4ed8",
                        }}
                      >
                          {getPointCollectionCode(c)}
                      </span>
                    </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        <span style={chipStyle}>
                          {String((c as any).zona_camera ?? (c as any).zone ?? "").trim() ||
                            [c.city, c.uf].filter(Boolean).join(" - ") ||
                            "-"}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "grid", justifyItems: "end", gap: 6, flex: "0 0 auto" }}>
                      <button
                        type="button"
                        onClick={() => toggleCameraStatus("cameras", c)}
                        disabled={loadingStatus}
                        style={statusSwitchStyle(active, loadingStatus)}
                        title={active ? "Desativar câmera" : "Ativar câmera"}
                        aria-label={active ? "Desativar câmera" : "Ativar câmera"}
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

              {!filteredCams.length && !loading && (
                <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma câmera encontrada.</div>
              )}
            </div>

            {!isMobile && filteredCams.length > ADMIN_PAGE_SIZE && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
                <button
                  className="btnGhost"
                  onClick={() => setPageCams((v) => Math.max(1, v - 1))}
                  disabled={pageCams <= 1}
                  style={{ opacity: pageCams <= 1 ? 0.5 : 1 }}
                >
                  Anterior
                </button>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Página {pageCams} de {Math.max(1, Math.ceil(filteredCams.length / ADMIN_PAGE_SIZE))}
                </div>
                <button
                  className="btnGhost"
                  onClick={() => setPageCams((v) => Math.min(Math.ceil(filteredCams.length / ADMIN_PAGE_SIZE), v + 1))}
                  disabled={pageCams >= Math.ceil(filteredCams.length / ADMIN_PAGE_SIZE)}
                  style={{ opacity: pageCams >= Math.ceil(filteredCams.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {camTab === "civitas" && civitasTab === "inteligentes" && (
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
            <div style={{ fontWeight: 900, fontSize: 13 }}>Super Câmeras Inteligentes</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {intelLoading ? "Carregando..." : `${filteredIntel.length} itens`}
            </div>
            <div style={{ flex: 1 }} />
            {renderStatusFilter(intelStatusFilter, setIntelStatusFilter)}
          </div>
          <div
            className="scrollbarHidden"
            style={{ display: "grid", gap: 8, maxHeight: "50vh", overflow: "auto" }}
            onScroll={(e) => {
              if (!isMobile) return;
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                setMobileCountIntel((v) => v + ADMIN_PAGE_SIZE);
              }
            }}
          >
            {(isMobile
              ? filteredIntel.slice(0, mobileCountIntel)
              : filteredIntel.slice((pageIntel - 1) * ADMIN_PAGE_SIZE, pageIntel * ADMIN_PAGE_SIZE)
            ).map((c) => {
              const key = getCameraKey(c);
              const active = getCameraActive(c);
              const loadingStatus = statusLoadingKey === `inteligentes:${key}`;
              return (
                <div
                  key={key || c.id || c.code}
                  className="adminRow"
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
                    <img src={cameraIntelIcon} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
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
                        {c.name}
                      </div>
                      <span
                        style={{
                          ...chipStyle,
                          borderColor: "rgba(234,88,12,0.30)",
                          background: "rgba(255,237,213,0.92)",
                          color: "#c2410c",
                        }}
                      >
                        {getPointCollectionCode(c)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={chipStyle}>Responsável: {c.responsavel || (c as any).responsavel || "-"}</span>
                      <span style={chipStyle}>Direção: {c.direction || "-"}</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", justifyItems: "end", gap: 6, flex: "0 0 auto" }}>
                    <button
                      type="button"
                      onClick={() => toggleCameraStatus("inteligentes", c)}
                      disabled={loadingStatus}
                      style={statusSwitchStyle(active, loadingStatus)}
                      title={active ? "Desativar câmera inteligente" : "Ativar câmera inteligente"}
                      aria-label={active ? "Desativar câmera inteligente" : "Ativar câmera inteligente"}
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
            {!filteredIntel.length && !intelLoading && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma Super Câmera Inteligente encontrada.</div>
            )}
          </div>

          {!isMobile && filteredIntel.length > ADMIN_PAGE_SIZE && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
              <button
                className="btnGhost"
                onClick={() => setPageIntel((v) => Math.max(1, v - 1))}
                disabled={pageIntel <= 1}
                style={{ opacity: pageIntel <= 1 ? 0.5 : 1 }}
              >
                Anterior
              </button>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Página {pageIntel} de {Math.max(1, Math.ceil(filteredIntel.length / ADMIN_PAGE_SIZE))}
              </div>
              <button
                className="btnGhost"
                onClick={() => setPageIntel((v) => Math.min(Math.ceil(filteredIntel.length / ADMIN_PAGE_SIZE), v + 1))}
                disabled={pageIntel >= Math.ceil(filteredIntel.length / ADMIN_PAGE_SIZE)}
                style={{ opacity: pageIntel >= Math.ceil(filteredIntel.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      {camTab === "civitas" && civitasTab === "lpr" && (
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
            <div style={{ fontWeight: 900, fontSize: 13 }}>Câmeras LPR</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {lprLoading ? "Carregando..." : `${filteredLpr.length} itens`}
            </div>
            <div style={{ flex: 1 }} />
            {renderStatusFilter(lprStatusFilter, setLprStatusFilter)}
          </div>
          <div
            className="scrollbarHidden"
            style={{ display: "grid", gap: 8, maxHeight: "50vh", overflow: "auto" }}
            onScroll={(e) => {
              if (!isMobile) return;
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                setMobileCountLpr((v) => v + ADMIN_PAGE_SIZE);
              }
            }}
          >
            {(isMobile
              ? filteredLpr.slice(0, mobileCountLpr)
              : filteredLpr.slice((pageLpr - 1) * ADMIN_PAGE_SIZE, pageLpr * ADMIN_PAGE_SIZE)
            ).map((c) => {
              const key = getCameraKey(c);
              const active = getCameraActive(c);
              const loadingStatus = statusLoadingKey === `lpr:${key}`;
              return (
                <div
                  key={key || c.id || c.code}
                  className="adminRow"
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
                      border: "1px solid rgba(22,163,74,0.30)",
                      background: "rgba(220,252,231,0.92)",
                      display: "grid",
                      placeItems: "center",
                      flex: "0 0 auto",
                    }}
                  >
                    <img src={cameraLprIcon} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
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
                        {c.name}
                      </div>
                      <span
                        style={{
                          ...chipStyle,
                          borderColor: "rgba(22,163,74,0.30)",
                          background: "rgba(220,252,231,0.92)",
                          color: "#166534",
                        }}
                      >
                        {getPointCollectionCode(c)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={chipStyle}>Local: {getPointCollectionTitle(c) || "-"}</span>
                      <span style={chipStyle}>Bairro: {c.bairro || c.neighborhood || "-"}</span>
                      <span style={chipStyle}>Sentido: {c.sentido || c.direction || "-"}</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", justifyItems: "end", gap: 6, flex: "0 0 auto" }}>
                    <button
                      type="button"
                      onClick={() => toggleCameraStatus("lpr", c)}
                      disabled={loadingStatus}
                      style={statusSwitchStyle(active, loadingStatus)}
                      title={active ? "Desativar câmera LPR" : "Ativar câmera LPR"}
                      aria-label={active ? "Desativar câmera LPR" : "Ativar câmera LPR"}
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
            {!filteredLpr.length && !lprLoading && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma câmera LPR encontrada.</div>
            )}
          </div>

          {!isMobile && filteredLpr.length > ADMIN_PAGE_SIZE && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
              <button
                className="btnGhost"
                onClick={() => setPageLpr((v) => Math.max(1, v - 1))}
                disabled={pageLpr <= 1}
                style={{ opacity: pageLpr <= 1 ? 0.5 : 1 }}
              >
                Anterior
              </button>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Página {pageLpr} de {Math.max(1, Math.ceil(filteredLpr.length / ADMIN_PAGE_SIZE))}
              </div>
              <button
                className="btnGhost"
                onClick={() => setPageLpr((v) => Math.min(Math.ceil(filteredLpr.length / ADMIN_PAGE_SIZE), v + 1))}
                disabled={pageLpr >= Math.ceil(filteredLpr.length / ADMIN_PAGE_SIZE)}
                style={{ opacity: pageLpr >= Math.ceil(filteredLpr.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
