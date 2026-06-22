import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../api/api';
import type { User } from '../types/User';

interface AuthContextType {
  user: User | null;
  login: (_token?: string, user?: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const clearLegacyTokenStorage = () => {
  try {
    localStorage.removeItem('session_token');
    sessionStorage.removeItem('session_token');
  } catch {
    /* ignore */
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/profile');
      setUser(res.data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    clearLegacyTokenStorage();
    let mounted = true;
    (async () => {
      await refreshUser();
      if (mounted) setIsAuthLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  const login = async (_token?: string, newUser?: Partial<User>) => {
    if (newUser) {
      setUser(newUser as User);
    }
    await refreshUser();
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* server-side cookie clear failed; we still clear local state */
    }
    setUser(null);
    clearLegacyTokenStorage();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, isAuthenticated: !!user, isAuthLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
