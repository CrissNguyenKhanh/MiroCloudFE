import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LoadingState } from "../components/common/States";
export function ProtectedRoute({ children }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();
  if (isInitializing)
    return <LoadingState label="Đang khôi phục phiên đăng nhập…" />;
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  return children;
}

export function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, isInitializing } = useAuth();
  const location = useLocation();
  if (isInitializing)
    return <LoadingState label="Đang khôi phục phiên đăng nhập…" />;
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  if (!isAdmin) return <Navigate to="/forbidden" replace />;
  return children;
}
