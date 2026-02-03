import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../app/auth";

import civitasLogo from "@/assets/civitas_icon.png";
import prefeituraLogo from "@/assets/prefeitura_icon.png";
import disqueDenunciaLogo from "@/assets/logo_disque_denuncia.png";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";

export default function Login() {
  const nav = useNavigate();
  const auth: any = useAuth();
  const { login } = auth;

  const isAuthed =
    auth?.isAuthed === true ||
    !!auth?.accessToken ||
    !!auth?.token ||
    !!localStorage.getItem("access_token");

  // ✅ Se voltar pra /login estando logado, desloga e exige autenticação de novo
  useEffect(() => {
    if (isAuthed) {
      try {
        auth?.logout?.();
      } catch {}
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // roda só ao montar a tela

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordType, setPasswordType] = useState<"password" | "text">("password");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      await login(email, password);
      nav("/map", { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background:
          "radial-gradient(1200px 600px at 20% 10%, rgba(0,0,0,0.08), transparent 60%)," +
          "radial-gradient(1200px 600px at 80% 90%, rgba(0,0,0,0.06), transparent 60%)," +
          "linear-gradient(180deg, #fff, #fafafa)",
      }}
    >
      {/* TOP BAR */}
      <header
        style={{
          height: 88,
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          color: "#fff",
          background: "linear-gradient(180deg, rgba(10,10,10,0.92), rgba(10,10,10,0.78))",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 180 }}>
          <img
            src={civitasLogo}
            alt="Civitas Rio"
            style={{ height: 34, width: "auto", filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.35))" }}
          />
        </div>

        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <img
            src={prefeituraLogo}
            alt="Prefeitura do Rio"
            style={{ height: 34, width: "auto", opacity: 0.95, filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.35))" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minWidth: 180 }}>
          <img
            src={disqueDenunciaLogo}
            alt="Disque Denúncia"
            style={{ height: 38, width: "auto", opacity: 0.95, filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.35))" }}
          />
        </div>
      </header>

      {/* CONTENT */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 18,
            background: "white",
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ marginBottom: 18, textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>CIVITAS Map</h2>
            <p style={{ margin: "6px 0 0", opacity: 0.75, fontSize: 13 }}>
              
            </p>
          </div>

          {err && (
            <div style={{ marginBottom: 12 }}>
              <Alert variant="destructive">
                <AlertTriangle size={18} />
                <div>
                  <AlertTitle>O login falhou!</AlertTitle>
                  <AlertDescription>{err}</AlertDescription>
                </div>
              </Alert>
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@prefeitura.rio"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <Label htmlFor="password">Senha</Label>

              <div style={{ position: "relative", width: "100%" }}>
                <Input
                  id="password"
                  type={passwordType}
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ width: "100%", paddingRight: 44 }}
                />

                <button
                  type="button"
                  onClick={() => setPasswordType(passwordType === "password" ? "text" : "password")}
                  title={passwordType === "password" ? "Mostrar senha" : "Ocultar senha"}
                  aria-label={passwordType === "password" ? "Mostrar senha" : "Ocultar senha"}
                  style={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 32,
                    height: 32,
                    border: "none",
                    background: "transparent",
                    borderRadius: 8,
                    cursor: "pointer",
                    color: "#6b7280",
                    display: "grid",
                    placeItems: "center",
                    padding: 0,
                  }}
                >
                  {passwordType === "password" ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Entrando..." : "Login"}
            </Button>
          </form>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6, textAlign: "center" }}>
            © 2026 Prefeitura do Rio de Janeiro - CIVITAS
          </div>
        </div>
      </main>
    </div>
  );
}
