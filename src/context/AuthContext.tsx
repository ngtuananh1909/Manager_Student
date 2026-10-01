import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Role } from '../types';
import { useNetwork } from './NetworkContext';
import { apiFetch, AUTH_CHANGED_EVENT, clearAccessToken, getAccessToken, setAccessToken } from '../lib/api';

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  role: Role;
  isFirstRun: boolean;
  isLoading: boolean;
  checkSystemStatus: () => Promise<void>;
  setupFirstAdmin: (data: {
    username: string;
    password: string;
    fullName: string;
    serverName?: string;
    className?: string;
  }) => Promise<AuthResult>;
  login: (username: string, password: string) => Promise<AuthResult>;
  register: (data: { username: string; password: string; fullName: string; joinCode: string }) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { serverUrl, socket } = useNetwork();
  const [user, setUser] = useState<User | null>(null);
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const role: Role = user?.role === 'host' ? 'host' : 'user';

  const checkSystemStatus = async () => {
    try {
      const res = await apiFetch(`${serverUrl}/api/system/status`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        setIsFirstRun(!!data.isFirstRun);
      }
    } catch {
      // The server can still be starting; connection UI reports that state.
    }
  };

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      setIsLoading(true);
      await checkSystemStatus();
      if (!getAccessToken()) {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }
      try {
        const res = await apiFetch(`${serverUrl}/api/auth/me`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const body = await res.json();
          if (!cancelled) setUser(body.user || null);
        } else if (!cancelled) {
          setUser(null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    restore();
    return () => { cancelled = true; };
  }, [serverUrl]);

  useEffect(() => {
    const handleAuthChanged = () => {
      if (!getAccessToken()) setUser(null);
    };
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleLocked = (data: { message?: string }) => {
      alert(data?.message || 'Tài khoản của bạn đã bị khóa bởi giáo viên');
      clearAccessToken();
      setUser(null);
    };
    socket.on('auth:locked', handleLocked);
    return () => { socket.off('auth:locked', handleLocked); };
  }, [socket]);

  const acceptSession = (body: { accessToken?: string; user?: User }) => {
    if (!body.accessToken || !body.user) return false;
    setAccessToken(body.accessToken);
    setUser(body.user);
    return true;
  };

  const setupFirstAdmin: AuthContextType['setupFirstAdmin'] = async data => {
    try {
      const res = await apiFetch(`${serverUrl}/api/system/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const body = await res.json();
      if (res.ok && body.success && acceptSession(body)) {
        setIsFirstRun(false);
        return { success: true };
      }
      return { success: false, error: body.error || 'Khởi tạo thất bại' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Không thể kết nối máy chủ' };
    }
  };

  const login = async (username: string, password: string): Promise<AuthResult> => {
    try {
      const res = await apiFetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const body = await res.json();
      if (res.ok && acceptSession(body)) return { success: true };
      return { success: false, error: body.error || 'Sai tên đăng nhập hoặc mật khẩu' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Không thể kết nối máy chủ' };
    }
  };

  const register: AuthContextType['register'] = async data => {
    try {
      const res = await apiFetch(`${serverUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const body = await res.json();
      if (res.ok && acceptSession(body)) return { success: true };
      return { success: false, error: body.error || 'Không thể tạo tài khoản' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Không thể kết nối máy chủ' };
    }
  };

  const logout = async () => {
    try {
      if (getAccessToken()) await apiFetch(`${serverUrl}/api/auth/logout`, { method: 'POST' });
    } catch {
      // Local logout still completes if the server is unavailable.
    } finally {
      clearAccessToken();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      isFirstRun,
      isLoading,
      checkSystemStatus,
      setupFirstAdmin,
      login,
      register,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
