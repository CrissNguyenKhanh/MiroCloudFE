import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, isMockMode } from "../api";
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
  const [user, setUser] = useState(() => readSavedMockUser());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isInitializing, setIsInitializing] = useState(
    () => !isMockMode && Boolean(getApiSession().accessToken),
  );

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
        return saveSession(await api.identity.register(profile));
      } finally {
        setIsAuthenticating(false);
      }
    },
    [saveSession],
  );

  const logout = useCallback(() => {
    clearApiSession();
    setUser(null);
    localStorage.removeItem(MOCK_SESSION_KEY);
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
      login,
      register,
      logout,
    }),
    [isAuthenticating, login, logout, register, user],
  );

  useEffect(() => {
    if (isMockMode) return undefined;
    const { accessToken } = getApiSession();
    if (!accessToken) {
      setIsInitializing(false);
      return undefined;
    }

    let cancelled = false;
    api.identity
      .me()
      .then((restoredUser) => {
        if (cancelled) return;
        setApiSession({ accessToken, user: restoredUser });
        setUser(restoredUser); // <-- user có lại, isAuthenticated = true
      })
      .catch((error) => {
        if (cancelled) return;
        if (error?.status === 401 || error?.status === 403) clearApiSession();
      })
      .finally(() => {
        if (!cancelled) setIsInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
