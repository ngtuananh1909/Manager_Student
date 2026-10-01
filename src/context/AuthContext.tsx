import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { useNetwork } from './NetworkContext';

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
  }) => Promise<{ success: boolean; error?: string }>;
  login: (username: string, password?: string, fullName?: string, classId?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { serverUrl, isConnected, socket } = useNetwork();
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('schooljudge_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isFirstRun, setIsFirstRun] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Role is strictly determined by the logged-in user account!
  const role: Role = user?.role === 'host' ? 'host' : 'user';

  const checkSystemStatus = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/system/status`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        setIsFirstRun(!!data.isFirstRun);
      }
    } catch (e) {
      // Server might be starting or not yet connected
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSystemStatus();
  }, [serverUrl, isConnected]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('schooljudge_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('schooljudge_user');
    }
  }, [user]);

  // Identify client over Socket.IO for LAN presence and exam room monitoring
  useEffect(() => {
    if (socket && user) {
      socket.emit('client:identify', {
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      });
    }
  }, [socket, user, isConnected]);

  // Handle remote lock event
  useEffect(() => {
    if (!socket) return;
    const handleLocked = (data: { message?: string }) => {
      alert(data?.message || 'Tài khoản của bạn đã bị khóa bởi giáo viên');
      setUser(null);
      localStorage.removeItem('schooljudge_user');
    };
    socket.on('auth:locked', handleLocked);
    return () => {
      socket.off('auth:locked', handleLocked);
    };
  }, [socket]);

  const setupFirstAdmin = async (data: {
    username: string;
    password: string;
    fullName: string;
    serverName?: string;
    className?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${serverUrl}/api/system/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const body = await res.json();
      if (res.ok && body.success) {
        setUser(body.user);
        setIsFirstRun(false);
        return { success: true };
      }
      return { success: false, error: body.error || 'Khởi tạo thất bại' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Không thể kết nối máy chủ' };
    }
  };

  const login = async (
    username: string, 
    password?: string, 
    fullName?: string, 
    classId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password: password || '',
          fullName,
          classId
        })
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data);
        return { success: true };
      }
      return { success: false, error: data.error || 'Sai tên đăng nhập hoặc mật khẩu' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Không thể kết nối máy chủ' };
    }
  };

  const logout = () => {
    setUser(null);
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
