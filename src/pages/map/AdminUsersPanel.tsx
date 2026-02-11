import { useEffect, useRef, useState } from "react";
import type { AdminUser } from "./types";
import { fetchJson, inputStyle } from "./shared";

const ADMIN_PAGE_SIZE = 50;

export function AdminUsersPanel({
  apiBase,
  token,
  isMobile,
}: {
  apiBase: string;
  token: string;
  isMobile: boolean;
}) {
  const USERS_URL = `${apiBase}/api/v1/users`;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<AdminUser[]>([]);

  const [id, setId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [matricula, setMatricula] = useState("");
  const [unidade, setUnidade] = useState("");
  const [orgao, setOrgao] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [isActive, setIsActive] = useState(true);
  const [roleOpen, setRoleOpen] = useState(false);
  const roleWrapRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(1);
  const [mobileCount, setMobileCount] = useState(ADMIN_PAGE_SIZE);

  function resetForm() {
    setId(null);
    setEmail("");
    setFullName("");
    setCpf("");
    setBirthDate("");
    setMatricula("");
    setUnidade("");
    setOrgao("");
    setPassword("");
    setRole("user");
    setIsActive(true);
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    setMobileCount(ADMIN_PAGE_SIZE);
  }, [items.length]);

  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      const el = roleWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setRoleOpen(false);
    }

    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  function pick(u: AdminUser) {
    setId(u.id);
    setEmail(u.email || "");
    setFullName(u.full_name || "");
    setCpf(formatCpf(u.cpf || ""));
    setBirthDate(u.birth_date || "");
    setMatricula(u.matricula || "");
    setUnidade(u.unidade || "");
    setOrgao(u.orgao || "");
    setPassword("");
    setRole((u.role || "user").toLowerCase());
    setIsActive(!!u.is_active);
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

    const emailV = email.trim();
    const fullNameV = fullName.trim();
    const roleV = role.trim().toLowerCase();
    const cpfV = normalizeCpf(cpf.trim());
    const birthDateV = birthDate.trim();
    const matriculaV = matricula.trim();
    const unidadeV = unidade.trim();
    const orgaoV = orgao.trim();

    if (!emailV) return setErr("Email é obrigatório.");
    if (!fullNameV || fullNameV.length < 3) return setErr("Nome completo inválido.");
    if (!roleV) return setErr("Role é obrigatório (admin/user).");
    if (!/^(admin|user)$/.test(roleV)) return setErr("Role deve ser admin ou user.");
    if (!matriculaV) return setErr("Matrícula é obrigatória.");
    if (!orgaoV) return setErr("Órgão é obrigatório.");

    if (!id) {
      if (cpfV.length !== 11) return setErr("CPF deve ter 11 dígitos.");
      if (!birthDateV) return setErr("Data de nascimento é obrigatória.");
      if (!password || password.length < 8) return setErr("Senha mínima: 8 caracteres.");
    }

    try {
      if (!id) {
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
            birth_date: birthDateV,
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
        if (birthDateV) payload.birth_date = birthDateV;
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
        <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>
          {id ? "Editar usuário" : "Criar usuário"}
        </div>

        <div className="adminGrid2" style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
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
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            type="date"
            placeholder="data de nascimento"
            style={inputStyle()}
          />

          <input
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            placeholder="matrícula"
            style={inputStyle()}
          />
          <input
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            placeholder="unidade (opcional)"
            style={inputStyle()}
          />

          <input value={orgao} onChange={(e) => setOrgao(e.target.value)} placeholder="órgão" style={inputStyle()} />

          <div className="customSelect" ref={roleWrapRef}>
            <button type="button" className="customSelectBtn" onClick={() => setRoleOpen((v) => !v)}>
              <span>{role === "admin" ? "Administrador" : "Usuário"}</span>
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
                  Usuário
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
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={id ? "senha (só na criação)" : "senha (mín 8)"}
            type="password"
            disabled={!!id}
            style={{
              ...inputStyle(),
              opacity: id ? 0.6 : 1,
              cursor: id ? "not-allowed" : "text",
            }}
          />

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
              gridColumn: "1 / span 2",
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
            Recarregar
          </button>
        </div>

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
          <div style={{ fontWeight: 900, fontSize: 13 }}>Usuários</div>
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
          ).map((u) => (
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
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {u.email} <span style={{ opacity: 0.6, fontWeight: 800 }}>• {String(u.role).toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {u.full_name || "-"} • {u.is_active ? "ATIVO" : "INATIVO"}
                  {u.cpf ? ` • CPF: ${u.cpf}` : ""}
                  {u.matricula ? ` • Matrícula: ${u.matricula}` : ""}
                  {u.unidade ? ` • Unidade: ${u.unidade}` : ""}
                  {u.orgao ? ` • Órgão: ${u.orgao}` : ""}
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

              {u.is_active ? (
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
          ))}

          {!items.length && !loading && <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhum usuário encontrado.</div>}
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
