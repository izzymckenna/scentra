import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type AuthUser = {
  email: string;
  name: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  signIn: (email: string, password: string) => void;
  signOut: () => void;
};

const STORAGE_KEY = "scentra-auth-user";

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    return readStoredUser();
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      signIn: (email: string) => {
        const normalizedEmail = email.trim().toLowerCase();
        const name = normalizedEmail.split("@")[0] || "Member";
        const nextUser = {
          email: normalizedEmail,
          name: name
            .split(/[._-]/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" "),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
        setUser(nextUser);
      },
      signOut: () => {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
