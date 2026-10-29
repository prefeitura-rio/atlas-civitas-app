import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "../app/auth";

import atlasBrand from "@/assets/atlas-brand.png";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import "./login.css";

export default function Login() {
  const nav = useNavigate();
  const auth: any = useAuth();
  const { login } = auth;

  const isAuthed =
    auth?.isAuthed === true ||
    !!auth?.accessToken ||
    !!auth?.token ||
    !!sessionStorage.getItem("access_token") ||
    !!localStorage.getItem("access_token");

  // ✅ Se voltar pra /login estando logado, desloga e exige autenticação de novo
  useEffect(() => {
    if (isAuthed) {
      try {
        auth?.logout?.();
      } catch {}
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("refresh_token");
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("user_role");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
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
    <div className="loginShell">
      {authToast && (
        <div className="loginToast" role="status">
          <AlertTriangle size={17} aria-hidden="true" />
          <div className="loginToastCopy">
            <strong>{authToast}</strong>
            {authToastSeconds !== null && authToastSeconds >= 0 && (
              <span>Esta mensagem fecha em {authToastSeconds}s</span>
            )}
          </div>
          <div className="loginToastProgress" style={{ width: `${authToastProgress}%` }} />
        </div>
      )}

      <header className="loginTopbar">
        <img src={atlasBrand} alt="Prefeitura do Rio e CIVITAS Rio" className="loginBrand" />
      </header>

      <main className="loginMain">
        <div className="loginLayout">
          <section className="loginIdentity" aria-labelledby="login-product-title">
            <span className="loginIdentityRule" aria-hidden="true" />
            <h1 id="login-product-title">Atlas CIVITAS</h1>
            <p>Monitoramento da cidade do Rio de Janeiro.</p>
            <div className="loginIdentityFooter">Prefeitura do Rio de Janeiro · CIVITAS Rio</div>
          </section>

          <section className="loginCard" aria-labelledby="login-title">
            <div className="loginCardHeader">
              <span className="loginSecureIcon" aria-hidden="true"><ShieldCheck size={20} /></span>
              <div>
                <span className="loginCardEyebrow">Acesso institucional</span>
                <h2 id="login-title">Entrar</h2>
              </div>
            </div>
            <p className="loginCardDescription">Use seu e-mail e senha para acessar o sistema.</p>

            {err && (
              <Alert variant="destructive" className="loginAlert" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <div>
                  <AlertTitle>Não foi possível entrar</AlertTitle>
                  <AlertDescription>{err}</AlertDescription>
                </div>
              </Alert>
            )}

            <form onSubmit={onSubmit} className="loginForm">
              <div className="loginField">
                <Label htmlFor="email" className="loginFieldLabel">E-mail institucional</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@prefeitura.rio"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  className="loginInput"
                  required
                />
              </div>

              <div className="loginField">
                <Label htmlFor="password" className="loginFieldLabel">Senha</Label>
                <div className="loginPasswordField">
                  <Input
                    id="password"
                    type={passwordType}
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="loginInput"
                    required
                  />
                  <button
                    type="button"
                    className="loginPasswordToggle"
                    onClick={() => setPasswordType(passwordType === "password" ? "text" : "password")}
                    title={passwordType === "password" ? "Mostrar senha" : "Ocultar senha"}
                    aria-label={passwordType === "password" ? "Mostrar senha" : "Ocultar senha"}
                  >
                    {passwordType === "password" ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="loginSubmit">
                <span>{loading ? "Entrando..." : "Login"}</span>
                {!loading && <ArrowRight size={17} aria-hidden="true" />}
              </Button>
            </form>

            <div className="loginCardFooter">Acesso restrito a usuários autorizados.</div>
          </section>
        </div>
      </main>

      <footer className="loginFooter">© 2026 Prefeitura da Cidade do Rio de Janeiro</footer>
    </div>
  );
}
