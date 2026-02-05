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
  const [authToast, setAuthToast] = useState<string | null>(null);
  const [authToastSeconds, setAuthToastSeconds] = useState<number | null>(null);
  const [authToastProgress, setAuthToastProgress] = useState(100);

  useEffect(() => {
    const msg = localStorage.getItem("auth_toast");
    if (!msg) return;
    setAuthToast(msg);
    localStorage.removeItem("auth_toast");
  }, []);

  useEffect(() => {
    if (!authToast) return;
    const durationMs = 5000;
    const startedAt = Date.now();
    setAuthToastSeconds(5);
    setAuthToastProgress(100);

    const tick = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remainingMs = Math.max(0, durationMs - elapsed);
      const nextSeconds = Math.ceil(remainingMs / 1000);
      const nextProgress = Math.max(0, Math.round((remainingMs / durationMs) * 100));
      setAuthToastSeconds(nextSeconds);
      setAuthToastProgress(nextProgress);

      if (remainingMs <= 0) {
        setAuthToast(null);
        setAuthToastSeconds(null);
        setAuthToastProgress(0);
      }
    }, 100);

    return () => {
      window.clearInterval(tick);
    };
  }, [authToast]);

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
          "radial-gradient(900px 500px at 15% 10%, rgba(255,255,255,0.08), transparent 60%)," +
          "radial-gradient(900px 500px at 85% 90%, rgba(255,255,255,0.06), transparent 60%)," +
          "linear-gradient(180deg, #050505, #0b0b0f)",
      }}
    >
      {authToast && (
        <div
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 60,
            maxWidth: 320,
            width: "calc(100vw - 32px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(255,255,255,0.95)",
              color: "rgba(0,0,0,0.85)",
              fontSize: 13,
              boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
              backdropFilter: "blur(10px)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <AlertTriangle size={16} />
            <div style={{ lineHeight: 1.3 }}>
              {authToast}
              {authToastSeconds !== null && authToastSeconds >= 0 && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>({authToastSeconds}s)</span>
              )}
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: 0,
                height: 3,
                width: `${authToastProgress}%`,
                background: "#00c0f3",
                transition: "width 0.1s linear",
              }}
            />
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 640px) {
          .loginHeader {
            height: 64px !important;
            padding: 0 12px !important;
          }
          .loginLogo {
            height: 28px !important;
          }
          .loginCard {
            border-radius: 14px !important;
            padding: 14px !important;
          }
          .loginTitle {
            font-size: 18px !important;
          }
        }
        .loginInput {
          background-color: #0b0b0f !important;
          color: #ffffff !important;
        }
        .loginInput::placeholder {
          color: rgba(255,255,255,0.45) !important;
        }
        .loginInput:-webkit-autofill,
        .loginInput:-webkit-autofill:hover,
        .loginInput:-webkit-autofill:focus,
        .loginInput:-webkit-autofill:active {
          -webkit-text-fill-color: #ffffff !important;
          box-shadow: 0 0 0 1000px #0b0b0f inset !important;
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>
      {/* TOP BAR */}
      <header
        className="loginHeader"
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
            className="loginLogo"
            style={{ height: 34, width: "auto", filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.35))" }}
          />
        </div>

        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <img
            src={prefeituraLogo}
            alt="Prefeitura do Rio"
            className="loginLogo"
            style={{ height: 34, width: "auto", opacity: 0.95, filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.35))" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minWidth: 180 }}>
          <img
            src={disqueDenunciaLogo}
            alt="Disque Denúncia"
            className="loginLogo"
            style={{ height: 38, width: "auto", opacity: 0.95, filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.35))" }}
          />
        </div>
      </header>

      {/* CONTENT */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div
          className="loginCard"
          style={{
            width: "100%",
            maxWidth: 420,
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 16,
            padding: 18,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
            boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
            color: "#f5f5f5",
            backdropFilter: "blur(18px) saturate(160%)",
          }}
        >
          <div style={{ marginBottom: 18, textAlign: "center" }}>
            <h2 className="loginTitle" style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
              CIVITAS Map
            </h2>
            <p style={{ margin: "6px 0 0", opacity: 0.7, fontSize: 13 }}>
              
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
              <Label htmlFor="email" className="text-white/80">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="email@prefeitura.rio"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="loginInput !border-white/15 !bg-[#0b0b0f] !text-white placeholder:!text-white/45 focus-visible:!ring-white/30"
                style={{ width: "100%", backgroundColor: "#0b0b0f", color: "#fff" }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <Label htmlFor="password" className="text-white/80">
                Senha
              </Label>

              <div style={{ position: "relative", width: "100%" }}>
                <Input
                  id="password"
                  type={passwordType}
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="loginInput !border-white/15 !bg-[#0b0b0f] !text-white placeholder:!text-white/45 focus-visible:!ring-white/30"
                  style={{ width: "100%", paddingRight: 44, backgroundColor: "#0b0b0f", color: "#fff" }}
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
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "#0b0b0f",
                    borderRadius: 10,
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.9)",
                    display: "grid",
                    placeItems: "center",
                    padding: 0,
                    boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
                  }}
                >
                  {passwordType === "password" ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full border border-white/30 bg-white/20 text-white shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl hover:bg-white/30 hover:text-white"
            >
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
