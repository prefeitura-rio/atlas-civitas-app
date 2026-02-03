import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { useAuth } from "./app/auth";

import Login from "./pages/Login";
import MapPage from "./pages/MapPage";
import AdminUsers from "./pages/AdminUsers";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* raiz manda pro mapa */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />

        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <AdminUsers />
            </ProtectedRoute>
          }
        />

        {/* fallback pra qualquer rota */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
