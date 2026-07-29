import type {
  AuthenticatedUser,
  ChangePasswordRequest,
  LoginRequest,
} from "@cge/contracts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, Outlet, useLocation } from "react-router";

import { api, ApiError, json } from "./lib/api";

type AuthContextValue = {
  loading: boolean;
  user: AuthenticatedUser | null;
  refresh: () => Promise<void>;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (input: ChangePasswordRequest) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ user: AuthenticatedUser }>("/api/auth/me");
      setUser(result.user);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const refreshOnFocus = () => void refresh();
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      refresh,
      async login(input) {
        const result = await api<{ user: AuthenticatedUser }>(
          "/api/auth/login",
          { method: "POST", body: json(input) },
        );
        setUser(result.user);
      },
      async logout() {
        await api("/api/auth/logout", { method: "POST" });
        setUser(null);
      },
      async changePassword(input) {
        await api("/api/auth/password", {
          method: "POST",
          body: json(input),
        });
        window.sessionStorage.setItem("passwordChanged", "true");
        setUser(null);
      },
    }),
    [loading, refresh, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

export function RequireAuth() {
  const { loading, user } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div
        className="grid min-h-[100dvh] place-items-center text-sm text-[var(--text-muted)]"
        role="status"
      >
        Carregando intranet…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (user.account.mustChangePassword) {
    return <Navigate to="/alterar-senha" replace />;
  }
  return <Outlet />;
}
