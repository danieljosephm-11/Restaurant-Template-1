import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { PageLoader } from "./ui.jsx";

export default function ProtectedRoute({ children, allow = ["admin"] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Checking your session…" />;

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/admin/login?next=${next}`} replace />;
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={user.role === "kitchen" ? "/kitchen" : "/admin"} replace />;
  }

  return children;
}
