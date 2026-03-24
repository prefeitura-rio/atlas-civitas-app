import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { AdminOrganization } from "./types";
import { fetchJson, inputStyle } from "./shared";

const ADMIN_PAGE_SIZE = 50;

type OrganizationForm = {
  name: string;
  organization_type: string;
  acronym: string;
  jurisdiction_level: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOrganization(raw: any, idx = 0): AdminOrganization {
  const id = clean(raw?.id || raw?.organization_id || raw?.uuid || `org-${idx}`);
  return {
    id,
    name: clean(raw?.name || raw?.nome || `Organização ${idx + 1}`),
    organization_type: clean(raw?.organization_type || raw?.tipo_organizacao),
    acronym: clean(raw?.acronym || raw?.sigla),
    jurisdiction_level: clean(raw?.jurisdiction_level || raw?.nivel_jurisdicao),
    created_at: clean(raw?.created_at) || null,
    updated_at: clean(raw?.updated_at) || null,
  };
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function getInitialForm(): OrganizationForm {
  return {
    name: "",
    organization_type: "",
    acronym: "",
    jurisdiction_level: "",
  };
}

function makeUpdatePayload(original: OrganizationForm | null, current: OrganizationForm) {
  const payload: Partial<OrganizationForm> = {};
  const keys: (keyof OrganizationForm)[] = [
    "name",
    "organization_type",
    "acronym",
    "jurisdiction_level",
  ];

  for (const key of keys) {
    const nextValue = clean(current[key]);
    const prevValue = clean(original?.[key] ?? "");
    if (nextValue && nextValue !== prevValue) {
      payload[key] = nextValue;
    }
  }

  return payload;
}

export function AdminOrganizationsPanel({
  apiBase,
  token,
  isMobile,
}: {
  apiBase: string;
  token: string;
  isMobile: boolean;
}) {
  const ORGS_URL = `${apiBase}/organizations`;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [items, setItems] = useState<AdminOrganization[]>([]);

  const [orgTab, setOrgTab] = useState<"create" | "manage">("create");
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState<OrganizationForm>(getInitialForm);
  const [originalForm, setOriginalForm] = useState<OrganizationForm | null>(null);
  const [manageFilter, setManageFilter] = useState("");
  const [page, setPage] = useState(1);
  const [mobileCount, setMobileCount] = useState(ADMIN_PAGE_SIZE);

  function setField<K extends keyof OrganizationForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm(opts?: { clearMessages?: boolean }) {
    setId(null);
    setForm(getInitialForm());
    setOriginalForm(null);
    if (opts?.clearMessages !== false) {
      setErr(null);
      setSuccess(null);
    }
  }

  function applyOrganization(org: AdminOrganization) {
    const normalized: OrganizationForm = {
      name: clean(org.name),
      organization_type: clean(org.organization_type),
      acronym: clean(org.acronym),
      jurisdiction_level: clean(org.jurisdiction_level),
    };
    setId(clean(org.id) || null);
    setForm(normalized);
    setOriginalForm(normalized);
  }

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchJson<any>(ORGS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.results)
        ? data.results
        : [];

      setItems(list.map((raw: any, idx: number) => normalizeOrganization(raw, idx)));
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar organizações");
    } finally {
      setLoading(false);
    }
  }

  async function loadOne(orgId: string) {
    if (!orgId) return;
    setErr(null);
    setDetailLoading(true);
    try {
      const data = await fetchJson<any>(`${ORGS_URL}/${encodeURIComponent(orgId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      applyOrganization(normalizeOrganization(data));
    } catch {
      // Mantém dados da listagem caso o endpoint de detalhe falhe.
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    setMobileCount(ADMIN_PAGE_SIZE);
  }, [items.length, manageFilter]);

  const filteredItems = useMemo(() => {
    const q = manageFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((org) => {
      return (
        clean(org.id).toLowerCase().includes(q) ||
        clean(org.name).toLowerCase().includes(q) ||
        clean(org.organization_type).toLowerCase().includes(q) ||
        clean(org.acronym).toLowerCase().includes(q) ||
        clean(org.jurisdiction_level).toLowerCase().includes(q)
      );
    });
  }, [items, manageFilter]);

  async function save() {
    setErr(null);
    setSuccess(null);

    const editingId = id;
    const current: OrganizationForm = {
      name: clean(form.name),
      organization_type: clean(form.organization_type),
      acronym: clean(form.acronym),
      jurisdiction_level: clean(form.jurisdiction_level),
    };

    if (!editingId) {
      if (!current.name || !current.organization_type || !current.acronym || !current.jurisdiction_level) {
        setErr("Preencha todos os campos: nome, tipo, sigla e nível de jurisdição.");
        return;
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        const payload = makeUpdatePayload(originalForm, current);
        if (!Object.keys(payload).length) {
          setSuccess("Nenhuma alteração para salvar.");
          setSaving(false);
          return;
        }

        await fetchJson(`${ORGS_URL}/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson(ORGS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(current),
        });
      }

      setSuccess(editingId ? "Organização atualizada com sucesso." : "Organização criada com sucesso.");
      await load();
      if (editingId) {
        await loadOne(editingId);
      } else {
        resetForm({ clearMessages: false });
      }
    } catch (e: any) {
      setErr(e?.message || "Erro ao salvar organização");
    } finally {
      setSaving(false);
    }
  }

  function pick(org: AdminOrganization) {
    setOrgTab("create");
    applyOrganization(org);
    if (org.id) loadOne(org.id);
  }

  async function removeOrganization(org: AdminOrganization) {
    const orgId = clean(org.id);
    if (!orgId) return;

    const displayName = clean(org.name) || orgId;
    const ok = confirm(`Excluir organização "${displayName}"?`);
    if (!ok) return;

    setErr(null);
    setSuccess(null);
    try {
      await fetchJson(`${ORGS_URL}/${encodeURIComponent(orgId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (id === orgId) {
        resetForm({ clearMessages: false });
      }
      setSuccess("Organização excluída com sucesso.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Erro ao excluir organização");
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="tabsRail tabsRailSection tabsRailCompact">
        <button className={`subTab ${orgTab === "create" ? "subTabActive" : ""}`} onClick={() => setOrgTab("create")}>
          Criar Organização
        </button>
        <button className={`subTab ${orgTab === "manage" ? "subTabActive" : ""}`} onClick={() => setOrgTab("manage")}>
          Gerenciar Organizações
        </button>
      </div>

      {orgTab === "create" && (
        <div
          className="adminCard"
          style={{
            padding: 12,
            borderRadius: 16,
            background: "rgba(255,255,255,0.90)",
            border: "1px solid rgba(0,0,0,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>
            {id ? "Editar organização" : "Criar organização"}
          </div>

          <div
            className="adminGrid2"
            style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}
          >
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="nome da organização"
              style={inputStyle()}
            />
            <input
              value={form.organization_type}
              onChange={(e) => setField("organization_type", e.target.value)}
              placeholder="tipo da organização"
              style={inputStyle()}
            />
            <input
              value={form.acronym}
              onChange={(e) => setField("acronym", e.target.value)}
              placeholder="sigla"
              style={inputStyle()}
            />
            <input
              value={form.jurisdiction_level}
              onChange={(e) => setField("jurisdiction_level", e.target.value)}
              placeholder="nível de jurisdição"
              style={inputStyle()}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "rgba(0,0,0,0.86)",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 900,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Salvando..." : id ? "Salvar alterações" : "Criar organização"}
            </button>

            <button
              onClick={() => resetForm()}
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
              Limpar
            </button>
          </div>

          {detailLoading && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>Carregando detalhes...</div>}
          {err && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#991b1b" }}>{err}</div>}
          {success && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#166534" }}>{success}</div>}
        </div>
      )}

      {orgTab === "manage" && (
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
            <div style={{ fontWeight: 900, fontSize: 13 }}>Organizações</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {loading ? "Carregando..." : `${filteredItems.length} de ${items.length} itens`}
            </div>
          </div>

          <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={manageFilter}
              onChange={(e) => setManageFilter(e.target.value)}
              placeholder="Filtrar por nome, tipo, sigla, jurisdição ou ID"
              style={{ ...inputStyle(), flex: 1, minWidth: 0 }}
            />
            <button
              onClick={load}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "rgba(255,255,255,0.90)",
                cursor: "pointer",
                color: "rgba(0,0,0,0.78)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
              title="Recarregar organizações"
              aria-label="Recarregar organizações"
            >
              <RefreshCw size={16} />
            </button>
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
            ).map((org) => (
              <div
                key={org.id}
                className="adminRow"
                style={{
                  border: "1px solid rgba(0,0,0,0.10)",
                  borderRadius: 14,
                  padding: 10,
                  background: "rgba(255,255,255,0.75)",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 13,
                        whiteSpace: "normal",
                        overflow: "visible",
                        textOverflow: "clip",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                      }}
                    >
                      {org.name || "Organização"}
                    </div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: 999,
                        padding: "2px 8px",
                        fontSize: 10,
                        fontWeight: 800,
                        border: "1px solid rgba(15,23,42,0.14)",
                        background: "rgba(241,245,249,0.95)",
                        color: "#334155",
                      }}
                    >
                      {org.acronym || "-"}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.75,
                      marginTop: 2,
                      whiteSpace: "normal",
                      overflow: "visible",
                      textOverflow: "clip",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    Tipo: {org.organization_type || "-"} • Jurisdição: {org.jurisdiction_level || "-"}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.68,
                      marginTop: 2,
                      whiteSpace: "normal",
                      overflow: "visible",
                      textOverflow: "clip",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {org.created_at ? ` • Criada em ${formatDateTime(org.created_at)}` : ""}
                    {org.updated_at ? ` • Atualizada em ${formatDateTime(org.updated_at)}` : ""}
                  </div>
                </div>

                <button
                  onClick={() => pick(org)}
                  className="adminRowBtn"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(255,255,255,0.90)",
                    cursor: "pointer",
                    fontWeight: 900,
                    flex: "0 0 auto",
                  }}
                >
                  Editar
                </button>

                <button
                  onClick={() => removeOrganization(org)}
                  className="adminRowBtn"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(239,68,68,0.12)",
                    color: "#b91c1c",
                    cursor: "pointer",
                    fontWeight: 900,
                    flex: "0 0 auto",
                  }}
                >
                  Excluir
                </button>
              </div>
            ))}

            {!filteredItems.length && !loading && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma organização encontrada para esse filtro.</div>
            )}
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

          {err && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#991b1b" }}>{err}</div>}
          {success && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#166534" }}>{success}</div>}
        </div>
      )}
    </div>
  );
}
