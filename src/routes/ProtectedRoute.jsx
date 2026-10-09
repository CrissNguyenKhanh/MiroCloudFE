import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ErrorState, LoadingState } from "../components/common/States";

function SessionRestoreError({ message, onRetry }) {
  return (
    <div className="page-state-wrap">
      <ErrorState
        title="Chưa thể xác minh phiên đăng nhập"
        message={message}
        onRetry={onRetry}
      />
    </div>
  );
}

export function ProtectedRoute({ children }) {
  const { isAuthenticated, isInitializing, restoreError, retrySession } = useAuth();
  const location = useLocation();
  if (isInitializing)
    return <LoadingState label="Đang khôi phục phiên đăng nhập…" />;
  if (restoreError)
    return <SessionRestoreError message={restoreError} onRetry={retrySession} />;
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
  const { isAuthenticated, isAdmin, isInitializing, restoreError, retrySession } = useAuth();
  const location = useLocation();
  if (isInitializing)
    return <LoadingState label="Đang khôi phục phiên đăng nhập…" />;
  if (restoreError)
    return <SessionRestoreError message={restoreError} onRetry={retrySession} />;
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
