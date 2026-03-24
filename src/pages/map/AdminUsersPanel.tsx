import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import type { AdminUser } from "./types";
import { isUserRole, roleLabel, type UserRole } from "./roles";
import { fetchJson, inputStyle } from "./shared";

const ADMIN_PAGE_SIZE = 50;
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const PASSWORD_CHARS = `${UPPER}${LOWER}`;
const SUGGESTED_PASSWORD_SIZE = 10;
type OrganizationOption = { name: string; organization_type: string };

function randomIndex(max: number) {
  if (max <= 0) return 0;
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function generateStrongPassword(size = SUGGESTED_PASSWORD_SIZE) {
  const safeSize = Math.max(2, size);
  const chars = [
    UPPER[randomIndex(UPPER.length)],
    LOWER[randomIndex(LOWER.length)],
  ];

  for (let i = chars.length; i < safeSize; i++) {
    chars.push(PASSWORD_CHARS[randomIndex(PASSWORD_CHARS.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

function getUserExpirationBadge(expiresAt?: string | null) {
  if (!expiresAt) {
    return {
      label: "Sem expiração",
      borderColor: "rgba(100,116,139,0.30)",
      background: "rgba(241,245,249,0.95)",
      color: "#475569",
    };
  }

  const expMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expMs)) {
    return {
      label: "Sem expiração",
      borderColor: "rgba(100,116,139,0.30)",
      background: "rgba(241,245,249,0.95)",
      color: "#475569",
    };
  }

  const diffMs = expMs - Date.now();
  if (diffMs <= 0) {
    return {
      label: "expirado",
      borderColor: "rgba(15,23,42,0.36)",
      background: "rgba(15,23,42,0.92)",
      color: "#f8fafc",
    };
  }

  const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (daysLeft <= 2) {
    return {
      label: `Expira em ${daysLeft}d`,
      borderColor: "rgba(239,68,68,0.35)",
      background: "rgba(254,226,226,0.95)",
      color: "#b91c1c",
    };
  }

  if (daysLeft <= 5) {
    return {
      label: `Expira em ${daysLeft}d`,
      borderColor: "rgba(245,158,11,0.35)",
      background: "rgba(254,243,199,0.95)",
      color: "#b45309",
    };
  }

  return {
    label: `Expira em ${daysLeft}d`,
    borderColor: "rgba(22,163,74,0.35)",
    background: "rgba(220,252,231,0.95)",
    color: "#166534",
  };
}

export function AdminUsersPanel({
  apiBase,
  token,
  isMobile,
  onOrgDropdownOpenChange,
}: {
  apiBase: string;
  token: string;
  isMobile: boolean;
  onOrgDropdownOpenChange?: (open: boolean) => void;
}) {
  const USERS_URL = `${apiBase}/users`;
  const ORGS_URL = `${apiBase}/organizations`;

  const [loading, setLoading] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);

  const [id, setId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [matricula, setMatricula] = useState("");
  const [unidade, setUnidade] = useState("");
  const [orgao, setOrgao] = useState("");
  const [password, setPassword] = useState("");
  const [suggestedPassword, setSuggestedPassword] = useState("");
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [role, setRole] = useState<UserRole>("user");
  const [isActive, setIsActive] = useState(true);
  const [roleOpen, setRoleOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");
  const roleWrapRef = useRef<HTMLDivElement | null>(null);
  const orgWrapRef = useRef<HTMLDivElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const passwordCopiedTimerRef = useRef<number | null>(null);
  const [userTab, setUserTab] = useState<"create" | "manage">("create");
  const [manageFilter, setManageFilter] = useState("");
  const [page, setPage] = useState(1);
  const [mobileCount, setMobileCount] = useState(ADMIN_PAGE_SIZE);

  function resetForm() {
    setId(null);
    setEmail("");
    setFullName("");
    setCpf("");
    setMatricula("");
    setUnidade("");
    setOrgao("");
    setPassword("");
    setSuggestedPassword("");
    setPasswordCopied(false);
    setRole("user");
    setIsActive(true);
    setOrgOpen(false);
    setErr(null);
    setSuccess(null);
  }

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchJson<any>(USERS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list: AdminUser[] = Array.isArray(data) ? data : [];

      setItems(list);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  async function loadOrganizations() {
    setLoadingOrgs(true);
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

      const normalized: OrganizationOption[] = list
        .map((raw: any) => ({
          name: (raw?.name ?? "").toString().trim(),
          organization_type: (raw?.organization_type ?? "").toString().trim(),
        }))
        .filter((org: OrganizationOption) => org.name);
      const dedup = Array.from(
        new Map<string, OrganizationOption>(normalized.map((org) => [org.name, org])).values()
      ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      setOrganizations(dedup);
    } catch {
      // Não bloqueia tela de usuários se organizações falhar.
      setOrganizations([]);
    } finally {
      setLoadingOrgs(false);
    }
  }

  useEffect(() => {
    load();
    loadOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    setMobileCount(ADMIN_PAGE_SIZE);
  }, [items.length, manageFilter]);

  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Node)) return;
      const roleEl = roleWrapRef.current;
      const orgEl = orgWrapRef.current;
      if (roleEl && !roleEl.contains(target)) setRoleOpen(false);
      if (orgEl && !orgEl.contains(target)) setOrgOpen(false);
    }

    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  useEffect(() => {
    return () => {
      if (!passwordCopiedTimerRef.current) return;
      window.clearTimeout(passwordCopiedTimerRef.current);
      passwordCopiedTimerRef.current = null;
    };
  }, []);

  useEffect(() => {
    onOrgDropdownOpenChange?.(orgOpen);
  }, [orgOpen, onOrgDropdownOpenChange]);

  useEffect(() => {
    return () => {
      onOrgDropdownOpenChange?.(false);
    };
  }, [onOrgDropdownOpenChange]);

  function pick(u: AdminUser) {
    setUserTab("create");
    setId(u.id);
    setEmail(u.email || "");
    setFullName(u.full_name || "");
    setCpf(formatCpf(u.cpf || ""));
    setMatricula(u.matricula || "");
    const nextOrgao = (u.orgao || "").toString();
    const matchedOrg = organizations.find((org) => org.name === nextOrgao);
    setOrgao(nextOrgao);
    setUnidade((u.unidade || matchedOrg?.organization_type || "").toString());
    setPassword("");
    setSuggestedPassword("");
    setPasswordCopied(false);
    const nextRole = (u.role || "user").toLowerCase();
    setRole(isUserRole(nextRole) ? nextRole : "user");
    setIsActive(!!u.is_active);
  }

  function refreshPasswordSuggestion() {
    if (id) return;
    setSuggestedPassword(generateStrongPassword());
  }

  function applySuggestedPassword() {
    if (!suggestedPassword || id) return;
    setPassword(suggestedPassword);
    setPasswordCopied(false);
    setErr(null);
    passwordInputRef.current?.focus();
  }

  async function copyPassword() {
    if (id) return;
    if (!password) {
      setErr("Digite uma senha para copiar.");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(password);
      } else {
        const temp = document.createElement("textarea");
        temp.value = password;
        temp.setAttribute("readonly", "true");
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      setPasswordCopied(true);
      if (passwordCopiedTimerRef.current) window.clearTimeout(passwordCopiedTimerRef.current);
      passwordCopiedTimerRef.current = window.setTimeout(() => {
        setPasswordCopied(false);
      }, 1500);
    } catch {
      setErr("Não foi possível copiar a senha.");
    }
  }

  function normalizeCpf(v: string) {
    return v.replace(/\D/g, "").slice(0, 11);
  }

  function formatCpf(v: string) {
    const d = normalizeCpf(v);
    const p1 = d.slice(0, 3);
    const p2 = d.slice(3, 6);
    const p3 = d.slice(6, 9);
    const p4 = d.slice(9, 11);
    let out = p1;
    if (p2) out += `.${p2}`;
    if (p3) out += `.${p3}`;
    if (p4) out += `-${p4}`;
    return out;
  }

  async function save() {
    setErr(null);
    setSuccess(null);

    const emailV = email.trim();
    const fullNameV = fullName.trim();
    const roleV = role.trim().toLowerCase();
    const cpfV = normalizeCpf(cpf.trim());
    const matriculaV = matricula.trim();
    const orgaoV = orgao.trim();
    const selectedOrg = organizations.find((org) => org.name === orgaoV);
    const unidadeV = (selectedOrg?.organization_type || unidade).trim();

    if (!emailV) return setErr("Email é obrigatório.");
    if (!fullNameV || fullNameV.length < 3) return setErr("Nome completo inválido.");
    if (!roleV) return setErr("Role é obrigatório (admin/user).");
    if (!isUserRole(roleV)) return setErr("Role deve ser admin ou user.");
    if (!matriculaV) return setErr("Matrícula é obrigatória.");
    if (!orgaoV) return setErr("Órgão é obrigatório.");
    if (!selectedOrg) return setErr("Selecione um órgão válido da lista.");
    if (!unidadeV) return setErr("Tipo da organização é obrigatório.");

    if (!id) {
      if (cpfV.length !== 11) return setErr("CPF deve ter 11 dígitos.");
      if (!password || password.length < 8) return setErr("Senha mínima: 8 caracteres.");
    }

    const creating = !id;

    try {
      if (creating) {
        await fetchJson(USERS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: emailV,
            full_name: fullNameV,
            cpf: cpfV,
            matricula: matriculaV,
            unidade: unidadeV || null,
            orgao: orgaoV,
            password,
            role: roleV,
          }),
        });
      } else {
        const payload: any = { is_active: isActive };
        if (emailV) payload.email = emailV;
        if (fullNameV) payload.full_name = fullNameV;
        if (roleV) payload.role = roleV;
        if (cpfV) payload.cpf = cpfV;
        if (matriculaV) payload.matricula = matriculaV;
        payload.unidade = unidadeV || null;
        if (orgaoV) payload.orgao = orgaoV;

        await fetchJson(`${USERS_URL}/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      resetForm();
      setSuccess(creating ? "Usuário criado com sucesso." : "Usuário atualizado com sucesso.");
      load();
    } catch (e: any) {
      setErr(e?.message || "Erro ao salvar usuário");
    }
  }

  async function deactivate(userId: string) {
    const ok = confirm("Desativar usuário? Ele não entra mais no sistema.");
    if (!ok) return;
    setErr(null);
    try {
      await fetchJson(`${USERS_URL}/${userId}/deactivate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (id === userId) resetForm();
      load();
    } catch (e: any) {
      setErr(e?.message || "Erro ao desativar usuário");
    }
  }

  async function reactivate(userId: string) {
    const ok = confirm("Reativar usuário?");
    if (!ok) return;
    setErr(null);
    try {
      await fetchJson(`${USERS_URL}/${userId}/reactivate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (e: any) {
      setErr(e?.message || "Erro ao reativar usuário");
    }
  }

  const normalizedManageFilter = manageFilter.trim().toLowerCase();
  const normalizedManageFilterCpf = normalizedManageFilter.replace(/\D/g, "");
  const filteredOrganizations = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter((org) => {
      const name = org.name.toLowerCase();
      const type = (org.organization_type || "").toLowerCase();
      return name.includes(q) || type.includes(q);
    });
  }, [organizations, orgSearch]);
  const shouldShowFiveOrgRows = filteredOrganizations.length >= 5;
  const selectedOrganization = organizations.find((org) => org.name === orgao);
  const selectedOrganizationType = selectedOrganization?.organization_type || "";
  const filteredItems = items.filter((u) => {
    if (!normalizedManageFilter) return true;
    const name = (u.full_name || "").toLowerCase();
    const cpfDigits = (u.cpf || "").replace(/\D/g, "");
    return name.includes(normalizedManageFilter) || (normalizedManageFilterCpf && cpfDigits.includes(normalizedManageFilterCpf));
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="tabsRail tabsRailSection tabsRailCompact">
        <button className={`subTab ${userTab === "create" ? "subTabActive" : ""}`} onClick={() => setUserTab("create")}>
          Criar Usuário
        </button>
        <button className={`subTab ${userTab === "manage" ? "subTabActive" : ""}`} onClick={() => setUserTab("manage")}>
          Gerenciar Usuários
        </button>
      </div>
      {userTab === "create" && (
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
          {id ? "Editar usuário" : "Criar usuário"}
        </div>

        <div
          className="adminGrid2"
          style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}
        >
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" style={inputStyle()} />
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="nome completo"
            style={inputStyle()}
          />

          <input
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            placeholder="cpf (11 dígitos)"
            style={inputStyle()}
          />

          <input
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            placeholder="matrícula"
            style={inputStyle()}
          />
          <div className="customSelect" ref={orgWrapRef}>
            <button
              type="button"
              className="customSelectBtn"
              onClick={() => {
                if (loadingOrgs) return;
                setOrgOpen((v) => {
                  const next = !v;
                  if (next) setOrgSearch("");
                  return next;
                });
              }}
              disabled={loadingOrgs}
              style={
                loadingOrgs
                  ? { cursor: "not-allowed", opacity: 0.75, fontWeight: 500 }
                  : { fontWeight: 500 }
              }
            >
              <span>{orgao || (loadingOrgs ? "Carregando organizações..." : "órgão (nome da organização)")}</span>
              <span className="customSelectChevron" />
            </button>
            {orgOpen && !loadingOrgs && (
              <div className="customSelectMenu" style={{ gap: 6 }}>
                <div
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    background: "rgba(255,255,255,0.98)",
                    borderRadius: 10,
                    paddingBottom: 4,
                  }}
                >
                  <input
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    placeholder="Filtrar organização..."
                    style={{
                      ...inputStyle(),
                      height: 36,
                      padding: "8px 10px",
                      borderRadius: 10,
                      fontSize: 13,
                    }}
                    autoFocus
                  />
                </div>

                <div
                  className="scrollbarHidden"
                  style={{
                    maxHeight: 300,
                    minHeight: shouldShowFiveOrgRows ? 250 : undefined,
                    overflow: "auto",
                    display: "grid",
                    gap: 4,
                  }}
                >
                {filteredOrganizations.map((org) => (
                  <button
                    key={`${org.name}-${org.organization_type}`}
                    type="button"
                    className={`customSelectItem ${orgao === org.name ? "customSelectItemActive" : ""}`}
                    onClick={() => {
                      setOrgao(org.name);
                      setUnidade(org.organization_type || "");
                      setOrgOpen(false);
                    }}
                    style={{
                      display: "grid",
                      gap: 2,
                      alignItems: "start",
                      textAlign: "left",
                      borderRadius: 12,
                      padding: "9px 10px",
                      fontWeight: 500,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(0,0,0,0.86)" }}>{org.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(15,23,42,0.62)" }}>
                      {org.organization_type || "Tipo não informado"}
                    </span>
                  </button>
                ))}
                {!filteredOrganizations.length && (
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      fontSize: 12,
                      color: "rgba(0,0,0,0.62)",
                    }}
                  >
                    Nenhuma organização encontrada para esse filtro.
                  </div>
                )}
                </div>
              </div>
            )}
          </div>

          <div className="customSelect">
            <button
              type="button"
              className="customSelectBtn"
              disabled
              style={{
                cursor: "not-allowed",
                opacity: orgao ? 1 : 0.75,
                fontWeight: 500,
              }}
              title={orgao ? "Tipo vinculado à organização selecionada" : "Selecione primeiro uma organização"}
            >
              <span>
                {selectedOrganizationType || unidade || (loadingOrgs ? "Carregando tipos..." : "tipo da organização")}
              </span>
            </button>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ position: "relative" }}>
              <input
                ref={passwordInputRef}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordCopied(false);
                }}
                onClick={refreshPasswordSuggestion}
                placeholder={id ? "senha (só na criação)" : "senha (mín 8)"}
                type={passwordVisible ? "text" : "password"}
                disabled={!!id}
                style={{
                  ...inputStyle(),
                  paddingRight: id ? 12 : 70,
                  opacity: id ? 0.6 : 1,
                  cursor: id ? "not-allowed" : "text",
                }}
              />
              {!id && (
                <div
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 2,
                    display: "inline-flex",
                    gap: 6,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((v) => !v)}
                    style={{
                      width: 26,
                      height: 26,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(255,255,255,0.92)",
                      color: "rgba(0,0,0,0.78)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      padding: 0,
                      cursor: "pointer",
                    }}
                    title={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                    aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {passwordVisible ? (
                      <EyeOff size={14} strokeWidth={2.2} aria-hidden="true" />
                    ) : (
                      <Eye size={14} strokeWidth={2.2} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={copyPassword}
                    disabled={!password}
                    style={{
                      width: 26,
                      height: 26,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(255,255,255,0.92)",
                      color: passwordCopied ? "#15803d" : "rgba(0,0,0,0.78)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      padding: 0,
                      cursor: password ? "pointer" : "not-allowed",
                      opacity: password ? 1 : 0.7,
                    }}
                    title={password ? "Copiar senha" : "Digite uma senha para copiar"}
                    aria-label={password ? "Copiar senha" : "Digite uma senha para copiar"}
                  >
                    <Copy size={14} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
            {!id && suggestedPassword && (
              <button
                type="button"
                onClick={applySuggestedPassword}
                style={{
                  justifySelf: "start",
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 10,
                  padding: "5px 8px",
                  background: "rgba(255,255,255,0.92)",
                  color: "rgba(0,0,0,0.82)",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
                title="Usar senha sugerida"
              >
                Sugerida:{" "}
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {suggestedPassword}
                </span>
              </button>
            )}
          </div>

          <div className="customSelect" ref={roleWrapRef}>
            <button type="button" className="customSelectBtn" onClick={() => setRoleOpen((v) => !v)}>
              <span>{roleLabel(role)}</span>
              <span className="customSelectChevron" />
            </button>
            {roleOpen && (
              <div className="customSelectMenu">
                <button
                  type="button"
                  className={`customSelectItem ${role === "user" ? "customSelectItemActive" : ""}`}
                  onClick={() => {
                    setRole("user");
                    setRoleOpen(false);
                  }}
                >
                  Usuário sem streaming
                </button>
                <button
                  type="button"
                  className={`customSelectItem ${role === "admin" ? "customSelectItemActive" : ""}`}
                  onClick={() => {
                    setRole("admin");
                    setRoleOpen(false);
                  }}
                >
                  Administrador
                </button>
              </div>
            )}
          </div>

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
              gridColumn: isMobile ? "1 / span 1" : "1 / span 2",
            }}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ transform: "scale(1.1)" }}
            />
            Ativo
          </label>
        </div>

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
            {id ? "Salvar alterações" : "Criar usuário"}
          </button>

          <button
            onClick={resetForm}
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

        {err && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#991b1b" }}>{err}</div>}
        {success && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#166534" }}>{success}</div>}
      </div>
      )}

      {userTab === "manage" && (
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
          <div style={{ fontWeight: 900, fontSize: 13 }}>Usuários</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {loading ? "Carregando..." : `${filteredItems.length} de ${items.length} itens`}
          </div>
        </div>

        <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={manageFilter}
            onChange={(e) => setManageFilter(e.target.value)}
            placeholder="Filtrar por nome ou CPF"
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
            title="Recarregar usuários"
            aria-label="Recarregar usuários"
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
          ).map((u) => {
            const expBadge = getUserExpirationBadge(u.expires_at);
            const isExpired = (() => {
              if (!u.expires_at) return false;
              const expMs = new Date(u.expires_at).getTime();
              return Number.isFinite(expMs) ? expMs <= Date.now() : false;
            })();
            const hasTermsInfo =
              typeof u.terms_accepted_at !== "undefined" ||
              typeof u.accepted_terms_version !== "undefined";
            const termsAccepted = !!u.terms_accepted_at && !!u.accepted_terms_version;
            return (
              <div
                key={u.id}
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: isMobile ? "wrap" : "nowrap" }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 13,
                        whiteSpace: isMobile ? "normal" : "nowrap",
                        overflow: isMobile ? "visible" : "hidden",
                        textOverflow: isMobile ? "clip" : "ellipsis",
                        wordBreak: "break-word",
                      }}
                    >
                      {u.full_name || u.email}
                    </div>
                    <span style={{ opacity: 0.55, fontSize: 12, whiteSpace: isMobile ? "normal" : "nowrap" }}>{roleLabel(u.role)}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.75,
                      marginTop: 2,
                      whiteSpace: isMobile ? "normal" : "nowrap",
                      overflow: isMobile ? "visible" : "hidden",
                      textOverflow: isMobile ? "clip" : "ellipsis",
                      wordBreak: "break-word",
                    }}
                  >
                    {u.email}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.72,
                      marginTop: 2,
                      whiteSpace: isMobile ? "normal" : "nowrap",
                      overflow: isMobile ? "visible" : "hidden",
                      textOverflow: isMobile ? "clip" : "ellipsis",
                      wordBreak: "break-word",
                    }}
                  >
                    {u.is_active ? "ATIVO" : "INATIVO"}
                    {u.cpf ? ` • CPF: ${u.cpf}` : ""}
                    {u.matricula ? ` • Matrícula: ${u.matricula}` : ""}
                    {u.orgao ? ` • ${u.orgao}` : ""}
                    {u.unidade ? ` • ${u.unidade}` : ""}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: 999,
                        padding: "1px 7px",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 0.1,
                        border: `1px solid ${expBadge.borderColor}`,
                        background: expBadge.background,
                        color: expBadge.color,
                      }}
                    >
                      {expBadge.label}
                    </span>
                    {termsAccepted ? (
                      <span
                        title="Termo aceito"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 999,
                          padding: "1px 8px",
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: 0.1,
                          background: "rgba(34,197,94,0.16)",
                          color: "#15803d",
                          border: "1px solid rgba(34,197,94,0.35)",
                        }}
                      >
                        ✓ Termo aceito
                      </span>
                    ) : (
                      <span
                        title={hasTermsInfo ? "Termo pendente" : "Sem informação de termos"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 999,
                          padding: "1px 8px",
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: 0.1,
                          background: hasTermsInfo
                            ? "rgba(15,23,42,0.08)"
                            : "rgba(148,163,184,0.15)",
                          color: hasTermsInfo ? "#334155" : "#64748b",
                          border: hasTermsInfo
                            ? "1px solid rgba(15,23,42,0.18)"
                            : "1px solid rgba(148,163,184,0.35)",
                        }}
                      >
                        {hasTermsInfo ? "Termo pendente" : "Termo: n/d"}
                      </span>
                    )}
                  </div>
                </div>

              <button
                onClick={() => pick(u)}
                className="adminRowBtn"
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(255,255,255,0.90)",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Editar
              </button>

              {u.is_active && !isExpired ? (
                <button
                  onClick={() => deactivate(u.id)}
                  className="adminRowBtn"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(0,0,0,0.86)",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Desativar
                </button>
              ) : (
                <button
                  onClick={() => reactivate(u.id)}
                  className="adminRowBtn"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(34,197,94,.14)",
                    color: "#15803d",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Reativar
                </button>
              )}
              </div>
            );
          })}

          {!filteredItems.length && !loading && (
            <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhum usuário encontrado para esse filtro.</div>
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
      </div>
      )}
    </div>
  );
}
