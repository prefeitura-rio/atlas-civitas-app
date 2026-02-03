import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../app/auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthed, loading } = useAuth();
  const location = useLocation();

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

  return <>{children}</>;
}
