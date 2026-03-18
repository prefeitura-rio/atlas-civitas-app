import React, { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../app/auth";
import { fetchJson } from "../pages/map/shared";
import Terms from "../pages/Terms";

type TermsStatus = {
  current_version?: string | null;
  must_accept_terms?: boolean | null;
  accepted_version?: string | null;
  accepted_at?: string | null;
};

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.toString() ||
  (import.meta as any).env?.VITE_API_BASE_URL?.toString() ||
  "http://127.0.0.1:8000";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthed, loading, accessToken } = useAuth();
  const location = useLocation();

  const [termsLoading, setTermsLoading] = useState(false);
  const [termsStatus, setTermsStatus] = useState<TermsStatus | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);

  const loadTerms = useCallback(async () => {
    if (!accessToken) return;
    setTermsLoading(true);
    setTermsError(null);

    try {
      const payload = await fetchJson<TermsStatus>(`${API_BASE}/users/terms/current`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setTermsStatus(payload);
    } catch (e: any) {
      setTermsError(e?.message ?? "Falha ao carregar termos");
      setTermsStatus(null);
    } finally {
      setTermsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isAuthed || !accessToken) return;
    loadTerms();
  }, [isAuthed, accessToken, loadTerms]);

  // evita “tela branca” enquanto valida token/login
  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        Carregando...
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const mustAcceptTerms = (() => {
    if (!termsStatus) return false;
    const mustAccept = !!termsStatus.must_accept_terms;
    const firstTime =
      termsStatus.accepted_at == null && termsStatus.accepted_version == null;
    return mustAccept || firstTime;
  })();

  if (termsLoading || (!termsStatus && !termsError)) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        Carregando termos...
      </div>
    );
  }

  if (termsError || mustAcceptTerms) {
    return (
      <Terms
        apiBase={API_BASE}
        accessToken={accessToken || ""}
        currentVersion={termsStatus?.current_version ?? null}
        error={termsError}
        onRetry={loadTerms}
        onAccepted={loadTerms}
      />
    );
  }

  return <>{children}</>;
}
