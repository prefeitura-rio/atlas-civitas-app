import { useEffect, useState } from "react";
import type { Camera, CameraIntel, CameraLpr } from "./types";
import { fetchJson } from "./shared";

const ADMIN_PAGE_SIZE = 50;
const SYNC_DISABLED_NOTICE = "Disponível na versão 2.0 do CIVITAS Map";

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
  const SYNC_CIVITAS_URL = `${apiBase}/api/v1/sync/civitas`;
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

  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  function resetForm() {
    setId(null);
    setName("");
    setCode("");
    setCity("");
    setUf("");
    setAddress("");
    setLat("");
    setLng("");
    setStreamUrl("");
    setIsActive(true);
  }

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchJson<any>(CAMS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list: Camera[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setItems(list);
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
      const list: CameraIntel[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];
      const normalized = list
        .map((c) => ({
          ...c,
          lat: Number((c as any).lat),
          lng: Number((c as any).lng),
        }))
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
      const list: CameraLpr[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];
      const normalized = list
        .map((c) => ({
          ...c,
          lat: Number((c as any).lat),
          lng: Number((c as any).lng),
        }))
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
        `SYNC OK. (created=${resp?.result?.created ?? "-"}, updated=${resp?.result?.updated ?? "-"}, deactivated=${
          resp?.result?.deactivated ?? "-"
        })`
      );

      await load();
      onSynced?.();
    } catch (e: any) {
      setSyncMsg(null);
      setErr(e?.message || "Erro no sync CÂMERAS");
    } finally {
      setSyncLoading(false);
    }
  }

  async function runSyncCivitas() {
    setSyncMsg(null);
    setErr(null);

    setSyncLoading(true);
    try {
      const resp = await fetchJson<any>(SYNC_CIVITAS_URL, {
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
        `SYNC OK. (created=${resp?.result?.created ?? "-"}, updated=${resp?.result?.updated ?? "-"}, deactivated=${
          resp?.result?.deactivated ?? "-"
        })`
      );

      if (civitasTab === "inteligentes") await loadIntel();
      if (civitasTab === "lpr") await loadLpr();
    } catch (e: any) {
      setSyncMsg(null);
      setErr(e?.message || "Erro no sync CÂMERAS CIVITAS");
    } finally {
      setSyncLoading(false);
    }
  }

  async function save() {
    setErr(null);
    if (!name.trim()) return setErr("Nome é obrigatório.");
    if (!code.trim()) return setErr("Código é obrigatório.");
    const latN = Number(lat);
    const lngN = Number(lng);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return setErr("Lat/Lng inválidos.");

    try {
      const payload = {
        name: name.trim(),
        code: code.trim(),
        city: city.trim() || null,
        uf: uf.trim() || null,
        address: address.trim() || null,
        lat: latN,
        lng: lngN,
        stream_url: streamUrl.trim() || null,
        is_active: isActive,
      };

      if (!id) {
        await fetchJson(CAMS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson(`${CAMS_URL}/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      resetForm();
      load();
      onSynced?.();
    } catch (e: any) {
      setErr(e?.message || "Erro ao salvar câmera");
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`subTab ${camTab === "cameras" ? "subTabActive" : ""}`} onClick={() => setCamTab("cameras")}>
          Câmeras
        </button>
        <button className={`subTab ${camTab === "civitas" ? "subTabActive" : ""}`} onClick={() => setCamTab("civitas")}>
          Câmeras Civitas
        </button>
      </div>

      {camTab === "civitas" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
            <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>Atualizar Câmeras (SYNC)</div>

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
                {syncLoading ? "Sincronizando..." : "SYNC CÂMERAS"}
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
                Desativar no banco as que sumirem da fonte (deactivate_missing)
              </label>
            </div>

            {syncMsg && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>{syncMsg}</div>}
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>{SYNC_DISABLED_NOTICE}</div>
            {err && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#991b1b" }}>{err}</div>}

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button
                onClick={save}
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(0,0,0,0.86)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Salvar (exemplo)
              </button>
            </div>
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
                    border: "1px solid rgba(0,0,0,0.10)",
                    borderRadius: 14,
                    padding: 10,
                    background: "rgba(255,255,255,0.75)",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 13,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.name} <span style={{ opacity: 0.6 }}>({c.code})</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {c.city} - {c.uf} • {c.is_active ? "ATIVA" : "INATIVA"}
                    </div>
                  </div>
                </div>
              ))}

              {!items.length && !loading && (
                <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma câmera encontrada.</div>
              )}
            </div>

            {!isMobile && items.length > ADMIN_PAGE_SIZE && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
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
          <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>Atualizar Câmeras Civitas (SYNC)</div>

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
              {syncLoading ? "Sincronizando..." : "SYNC CÂMERAS CIVITAS"}
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
              Desativar no banco as que sumirem da fonte (deactivate_missing)
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
            <div style={{ fontWeight: 900, fontSize: 13 }}>Câmeras Inteligentes</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {intelLoading ? "Carregando..." : `${intelItems.length} itens`}
            </div>
          </div>
          <div
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
                style={{
                  border: "1px solid rgba(0,0,0,0.10)",
                  borderRadius: 14,
                  padding: 10,
                  background: "rgba(255,255,255,0.75)",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.name} <span style={{ opacity: 0.6 }}>({c.code})</span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>IP: {c.ip || "-"} • Direção: {c.direction || "-"}</div>
                </div>
              </div>
            ))}
            {!intelItems.length && !intelLoading && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma Super Câmera Inteligente encontrada.</div>
            )}
          </div>

          {!isMobile && intelItems.length > ADMIN_PAGE_SIZE && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
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
                style={{
                  border: "1px solid rgba(0,0,0,0.10)",
                  borderRadius: 14,
                  padding: 10,
                  background: "rgba(255,255,255,0.75)",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.name} <span style={{ opacity: 0.6 }}>({c.code})</span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>IP: {c.ip || "-"} • Direção: {c.direction || "-"}</div>
                </div>
              </div>
            ))}
            {!lprItems.length && !lprLoading && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma câmera LPR encontrada.</div>
            )}
          </div>

          {!isMobile && lprItems.length > ADMIN_PAGE_SIZE && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
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
