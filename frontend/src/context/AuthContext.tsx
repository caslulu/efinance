import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, setApiAuthToken } from '../api/api';
import type { User } from '../types/User';

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token?: string, user?: Partial<User>, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const getStoredToken = (): string | null => {
  return localStorage.getItem('session_token') || sessionStorage.getItem('session_token');
};

const clearStoredToken = () => {
  localStorage.removeItem('session_token');
  sessionStorage.removeItem('session_token');
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/profile');
      setUser(res.data);
    } catch (error) {
      setUser(null);
      setToken(null);
      setApiAuthToken(null);
      clearStoredToken();
    }
  };

  useEffect(() => {
    let mounted = true;

    if (token) {
      setApiAuthToken(token);
    } else {
      setIsAuthLoading(false);
      return () => {
        mounted = false;
      };
    }

    const initializeAuth = async () => {
      await refreshUser();
      if (mounted) {
        setIsAuthLoading(false);
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [token]);

  const login = async (newToken?: string, newUser?: Partial<User>, rememberMe?: boolean) => {
    if (newToken) {
      setToken(newToken);
      setApiAuthToken(newToken);
      clearStoredToken();
      if (rememberMe) {
        localStorage.setItem('session_token', newToken);
      } else {
        sessionStorage.setItem('session_token', newToken);
      }
    }
    if (newUser) {
      setUser(newUser as User);
    }

    await refreshUser();
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Failed to call logout endpoint');
    }
    setToken(null);
    setUser(null);
    setApiAuthToken(null);
    clearStoredToken();
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, refreshUser, isAuthenticated: !!user, isAuthLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
