import { useEffect, useState } from "react";
import type { Camera, CameraIntel, CameraLpr } from "./types";
import { fetchJson } from "./shared";
import cameraIcon from "@/assets/camera-icon.png";
import cameraIntelIcon from "@/assets/cameras-inteligentes-icon.png";
import cameraLprIcon from "@/assets/camera-lpr-icon.png";

const ADMIN_PAGE_SIZE = 50;
const SYNC_DISABLED_NOTICE = "Disponível na versão 2.0 do CIVITAS Map";

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
  onSynced,
  isMobile,
}: {
  apiBase: string;
  token: string;
  onSynced?: () => void;
  isMobile: boolean;
}) {
  const CAMS_URL = `${apiBase}/api/v1/cameras`;
  const SYNC_CAMERAS_URL = `${apiBase}/api/v1/sync/cameras`;
  const SYNC_CAMS_INTEL_URL = `${apiBase}/api/v1/sync/cameras-inteligentes`;
  const SYNC_CAMS_LPR_URL = `${apiBase}/api/v1/sync/cameras-lpr`;
  const CAMS_INTEL_URL = `${apiBase}/api/v1/cameras-inteligentes`;
  const CAMS_LPR_URL = `${apiBase}/api/v1/cameras-lpr`;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Camera[]>([]);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelItems, setIntelItems] = useState<CameraIntel[]>([]);
  const [lprLoading, setLprLoading] = useState(false);
  const [lprItems, setLprItems] = useState<CameraLpr[]>([]);

  const [deactivateMissing, setDeactivateMissing] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [camTab, setCamTab] = useState<"cameras" | "civitas">("cameras");
  const [civitasTab, setCivitasTab] = useState<"inteligentes" | "lpr">("inteligentes");
  const [pageCams, setPageCams] = useState(1);
  const [pageIntel, setPageIntel] = useState(1);
  const [pageLpr, setPageLpr] = useState(1);
  const [mobileCountCams, setMobileCountCams] = useState(ADMIN_PAGE_SIZE);
  const [mobileCountIntel, setMobileCountIntel] = useState(ADMIN_PAGE_SIZE);
  const [mobileCountLpr, setMobileCountLpr] = useState(ADMIN_PAGE_SIZE);
  const syncDisabled = true;


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
      const data = await fetchJson<any>(CAMS_LPR_URL, {
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
  }, [camTab, civitasTab, items.length, intelItems.length, lprItems.length]);

  async function runSyncCameras() {
    setSyncMsg(null);
    setErr(null);

    setSyncLoading(true);
    try {
      const resp = await fetchJson<any>(SYNC_CAMERAS_URL, {
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
        formatSyncMsg(resp?.result)
      );

      await load();
      onSynced?.();
    } catch (e: any) {
      setSyncMsg(null);
      setErr(e?.message || "Erro na sincronização de câmeras");
    } finally {
      setSyncLoading(false);
    }
  }

  async function runSyncCivitas() {
    setSyncMsg(null);
    setErr(null);

    setSyncLoading(true);
    try {
      const syncUrl = civitasTab === "inteligentes" ? SYNC_CAMS_INTEL_URL : SYNC_CAMS_LPR_URL;
      const resp = await fetchJson<any>(syncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deactivate_missing: !!deactivateMissing,
        }),
      });

      setSyncMsg(formatSyncMsg(resp?.result));

      if (civitasTab === "inteligentes") await loadIntel();
      if (civitasTab === "lpr") await loadLpr();
    } catch (e: any) {
      setSyncMsg(null);
      setErr(e?.message || `Erro na sincronização de ${civitasTab === "inteligentes" ? "câmeras inteligentes" : "câmeras LPR"}`);
    } finally {
      setSyncLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="tabsRail tabsRailSection">
        <button className={`subTab ${camTab === "cameras" ? "subTabActive" : ""}`} onClick={() => setCamTab("cameras")}>
          Câmeras
        </button>
        <button className={`subTab ${camTab === "civitas" ? "subTabActive" : ""}`} onClick={() => setCamTab("civitas")}>
          Câmeras Civitas
        </button>
      </div>

      {camTab === "civitas" && (
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
            <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>Sincronização de Câmeras</div>

            <div style={{ display: "grid", gap: 10 }}>
              <button
                onClick={runSyncCameras}
                disabled={syncDisabled || syncLoading}
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(0,0,0,0.86)",
                  color: "#fff",
                  cursor: syncDisabled || syncLoading ? "not-allowed" : "pointer",
                  fontWeight: 900,
                  opacity: syncDisabled || syncLoading ? 0.7 : 1,
                }}
              >
                {syncLoading ? "Sincronizando..." : "Sincronizar Câmeras"}
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
            </div>

            {syncMsg && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>{syncMsg}</div>}
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>{SYNC_DISABLED_NOTICE}</div>
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
              <div style={{ fontWeight: 900, fontSize: 13 }}>Câmeras</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{loading ? "Carregando..." : `${items.length} itens`}</div>
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
                ? items.slice(0, mobileCountCams)
                : items.slice((pageCams - 1) * ADMIN_PAGE_SIZE, pageCams * ADMIN_PAGE_SIZE)
              ).map((c) => (
                <div
                  key={c.id || c.code}
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
                        {c.code}
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
                </div>
              ))}

              {!items.length && !loading && (
                <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma câmera encontrada.</div>
              )}
            </div>

            {!isMobile && items.length > ADMIN_PAGE_SIZE && (
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
                  Página {pageCams} de {Math.max(1, Math.ceil(items.length / ADMIN_PAGE_SIZE))}
                </div>
                <button
                  className="btnGhost"
                  onClick={() => setPageCams((v) => Math.min(Math.ceil(items.length / ADMIN_PAGE_SIZE), v + 1))}
                  disabled={pageCams >= Math.ceil(items.length / ADMIN_PAGE_SIZE)}
                  style={{ opacity: pageCams >= Math.ceil(items.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        </>
      )}
      {camTab === "civitas" && (
        <div
          className="adminCard"
          style={{
            padding: 12,
            borderRadius: 16,
            background: "rgba(255,255,255,0.90)",
            border: "1px solid rgba(0,0,0,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>Sincronização de Câmeras Civitas</div>

          <div style={{ display: "grid", gap: 10 }}>
            <button
              onClick={runSyncCivitas}
              disabled={syncDisabled || syncLoading}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "rgba(0,0,0,0.86)",
                color: "#fff",
                cursor: syncDisabled || syncLoading ? "not-allowed" : "pointer",
                fontWeight: 900,
                opacity: syncDisabled || syncLoading ? 0.7 : 1,
              }}
            >
              {syncLoading
                ? "Sincronizando..."
                : civitasTab === "inteligentes"
                ? "Sincronizar Câmeras Inteligentes"
                : "Sincronizar Câmeras LPR"}
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
          </div>

          {syncMsg && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>{syncMsg}</div>}
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>{SYNC_DISABLED_NOTICE}</div>
          {err && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#991b1b" }}>{err}</div>}
        </div>
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
              {intelLoading ? "Carregando..." : `${intelItems.length} itens`}
            </div>
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
              ? intelItems.slice(0, mobileCountIntel)
              : intelItems.slice((pageIntel - 1) * ADMIN_PAGE_SIZE, pageIntel * ADMIN_PAGE_SIZE)
            ).map((c) => (
              <div
                key={c.id || c.code}
                className="adminRow"
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
                  <img src={cameraIntelIcon} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
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
                      {c.code}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={chipStyle}>Responsável: {c.responsavel || (c as any).responsavel || "-"}</span>
                    <span style={chipStyle}>Direção: {c.direction || "-"}</span>
                  </div>
                </div>
              </div>
            ))}
            {!intelItems.length && !intelLoading && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma Super Câmera Inteligente encontrada.</div>
            )}
          </div>

          {!isMobile && intelItems.length > ADMIN_PAGE_SIZE && (
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
                Página {pageIntel} de {Math.max(1, Math.ceil(intelItems.length / ADMIN_PAGE_SIZE))}
              </div>
              <button
                className="btnGhost"
                onClick={() => setPageIntel((v) => Math.min(Math.ceil(intelItems.length / ADMIN_PAGE_SIZE), v + 1))}
                disabled={pageIntel >= Math.ceil(intelItems.length / ADMIN_PAGE_SIZE)}
                style={{ opacity: pageIntel >= Math.ceil(intelItems.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
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
              {lprLoading ? "Carregando..." : `${lprItems.length} itens`}
            </div>
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
              ? lprItems.slice(0, mobileCountLpr)
              : lprItems.slice((pageLpr - 1) * ADMIN_PAGE_SIZE, pageLpr * ADMIN_PAGE_SIZE)
            ).map((c) => (
              <div
                key={c.id || c.code}
                className="adminRow"
                style={cardRowStyle}
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
                      {c.code}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={chipStyle}>Bairro: {c.neighborhood || (c as any).bairro || "-"}</span>
                    <span style={chipStyle}>Direção: {c.direction || "-"}</span>
                  </div>
                </div>
              </div>
            ))}
            {!lprItems.length && !lprLoading && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma câmera LPR encontrada.</div>
            )}
          </div>

          {!isMobile && lprItems.length > ADMIN_PAGE_SIZE && (
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
                Página {pageLpr} de {Math.max(1, Math.ceil(lprItems.length / ADMIN_PAGE_SIZE))}
              </div>
              <button
                className="btnGhost"
                onClick={() => setPageLpr((v) => Math.min(Math.ceil(lprItems.length / ADMIN_PAGE_SIZE), v + 1))}
                disabled={pageLpr >= Math.ceil(lprItems.length / ADMIN_PAGE_SIZE)}
                style={{ opacity: pageLpr >= Math.ceil(lprItems.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
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
