import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, isMockMode } from "../api";
import { getErrorMessage } from "../api/errors";
import { clearApiSession, getApiSession, setApiSession } from "../api/session";

const AuthContext = createContext(null);
const MOCK_SESSION_KEY = "cloudstay.mock-session.v1";

function readSavedMockUser() {
  if (!isMockMode) return null;
  try {
    return JSON.parse(localStorage.getItem(MOCK_SESSION_KEY)) ?? null;
  } catch {
    localStorage.removeItem(MOCK_SESSION_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = readSavedMockUser();
    if (savedUser) setApiSession({ user: savedUser });
    return savedUser;
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isInitializing, setIsInitializing] = useState(
    () => !isMockMode && Boolean(getApiSession().accessToken),
  );
  const [restoreError, setRestoreError] = useState("");
  const restoreRequestRef = useRef(0);

  useEffect(() => {
    if (user && isMockMode) setApiSession({ user });
  }, [user]);

  const saveSession = useCallback((result) => {
    setApiSession(result);
    setUser(result.user);
    if (isMockMode)
      localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(result.user));
    return result.user;
  }, []);

  const login = useCallback(
    async (credentials) => {
      setIsAuthenticating(true);
      setRestoreError("");
      try {
        return saveSession(await api.identity.login(credentials));
      } finally {
        setIsAuthenticating(false);
      }
    },
    [saveSession],
  );

  const register = useCallback(
    async (profile) => {
      setIsAuthenticating(true);
      try {
        const result = await api.identity.register(profile);
        if (result?.accessToken && result?.user) {
          return { ...result, user: saveSession(result) };
        }
        return result;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [saveSession],
  );

  const logout = useCallback(() => {
    restoreRequestRef.current += 1;
    clearApiSession();
    setUser(null);
    setRestoreError("");
    localStorage.removeItem(MOCK_SESSION_KEY);
  }, []);

  const restoreSession = useCallback(async () => {
    const requestId = ++restoreRequestRef.current;
    if (isMockMode) {
      setIsInitializing(false);
      return;
    }
    const { accessToken } = getApiSession();
    if (!accessToken) {
      setIsInitializing(false);
      setRestoreError("");
      return;
    }

    setIsInitializing(true);
    setRestoreError("");
    try {
      const restoredUser = await api.identity.me();
      if (requestId !== restoreRequestRef.current) return;
      setApiSession({ accessToken, user: restoredUser });
      setUser(restoredUser);
    } catch (error) {
      if (requestId !== restoreRequestRef.current) return;
      if (error?.status === 401 || error?.status === 403) {
        clearApiSession();
        setUser(null);
        setRestoreError("");
      } else {
        setRestoreError(getErrorMessage(error, "Không thể xác minh phiên đăng nhập."));
      }
    } finally {
      if (requestId === restoreRequestRef.current) setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener("cloudstay:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("cloudstay:unauthorized", handleUnauthorized);
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === "admin" || user?.role === "ADMIN",
      isAuthenticating,
      isInitializing,
      restoreError,
      retrySession: restoreSession,
      login,
      register,
      logout,
    }),
    [isAuthenticating, isInitializing, login, logout, register, restoreError, restoreSession, user],
  );

  useEffect(() => {
    restoreSession();

    return () => {
      restoreRequestRef.current += 1;
    };
  }, [restoreSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
