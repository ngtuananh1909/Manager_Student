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
          const body = await res.json().catch(() => ({}));
          if (!cancelled) {
            const resolvedUser = body.user || (body.id ? body : null);
            setUser(resolvedUser);
            if (resolvedUser) {
              try { localStorage.setItem('schooljudge_user', JSON.stringify(resolvedUser)); } catch {}
            }
          }
        } else if (!cancelled) {
          // If server returned 404 (legacy server without /api/auth/me), fall back to cached user in localStorage
          if (res.status === 404) {
            try {
              const saved = localStorage.getItem('schooljudge_user');
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed?.id && parsed?.username) {
                  setUser(parsed);
                  return;
                }
              }
            } catch {}
          }
          setUser(null);
        }
      } catch {
        if (!cancelled) {
          try {
            const saved = localStorage.getItem('schooljudge_user');
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed?.id && parsed?.username) {
                setUser(parsed);
                return;
              }
            }
          } catch {}
          setUser(null);
        }
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
      try { localStorage.removeItem('schooljudge_user'); } catch {}
      setUser(null);
    };
    socket.on('auth:locked', handleLocked);
    return () => { socket.off('auth:locked', handleLocked); };
  }, [socket]);

  const acceptSession = (body: any) => {
    if (!body) return false;
    // Format 1: Modern server response { accessToken: string, user: User }
    if (body.accessToken && body.user) {
      setAccessToken(body.accessToken);
      setUser(body.user);
      try { localStorage.setItem('schooljudge_user', JSON.stringify(body.user)); } catch {}
      return true;
    }
    // Format 2: Direct user object with accessToken { accessToken: string, ...userFields }
    if (body.accessToken && body.id && body.username) {
      setAccessToken(body.accessToken);
      const userObj: User = {
        id: body.id,
        username: body.username,
        fullName: body.fullName || body.username,
        role: body.role === 'host' ? 'host' : 'user',
        classId: body.classId || '',
        classes: body.classes || (body.classId ? [body.classId] : []),
        points: body.points || 0,
        streak: body.streak || 0,
        badges: body.badges || [],
        isLocked: !!body.isLocked,
        mustChangePassword: !!body.mustChangePassword
      };
      setUser(userObj);
      try { localStorage.setItem('schooljudge_user', JSON.stringify(userObj)); } catch {}
      return true;
    }
    // Format 3: Legacy server response: body IS the user object directly { id, username, role, ... }
    if (body.id && body.username && (body.role || body.classId !== undefined)) {
      const token = `legacy_${body.id}_${Date.now()}`;
      setAccessToken(token);
      const userObj: User = {
        id: body.id,
        username: body.username,
        fullName: body.fullName || body.username,
        role: body.role === 'host' ? 'host' : 'user',
        classId: body.classId || '',
        classes: body.classes || (body.classId ? [body.classId] : []),
        points: body.points || 0,
        streak: body.streak || 0,
        badges: body.badges || [],
        isLocked: !!body.isLocked,
        mustChangePassword: !!body.mustChangePassword
      };
      setUser(userObj);
      try { localStorage.setItem('schooljudge_user', JSON.stringify(userObj)); } catch {}
      return true;
    }
    return false;
  };

  const setupFirstAdmin: AuthContextType['setupFirstAdmin'] = async data => {
    try {
      const res = await apiFetch(`${serverUrl}/api/system/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && (body.success || body.user || body.id) && acceptSession(body)) {
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
      const body = await res.json().catch(() => ({}));
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
      const body = await res.json().catch(() => ({}));
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
      try { localStorage.removeItem('schooljudge_user'); } catch {}
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
