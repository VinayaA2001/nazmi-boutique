"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_BROWSER } from "@/lib/constants";

type User = {
  id: string;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profile?: Record<string, unknown> | null;
  email_verified?: boolean;
};

type RegisterArgs = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  password: string;
};

type RegisterResponse = {
  message?: string;
  requiresVerification?: boolean;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (args: RegisterArgs) => Promise<RegisterResponse>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  register: async () => ({ message: "" }),
  verifyEmail: async () => {},
  resendVerification: async () => {},
  logout: () => {},
});

const API_BASE = (API_BASE_BROWSER || "").replace(/\/$/, "");

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: `Server returned ${res.status}` };
  }
}

function buildUrl(path: string) {
  if (path.startsWith("http")) return path;
  if (API_BASE) return `${API_BASE}${path}`;
  return path;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("auth_token");
      const storedUser = localStorage.getItem("auth_user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {}
    setLoading(false);
  }, []);

  const persistAuth = (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem("auth_token", nextToken);
    localStorage.setItem("auth_user", JSON.stringify(nextUser || {}));
    try {
      const maxAge = 7 * 24 * 60 * 60;
      const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `auth_token=${encodeURIComponent(nextToken)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
      document.cookie = `user=${encodeURIComponent(JSON.stringify(nextUser || {}))}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
    } catch {}
  };

  const clearAuth = () => {
    setToken(null);
    setUser(null);
    try {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      document.cookie = "auth_token=; Path=/; Max-Age=0; SameSite=Lax";
      document.cookie = "user=; Path=/; Max-Age=0; SameSite=Lax";
    } catch {}
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(buildUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      const err: any = new Error(data?.message || data?.error || "Login failed");
      err.code = data?.code;
      err.field = data?.field;
      throw err;
    }
    if (data?.token && data?.user) {
      persistAuth(data.token, data.user);
    }
  };

  const register: AuthContextType["register"] = async ({ firstName, lastName, email, phone, password }) => {
    const res = await fetch(buildUrl("/api/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: [firstName, lastName].filter(Boolean).join(" ").trim() || "user",
        email,
        phone,
        password,
      }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      const err: any = new Error(data?.error || data?.message || "Registration failed");
      err.code = data?.code;
      err.field = data?.field;
      throw err;
    }
    return {
      message: data?.message,
      requiresVerification: data?.requiresVerification,
    };
  };

  const verifyEmail = async (tokenValue: string) => {
    const res = await fetch(buildUrl("/api/auth/verify-email"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenValue }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data?.error || data?.message || "Verification failed");
    }
    if (data?.token && data?.user) {
      persistAuth(data.token, data.user);
    }
  };

  const resendVerification = async (email: string) => {
    const res = await fetch(buildUrl("/api/auth/resend-verification"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data?.error || data?.message || "Failed to resend verification email");
    }
  };

  const logout = () => {
    clearAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        verifyEmail,
        resendVerification,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
