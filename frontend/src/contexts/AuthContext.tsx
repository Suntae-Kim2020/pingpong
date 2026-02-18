import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, getToken, setToken, removeToken } from '../api/client';
import type { SystemRole } from '../types';

interface User {
  id: number;
  name: string;
  nickname: string | null;
  email: string | null;
  profile_image: string | null;
  provider: 'naver' | 'kakao' | 'google';
  phone: string | null;
  birth_year: number | null;
  gender: 'M' | 'F' | null;
  role: SystemRole;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasRole: (...roles: SystemRole[]) => boolean;
  login: (provider: 'naver' | 'kakao' | 'google') => Promise<void>;
  handleCallback: (provider: string, code: string, state?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await api.get<User>('/auth/me');
      // 구 응답 호환: role 없으면 'user' 폴백
      setUser({ ...userData, role: userData.role || 'user' });
    } catch {
      removeToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (provider: 'naver' | 'kakao' | 'google') => {
    try {
      const { url } = await api.get<{ url: string }>(`/auth/login/${provider}`);
      window.location.href = url;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const handleCallback = async (provider: string, code: string, state?: string) => {
    try {
      const response = await api.post<{
        token: string;
        user: User;
        isNew: boolean;
      }>(`/auth/callback/${provider}`, { code, state });

      setToken(response.token);
      setUser({ ...response.user, role: response.user.role || 'user' });
    } catch (error) {
      console.error('Callback error:', error);
      throw error;
    }
  };

  const logout = () => {
    removeToken();
    setUser(null);
    api.post('/auth/logout').catch(() => {});
  };

  const hasRole = useCallback((...roles: SystemRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  const isAdmin = user ? (user.role === 'admin' || user.role === 'super_admin') : false;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin,
        hasRole,
        login,
        handleCallback,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
