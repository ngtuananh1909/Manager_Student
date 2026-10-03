import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { DiscoveredServer } from '../types';
import { AUTH_CHANGED_EVENT, getAccessToken } from '../lib/api';

export type NetworkMode = 'lan' | 'internet';

interface NetworkContextType {
  networkMode: NetworkMode;
  setNetworkMode: (mode: NetworkMode) => void;
  lanUrl: string;
  setLanUrl: (url: string) => void;
  internetUrl: string;
  setInternetUrl: (url: string) => void;
  serverUrl: string;
  isConnected: boolean;
  latency: number | null;
  serverTimeOffset: number;
  getServerNow: () => number;
  socket: Socket | null;
  discoveredServers: DiscoveredServer[];
  isScanning: boolean;
  scanForServers: () => void;
  testConnection: (url: string) => Promise<{ success: boolean; latency?: number; error?: string }>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const cleanUrl = (url: string) => {
  let clean = (url || '').trim();
  if (!clean) return '';
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `http://${clean}`;
  }
  return clean.replace(/\/+$/, '');
};

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [networkMode, setNetworkModeState] = useState<NetworkMode>(() => {
    return (localStorage.getItem('schooljudge_net_mode') as NetworkMode) || 'lan';
  });

  const [lanUrl, setLanUrlState] = useState<string>(() => {
    const saved = localStorage.getItem('schooljudge_lan_url');
    if (saved) return cleanUrl(saved);
    // If running in browser (non-Electron or web origin)
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')) {
      const isElectron = !!(window as any).electronAPI;
      if (!isElectron) {
        return cleanUrl(window.location.origin);
      }
      if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        const port = window.location.port ? `:${window.location.port}` : '';
        return `${window.location.protocol}//${window.location.hostname}${port}`;
      }
    }
    return 'http://localhost:4000';
  });

  const [internetUrl, setInternetUrlState] = useState<string>(() => {
    return cleanUrl(localStorage.getItem('schooljudge_internet_url') || 'https://truong-abc.duckdns.org');
  });

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const getServerNow = useCallback(() => Date.now() + serverTimeOffset, [serverTimeOffset]);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [authVersion, setAuthVersion] = useState(0);
  const [discoveredServers, setDiscoveredServers] = useState<DiscoveredServer[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const serverUrl = cleanUrl(networkMode === 'lan' ? lanUrl : internetUrl);

  const setNetworkMode = (mode: NetworkMode) => {
    setNetworkModeState(mode);
    localStorage.setItem('schooljudge_net_mode', mode);
  };

  const setLanUrl = (url: string) => {
    const cleaned = cleanUrl(url);
    setLanUrlState(cleaned);
    localStorage.setItem('schooljudge_lan_url', cleaned);
  };

  const setInternetUrl = (url: string) => {
    const cleaned = cleanUrl(url);
    setInternetUrlState(cleaned);
    localStorage.setItem('schooljudge_internet_url', cleaned);
  };

  useEffect(() => {
    const handleAuthChanged = () => setAuthVersion(version => version + 1);
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
  }, []);

  // Socket.io connection instance. Anonymous clients use HTTP ping only.
  useEffect(() => {
    const accessToken = getAccessToken();
    const newSocket = accessToken ? io(serverUrl, {
      reconnectionDelayMax: 5000,
      timeout: 4000,
      auth: { token: accessToken }
    }) : null;

    if (newSocket) {
      newSocket.on('connect', () => {
        setIsConnected(true);
        checkLatency();
      });

      newSocket.on('disconnect', () => {
        setLatency(null);
      });

      newSocket.on('connect_error', () => {
        setSocket(null);
      });
    }

    setSocket(newSocket);
    checkLatency();

    // Baseline check on socket connect, and relaxed 30s interval to prevent CPU/render thrashing
    const pingInterval = setInterval(checkLatency, 30000);

    return () => {
      clearInterval(pingInterval);
      newSocket?.disconnect();
    };
  }, [serverUrl, authVersion]);

  const checkLatency = async () => {
    try {
      const start = Date.now();
      const res = await fetch(`${serverUrl}/api/ping`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const measured = Date.now() - start;
        // Only trigger state update if latency changed significantly (> 15ms) to avoid re-rendering entire app tree
        setLatency(prev => (prev === null || Math.abs(prev - measured) > 15 ? measured : prev));
        setIsConnected(true);

        // Sync server clock: offset between server now and client Date.now()
        if (data && typeof data.time === 'number') {
          const estimatedServerNow = data.time + Math.round(measured / 2);
          const offset = estimatedServerNow - Date.now();
          setServerTimeOffset(prev => Math.abs(prev - offset) > 500 ? offset : prev);
        }
      } else {
        setIsConnected(false);
      }
    } catch (e) {
      setIsConnected(false);
      setLatency(null);
    }
  };

  useEffect(() => {
    // Automatically scan for teacher server on startup
    scanForServers();
  }, []);

  const scanForServers = () => {
    setIsScanning(true);
    if ((window as any).electronAPI?.startDiscovery) {
      (window as any).electronAPI.startDiscovery();
      (window as any).electronAPI.onDiscoveredServer((server: DiscoveredServer) => {
        setDiscoveredServers(prev => {
          if (!prev.some(s => s.ip === server.ip && s.port === server.port)) {
            return [...prev, server];
          }
          return prev;
        });

        // If this machine is a client/student and doesn't have teacher IP yet, auto-point to discovered server!
        const currentRole = localStorage.getItem('schooljudge_device_role');
        const storedUrl = localStorage.getItem('schooljudge_lan_url');
        if (currentRole !== 'host' && (!storedUrl || storedUrl.includes('localhost') || storedUrl.includes('127.0.0.1'))) {
          const autoUrl = `http://${server.ip}:${server.port}`;
          setLanUrlState(autoUrl);
          localStorage.setItem('schooljudge_lan_url', autoUrl);
        }
      });
    }

    setTimeout(() => {
      setIsScanning(false);
    }, 3500);
  };

  const testConnection = async (target: string): Promise<{ success: boolean; latency?: number; error?: string }> => {
    let cleanUrl = target.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }

    try {
      const start = Date.now();
      const res = await fetch(`${cleanUrl}/api/ping`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        return { success: true, latency: Date.now() - start };
      }
      return { success: false, error: `Máy chủ phản hồi mã lỗi ${res.status}` };
    } catch (e: any) {
      return { success: false, error: e.message || 'Không thể kết nối' };
    }
  };

  const contextValue = useMemo(() => ({
    networkMode,
    setNetworkMode,
    lanUrl,
    setLanUrl,
    internetUrl,
    setInternetUrl,
    serverUrl,
    isConnected,
    latency,
    serverTimeOffset,
    getServerNow,
    socket,
    discoveredServers,
    isScanning,
    scanForServers,
    testConnection
  }), [
    networkMode,
    lanUrl,
    internetUrl,
    serverUrl,
    isConnected,
    latency,
    serverTimeOffset,
    getServerNow,
    socket,
    discoveredServers,
    isScanning
  ]);

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) throw new Error('useNetwork must be used within NetworkProvider');
  return context;
};
