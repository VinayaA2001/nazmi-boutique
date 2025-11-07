"use client";

import { createContext, useContext, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type User = {
  id: string;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  register: (args: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: `Server returned ${res.status}` };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const t = localStorage.getItem("auth_token");
      const u = localStorage.getItem("auth_user");
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u));
      }
    } catch {}
    setLoading(false);
  }, []);

 const login = async (emailOrPhone: string, password: string) => {
  // decide whether it's a phone number or email
  const digits = emailOrPhone.replace(/\D/g, "");
  const isPhone = /^[6-9]\d{9}$/.test(digits);

  const payload =
    isPhone
      ? { phone: digits, password }                            // ✅ phone key
      : { email: emailOrPhone.trim().toLowerCase(), password } // ✅ email key

  const res = await fetch(`/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await safeJson(res);
  if (!res.ok) {
    const err: any = new Error(data?.message || data?.error || "Login failed");
    err.code = data?.code;
    err.field = data?.field;
    throw err;
  }

  setToken(data.token);
  setUser(data.user);
  localStorage.setItem("auth_token", data.token);
  localStorage.setItem("auth_user", JSON.stringify(data.user));
  try {
    const maxAge = 7 * 24 * 60 * 60;
    const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `auth_token=${encodeURIComponent(data.token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  } catch {}
};


  const register: AuthContextType["register"] = async ({
    firstName,
    lastName,
    email,
    phone,
    password,
  }) => {
    const res = await fetch(`/api/auth/register`, {
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
    const identifier = (email ?? "").trim().toLowerCase() || (phone ?? "");
    if (identifier) await login(identifier, password);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, isAuthenticated: !!token && !!user, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
