"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: "ADMIN" | "MEMBER" | "BORROWER";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const saved = Cookies.get("fs_user");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
    setLoading(false);
  }, []);

  async function login(username: string, password: string) {
    const { data } = await api.post("/auth/login", { username, password });
    Cookies.set("fs_token", data.token, { expires: 7 });
    Cookies.set("fs_user", JSON.stringify(data.user), { expires: 7 });
    setUser(data.user);
    return data.user as AuthUser;
  }

  function logout() {
    Cookies.remove("fs_token");
    Cookies.remove("fs_user");
    setUser(null);
    router.push("/login");
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
