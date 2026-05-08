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
type OrganizationOption = {
  id: string;
  name: string;
  organization_type: string;
  jurisdiction_level: string;
};

type UserPayload = {
  full_name: string;
  email: string;
  password?: string;
  role?: UserRole;
  organization_id?: string;
  orgao?: string;
  unidade?: string | null;
  cpf?: string | null;
  matricula?: string | null;
};

const ROLE_SELECT_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "user", label: "Usuário sem streaming" },
  { value: "user_stream", label: "Usuário com streaming" },
  { value: "manager", label: "Gestor" },
  { value: "admin", label: "Administrador" },
];

function canManagerTouchRole(nextRole: UserRole) {
  return nextRole === "user" || nextRole === "user_stream";
}

function normalizeNullableText(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function normalizeIdLike(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = typeof value === "string" ? value.trim() : String(value).trim();
  return normalized || null;
}

function formatMatriculaLabel(value: unknown) {
  return normalizeNullableText(value) || "sem matrícula";
}

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
  viewerRole,
  isMobile,
  onOrgDropdownOpenChange,
}: {
  apiBase: string;
  token: string;
  viewerRole: UserRole;
  isMobile: boolean;
  onOrgDropdownOpenChange?: (open: boolean) => void;
}) {
  const USERS_URL = `${apiBase}/users`;
  const ORGS_URL = `${apiBase}/organizations`;

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [matricula, setMatricula] = useState("");
  const [organizationUnit, setOrganizationUnit] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [password, setPassword] = useState("");
  const [suggestedPassword, setSuggestedPassword] = useState("");
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [role, setRole] = useState<UserRole>("user");
  const [editingUserRole, setEditingUserRole] = useState<UserRole | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isOrganizationDropdownOpen, setIsOrganizationDropdownOpen] = useState(false);
  const [organizationSearch, setOrganizationSearch] = useState("");
  const roleDropdownRef = useRef<HTMLDivElement | null>(null);
  const organizationDropdownRef = useRef<HTMLDivElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const passwordCopyTimeoutRef = useRef<number | null>(null);
  const [userTab, setUserTab] = useState<"create" | "manage">("create");
  const [userSearch, setUserSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleMobileUserCount, setVisibleMobileUserCount] = useState(ADMIN_PAGE_SIZE);
  const isManagerViewer = viewerRole === "manager";
  const roleSelectOptions = isManagerViewer
    ? ROLE_SELECT_OPTIONS.filter(({ value }) => value === "user" || value === "user_stream")
    : ROLE_SELECT_OPTIONS;

  useEffect(() => {
    if (!isManagerViewer) return;
    if (canManagerTouchRole(role)) return;
    setRole("user");
  }, [isManagerViewer, role]);

  function resetUserForm() {
    setEditingUserId(null);
    setEditingUserRole(null);
    setEmail("");
    setFullName("");
    setCpf("");
    setMatricula("");
    setOrganizationUnit("");
    setOrganizationName("");
    setSelectedOrganizationId("");
    setPassword("");
    setSuggestedPassword("");
    setPasswordCopied(false);
    setRole("user");
    setIsActive(true);
    setIsRoleDropdownOpen(false);
    setIsOrganizationDropdownOpen(false);
    setErr(null);
    setSuccess(null);
  }

  async function loadUsers() {
    setErr(null);
    setLoadingUsers(true);
    try {
      const data = await fetchJson<any>(USERS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list: AdminUser[] = (Array.isArray(data) ? data : []).map((raw: any) => ({
        ...raw,
        cpf: normalizeNullableText(raw?.cpf),
        matricula: normalizeNullableText(raw?.matricula),
        orgao: normalizeNullableText(raw?.orgao || raw?.organization_name || raw?.organization?.name),
        organization_id: normalizeIdLike(raw?.organization_id || raw?.organization?.id || raw?.org_id),
        organization_name: normalizeNullableText(raw?.organization_name || raw?.organization?.name),
      }));

      setUsers(list);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar usuários");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadOrganizations() {
    setLoadingOrganizations(true);
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

      const normalizedOrganizations: OrganizationOption[] = list
        .map((raw: any) => ({
          id: normalizeIdLike(raw?.id || raw?.organization_id || raw?.uuid) || "",
          name: (raw?.name ?? "").toString().trim(),
          organization_type: (raw?.organization_type ?? "").toString().trim(),
          jurisdiction_level: (raw?.jurisdiction_level ?? "").toString().trim(),
        }))
        .filter((organization: OrganizationOption) => organization.id && organization.name);
      const deduplicatedOrganizations = Array.from(
        new Map<string, OrganizationOption>(normalizedOrganizations.map((organization) => [organization.id, organization])).values()
      ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      setOrganizations(deduplicatedOrganizations);
    } catch {
      // Não bloqueia tela de usuários se organizações falhar.
      setOrganizations([]);
    } finally {
      setLoadingOrganizations(false);
    }
  }

  useEffect(() => {
    loadUsers();
    loadOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setVisibleMobileUserCount(ADMIN_PAGE_SIZE);
  }, [users.length, userSearch]);

  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Node)) return;
      const roleDropdown = roleDropdownRef.current;
      const organizationDropdown = organizationDropdownRef.current;
      if (roleDropdown && !roleDropdown.contains(target)) setIsRoleDropdownOpen(false);
      if (organizationDropdown && !organizationDropdown.contains(target)) setIsOrganizationDropdownOpen(false);
    }

    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  useEffect(() => {
    return () => {
      if (!passwordCopyTimeoutRef.current) return;
      window.clearTimeout(passwordCopyTimeoutRef.current);
      passwordCopyTimeoutRef.current = null;
    };
  }, []);

  useEffect(() => {
    onOrgDropdownOpenChange?.(isOrganizationDropdownOpen || isRoleDropdownOpen);
  }, [isOrganizationDropdownOpen, isRoleDropdownOpen, onOrgDropdownOpenChange]);

  useEffect(() => {
    return () => {
      onOrgDropdownOpenChange?.(false);
    };
  }, [onOrgDropdownOpenChange]);

  function editUser(user: AdminUser) {
    const nextRole = (user.role || "user").toLowerCase();
    if (isManagerViewer && !canManagerTouchRole(isUserRole(nextRole) ? nextRole : "user")) {
      setErr("Gestor não pode editar admin ou outro gestor.");
      setSuccess(null);
      return;
    }

    setUserTab("create");
    setEditingUserId(user.id);
    setEditingUserRole(isUserRole(nextRole) ? nextRole : "user");
    setEmail(user.email || "");
    setFullName(user.full_name || "");
    setCpf(formatCpf(user.cpf || ""));
    setMatricula(user.matricula || "");
    const nextSelectedOrganizationId = normalizeIdLike(user.organization_id);
    const nextOrganizationName = (user.orgao || user.organization_name || "").toString().trim();
    const matchedOrganization =
      organizations.find(
        (organization) => nextSelectedOrganizationId && organization.id === nextSelectedOrganizationId
      ) || organizations.find((organization) => nextOrganizationName && organization.name === nextOrganizationName);
    setSelectedOrganizationId(nextSelectedOrganizationId || matchedOrganization?.id || "");
    setOrganizationName(nextOrganizationName || matchedOrganization?.name || "");
    setOrganizationUnit((user.unidade || matchedOrganization?.organization_type || "").toString());
    setPassword("");
    setSuggestedPassword("");
    setPasswordCopied(false);
    setRole(isUserRole(nextRole) ? nextRole : "user");
    setIsActive(!!user.is_active);
  }

  function refreshPasswordSuggestion() {
    if (editingUserId) return;
    setSuggestedPassword(generateStrongPassword());
  }

  function applySuggestedPassword() {
    if (!suggestedPassword || editingUserId) return;
    setPassword(suggestedPassword);
    setPasswordCopied(false);
    setErr(null);
    passwordInputRef.current?.focus();
  }

  async function copyPassword() {
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
      if (passwordCopyTimeoutRef.current) window.clearTimeout(passwordCopyTimeoutRef.current);
      passwordCopyTimeoutRef.current = window.setTimeout(() => {
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

    const trimmedEmail = email.trim();
    const trimmedFullName = fullName.trim();
    const normalizedRole = role.trim().toLowerCase();
    const normalizedCpf = normalizeCpf(cpf.trim());
    const trimmedMatricula = matricula.trim();
    const trimmedPassword = password.trim();
    const trimmedOrganizationName = organizationName.trim();
    const selectedOrganizationOption =
      organizations.find((organization) => organization.id === selectedOrganizationId.trim()) ||
      organizations.find((organization) => organization.name === trimmedOrganizationName);
    const selectedOrganizationUnit = (selectedOrganizationOption?.organization_type || organizationUnit).trim();
    const resolvedOrganizationId = selectedOrganizationOption?.id || selectedOrganizationId.trim() || "";
    const resolvedOrganizationName = trimmedOrganizationName || selectedOrganizationOption?.name || "";
    const cpfForPayload = normalizedCpf || null;
    const matriculaForPayload = trimmedMatricula || null;
    const organizationUnitForPayload = selectedOrganizationUnit || null;

    if (!trimmedEmail) return setErr("Email é obrigatório.");
    if (!trimmedFullName || trimmedFullName.length < 3) return setErr("Nome completo inválido.");
    if (!normalizedRole) return setErr("Role é obrigatório (admin/manager/user/user_stream).");
    if (!isUserRole(normalizedRole)) return setErr("Role deve ser admin, manager, user ou user_stream.");
    if (isManagerViewer && editingUserRole && !canManagerTouchRole(editingUserRole)) {
      return setErr("Gestor não pode criar ou editar admin ou outro gestor.");
    }
    if (isManagerViewer && !canManagerTouchRole(normalizedRole as UserRole)) {
      return setErr("Gestor não pode criar ou editar admin ou outro gestor.");
    }
    if (!resolvedOrganizationId && !resolvedOrganizationName) return setErr("Órgão é obrigatório.");
    if (!cpfForPayload && !matriculaForPayload) return setErr("Informe cpf ou matrícula.");
    if (cpfForPayload && cpfForPayload.length !== 11) return setErr("CPF deve ter 11 dígitos.");

    if (!editingUserId) {
      if (!trimmedPassword || trimmedPassword.length < 8) return setErr("Senha mínima: 8 caracteres.");
    }

    const isCreatingUser = !editingUserId;
    const organizationReferencePayload = resolvedOrganizationId
      ? { organization_id: resolvedOrganizationId }
      : resolvedOrganizationName
      ? { orgao: resolvedOrganizationName }
      : {};
    const baseUserPayload = {
      email: trimmedEmail,
      full_name: trimmedFullName,
      cpf: cpfForPayload,
      matricula: matriculaForPayload,
      unidade: organizationUnitForPayload,
      ...organizationReferencePayload,
    };

    try {
      if (isCreatingUser) {
        const payload: UserPayload = {
          ...baseUserPayload,
          password: trimmedPassword,
          role: normalizedRole as UserRole,
        };

        await fetchJson(USERS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        const payload: Partial<UserPayload> & { is_active: boolean } = {
          is_active: isActive,
          ...baseUserPayload,
          role: normalizedRole as UserRole,
        };
        if (trimmedPassword) payload.password = trimmedPassword;

        await fetchJson(`${USERS_URL}/${editingUserId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      resetUserForm();
      setSuccess(isCreatingUser ? "Usuário criado com sucesso." : "Usuário atualizado com sucesso.");
      loadUsers();
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
      if (editingUserId === userId) resetUserForm();
      loadUsers();
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
      loadUsers();
    } catch (e: any) {
      setErr(e?.message || "Erro ao reativar usuário");
    }
  }

  const normalizedUserSearch = userSearch.trim().toLowerCase();
  const normalizedUserSearchDigits = normalizedUserSearch.replace(/\D/g, "");
  const filteredOrganizations = useMemo(() => {
    const q = organizationSearch.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter((organization) => {
      const name = organization.name.toLowerCase();
      const type = (organization.organization_type || "").toLowerCase();
      return name.includes(q) || type.includes(q);
    });
  }, [organizations, organizationSearch]);
  const shouldShowFiveOrgRows = filteredOrganizations.length >= 5;
  const selectedOrganizationOption =
    organizations.find((organization) => organization.id === selectedOrganizationId) ||
    organizations.find((organization) => organization.name === organizationName);
  const selectedOrganizationUnit = selectedOrganizationOption?.organization_type || "";
  const cpfOrMatriculaError = err === "Informe cpf ou matrícula.";
  const filteredUsers = users.filter((user) => {
    if (!normalizedUserSearch) return true;
    const name = (user.full_name || "").toLowerCase();
    const organizationNameValue = (user.orgao || user.organization_name || "").toLowerCase();
    const cpfDigits = (user.cpf || "").replace(/\D/g, "");
    const matriculaText = (user.matricula || "").toLowerCase();
    return (
      name.includes(normalizedUserSearch) ||
      organizationNameValue.includes(normalizedUserSearch) ||
      matriculaText.includes(normalizedUserSearch) ||
      (normalizedUserSearchDigits && cpfDigits.includes(normalizedUserSearchDigits))
    );
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {!isMobile ? (
        <div className="tabsRail tabsRailSection tabsRailCompact">
          <button className={`subTab ${userTab === "create" ? "subTabActive" : ""}`} onClick={() => setUserTab("create")}>
            Criar Usuário
          </button>
          <button className={`subTab ${userTab === "manage" ? "subTabActive" : ""}`} onClick={() => setUserTab("manage")}>
            Gerenciar Usuários
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
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: "rgba(10,40,75,0.58)" }}>MODO</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { key: "create" as const, label: "Criar Usuário" },
              { key: "manage" as const, label: "Gerenciar Usuários" },
            ].map((option) => {
              const active = userTab === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setUserTab(option.key)}
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
          {editingUserId ? "Editar usuário" : "Criar usuário"}
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

          <div
            style={{
              gridColumn: isMobile ? "1 / span 1" : "1 / span 2",
              display: "grid",
              gap: 10,
              padding: 12,
              borderRadius: 16,
              border: cpfOrMatriculaError ? "1px solid rgba(220,38,38,0.24)" : "1px solid rgba(15,23,42,0.08)",
              background: cpfOrMatriculaError ? "rgba(254,242,242,0.96)" : "rgba(248,250,252,0.92)",
            }}
          >
            <div
              className="adminGrid2"
              style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}
            >
              <input
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="CPF"
                inputMode="numeric"
                maxLength={14}
                aria-invalid={cpfOrMatriculaError}
                style={inputStyle()}
              />

              <input
                value={matricula}
                onChange={(e) => {
                  setMatricula(e.target.value);
                }}
                placeholder="Matrícula"
                aria-invalid={cpfOrMatriculaError}
                style={inputStyle()}
              />
            </div>
          </div>
          <div className="customSelect" ref={organizationDropdownRef}>
            <button
              type="button"
              className="customSelectBtn"
              onClick={() => {
                if (loadingOrganizations) return;
                setIsOrganizationDropdownOpen((isOpen) => {
                  const next = !isOpen;
                  if (next) setOrganizationSearch("");
                  return next;
                });
              }}
              disabled={loadingOrganizations}
              style={
                loadingOrganizations
                  ? { cursor: "not-allowed", opacity: 0.75, fontWeight: 500 }
                  : { fontWeight: 500 }
              }
            >
              <span>{organizationName || (loadingOrganizations ? "Carregando organizações..." : "órgão / organização")}</span>
              <span className="customSelectChevron" />
            </button>
            {isOrganizationDropdownOpen && !loadingOrganizations && (
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
                    value={organizationSearch}
                    onChange={(e) => setOrganizationSearch(e.target.value)}
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
                  {filteredOrganizations.map((organization) => (
                    <button
                      key={organization.id}
                      type="button"
                      className={`customSelectItem ${
                        selectedOrganizationId === organization.id || organizationName === organization.name
                          ? "customSelectItemActive"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedOrganizationId(organization.id);
                        setOrganizationName(organization.name);
                        setOrganizationUnit(organization.organization_type || "");
                        setIsOrganizationDropdownOpen(false);
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
                      <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(0,0,0,0.86)" }}>{organization.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(15,23,42,0.62)" }}>
                        {organization.organization_type || "Tipo não informado"}
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
                opacity: organizationName ? 1 : 0.75,
                fontWeight: 500,
              }}
              title={organizationName ? "Unidade opcional vinculada à organização selecionada" : "Unidade opcional"}
            >
              <span>
                {selectedOrganizationUnit || organizationUnit || (loadingOrganizations ? "Carregando unidade..." : "unidade (opcional)")}
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
                placeholder={editingUserId ? "nova senha (opcional)" : "senha (mín 8)"}
                type={isPasswordVisible ? "text" : "password"}
                style={{
                  ...inputStyle(),
                  paddingRight: 70,
                  opacity: 1,
                  cursor: "text",
                }}
              />
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
                  onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
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
                  title={isPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
                  aria-label={isPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
                >
                  {isPasswordVisible ? (
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
            </div>
            {editingUserId && (
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.58)", paddingLeft: 2 }}>
                Deixe em branco para manter a senha atual.
              </div>
            )}
            {!editingUserId && suggestedPassword && (
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

          <div className="customSelect" ref={roleDropdownRef}>
            <button type="button" className="customSelectBtn" onClick={() => setIsRoleDropdownOpen((isOpen) => !isOpen)}>
              <span>{roleLabel(role)}</span>
              <span className="customSelectChevron" />
            </button>
            {isRoleDropdownOpen && (
              <div className="customSelectMenu">
                {roleSelectOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`customSelectItem ${role === option.value ? "customSelectItemActive" : ""}`}
                    onClick={() => {
                      setRole(option.value);
                      setIsRoleDropdownOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
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
              border: "1px solid rgba(10,40,75,0.18)",
              background: "rgba(10,40,75,0.92)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            {editingUserId ? "Salvar alterações" : "Criar usuário"}
          </button>

          <button
            onClick={resetUserForm}
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
            {loadingUsers ? "Carregando..." : `${filteredUsers.length} de ${users.length} itens`}
          </div>
        </div>

        <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Filtrar por nome, CPF, matrícula ou órgão"
            style={{ ...inputStyle(), flex: 1, minWidth: 0 }}
          />
          <button
            onClick={loadUsers}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: "1px solid rgba(10,40,75,0.82)",
              background: "rgba(255,255,255,0.96)",
              cursor: "pointer",
              color: "#0a284b",
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
                setVisibleMobileUserCount((currentVisibleCount) => currentVisibleCount + ADMIN_PAGE_SIZE);
              }
            }}
          >
          {(isMobile
            ? filteredUsers.slice(0, visibleMobileUserCount)
            : filteredUsers.slice((currentPage - 1) * ADMIN_PAGE_SIZE, currentPage * ADMIN_PAGE_SIZE)
          ).map((user) => {
            const expirationBadge = getUserExpirationBadge(user.expires_at);
            const isExpired = (() => {
              if (!user.expires_at) return false;
              const expMs = new Date(user.expires_at).getTime();
              return Number.isFinite(expMs) ? expMs <= Date.now() : false;
            })();
            const hasTermsInfo =
              typeof user.terms_accepted_at !== "undefined" ||
              typeof user.accepted_terms_version !== "undefined";
            const termsAccepted = !!user.terms_accepted_at && !!user.accepted_terms_version;
            return (
              <div
                key={user.id}
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
                      {user.full_name || user.email}
                    </div>
                    <span style={{ opacity: 0.55, fontSize: 12, whiteSpace: isMobile ? "normal" : "nowrap" }}>{roleLabel(user.role)}</span>
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
                    {user.email}
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
                    {user.is_active ? "ATIVO" : "INATIVO"}
                    {user.cpf ? ` • CPF: ${user.cpf}` : ""}
                    {` • Matrícula: ${formatMatriculaLabel(user.matricula)}`}
                    {user.orgao || user.organization_name ? ` • ${user.orgao || user.organization_name}` : ""}
                    {user.unidade ? ` • ${user.unidade}` : ""}
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
                        border: `1px solid ${expirationBadge.borderColor}`,
                        background: expirationBadge.background,
                        color: expirationBadge.color,
                      }}
                    >
                      {expirationBadge.label}
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

              {!isManagerViewer || canManagerTouchRole(user.role) ? (
                <>
                  <button
                    onClick={() => editUser(user)}
                    className="adminRowBtn"
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(10,40,75,0.82)",
                      background: "rgba(255,255,255,0.96)",
                      cursor: "pointer",
                      fontWeight: 900,
                      color: "#0a284b",
                    }}
                  >
                    Editar
                  </button>

                  {user.is_active && !isExpired ? (
                    <button
                      onClick={() => deactivate(user.id)}
                      className="adminRowBtn"
                      style={{
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(10,40,75,0.18)",
                        background: "rgba(10,40,75,0.92)",
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      Desativar
                    </button>
                  ) : (
                    <button
                      onClick={() => reactivate(user.id)}
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
                </>
              ) : null}
              </div>
            );
          })}

          {!filteredUsers.length && !loadingUsers && (
            <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhum usuário encontrado para esse filtro.</div>
          )}
        </div>

        {!isMobile && filteredUsers.length > ADMIN_PAGE_SIZE && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
            <button
              className="btnGhost"
              onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              style={{ opacity: currentPage <= 1 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Página {currentPage} de {Math.max(1, Math.ceil(filteredUsers.length / ADMIN_PAGE_SIZE))}
            </div>
            <button
              className="btnGhost"
              onClick={() =>
                setCurrentPage((current) => Math.min(Math.ceil(filteredUsers.length / ADMIN_PAGE_SIZE), current + 1))
              }
              disabled={currentPage >= Math.ceil(filteredUsers.length / ADMIN_PAGE_SIZE)}
              style={{ opacity: currentPage >= Math.ceil(filteredUsers.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
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
