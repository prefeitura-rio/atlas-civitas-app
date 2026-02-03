import { useEffect, useState } from "react";
import { api } from "../app/api";

type UserOut = {
  id: string;
  full_name: string;
  cpf: string;
  birth_date: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  expires_at: string | null;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<UserOut[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const r = await api.get<UserOut[]>("/users");
      setUsers(r.data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Erro ao carregar usuários");
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Admin - Usuários</h2>
      <button onClick={load}>Recarregar</button>
      {err && <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>}

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {users.map(u => (
          <div key={u.id} style={{ border: "1px solid #3333", padding: 12, borderRadius: 8 }}>
            <div><b>{u.full_name}</b> ({u.role}) {u.is_active ? "✅" : "⛔"}</div>
            <div>{u.email}</div>
            <div>CPF: {u.cpf} | Nasc: {u.birth_date}</div>
            <div>Expira: {u.expires_at ?? "-"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
