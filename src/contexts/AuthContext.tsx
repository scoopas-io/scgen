import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole = "admin" | "viewer" | null;

interface AuthContextType {
  role: UserRole;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isViewer: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_PASSWORD = "1234";
const VIEWER_PASSWORD = "1234";
const STORAGE_KEY = "scoopas_auth_role";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "admin" || stored === "viewer") {
      return stored;
    }
    return null;
  });

  useEffect(() => {
    if (role) {
      localStorage.setItem(STORAGE_KEY, role);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [role]);

  const login = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      setRole("admin");
      return true;
    }
    if (password === VIEWER_PASSWORD) {
      setRole("viewer");
      return true;
    }
    return false;
  };

  const logout = () => {
    setRole(null);
  };

  const value: AuthContextType = {
    role,
    isAuthenticated: role !== null,
    isAdmin: role === "admin",
    isViewer: role === "viewer",
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
