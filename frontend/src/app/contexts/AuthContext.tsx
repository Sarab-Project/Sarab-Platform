import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:5027/api';

export type UserRole = 'Admin' | 'Contributor' | 'Researcher';

export interface AuthUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  profileImagePath: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (firstName: string, lastName: string, email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Module-level token storage (survives re-renders, lost on page refresh)
let memoryAccessToken: string | null = null;

function decodeJwt(token: string): Record<string, any> {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

function extractUserFromToken(token: string, userData?: Partial<AuthUser>): AuthUser | null {
  try {
    const claims = decodeJwt(token);
    const roleRaw: string = claims['role'] || claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || 'Researcher';
    const role: UserRole = (['Admin', 'Contributor', 'Researcher'].includes(roleRaw) ? roleRaw : 'Researcher') as UserRole;
    return {
      id: parseInt(claims['sub'] || claims['nameid'] || '0'),
      firstName: claims['name'] || userData?.firstName || '',
      lastName: userData?.lastName || '',
      email: claims['email'] || claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || userData?.email || '',
      role,
      profileImagePath: userData?.profileImagePath || null,
    };
  } catch {
    return null;
  }
}

function storeSession(token: string, refreshToken: string, user: AuthUser) {
  memoryAccessToken = token;
  localStorage.setItem('sarab_refresh_token', refreshToken);
  localStorage.setItem('sarab_user', JSON.stringify(user));
}

function clearSession() {
  memoryAccessToken = null;
  localStorage.removeItem('sarab_refresh_token');
  localStorage.removeItem('sarab_user');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('sarab_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback((expiresAt: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const expTime = new Date(expiresAt).getTime();
    const refreshAt = expTime - Date.now() - 5 * 60 * 1000; // 5 min before expiry
    if (refreshAt > 0) {
      refreshTimerRef.current = setTimeout(() => doRefresh(), refreshAt);
    }
  }, []);

  const doRefresh = useCallback(async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem('sarab_refresh_token');
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clearSession();
        setUser(null);
        setAccessToken(null);
        return false;
      }
      const data = await res.json();
      const updatedUser = extractUserFromToken(data.token, {
        firstName: data.user?.firstName,
        lastName: data.user?.lastName,
        email: data.user?.email,
        profileImagePath: data.user?.profileImagePath,
      });
      if (!updatedUser) return false;
      storeSession(data.token, data.refreshToken, updatedUser);
      memoryAccessToken = data.token;
      setAccessToken(data.token);
      setUser(updatedUser);
      scheduleRefresh(data.expiresAt);
      return true;
    } catch {
      return false;
    }
  }, [scheduleRefresh]);

  // On mount: try to restore session
  useEffect(() => {
    const storedRefresh = localStorage.getItem('sarab_refresh_token');
    if (storedRefresh) {
      doRefresh().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [doRefresh]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Login failed');
    }
    const data = await res.json();
    const loggedInUser = extractUserFromToken(data.token, {
      firstName: data.user?.firstName,
      lastName: data.user?.lastName,
      email: data.user?.email,
      profileImagePath: data.user?.profileImagePath,
    });
    if (!loggedInUser) throw new Error('Invalid token received');
    storeSession(data.token, data.refreshToken, loggedInUser);
    memoryAccessToken = data.token;
    setAccessToken(data.token);
    setUser(loggedInUser);
    scheduleRefresh(data.expiresAt);
  };

  const signup = async (firstName: string, lastName: string, email: string, password: string, role: UserRole) => {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, password, role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || Object.values(err.errors || {}).flat().join(', ') || 'Signup failed');
    }
    const data = await res.json();
    const newUser = extractUserFromToken(data.token, {
      firstName: data.user?.firstName,
      lastName: data.user?.lastName,
      email: data.user?.email,
      profileImagePath: data.user?.profileImagePath,
    });
    if (!newUser) throw new Error('Invalid token received');
    storeSession(data.token, data.refreshToken, newUser);
    memoryAccessToken = data.token;
    setAccessToken(data.token);
    setUser(newUser);
    scheduleRefresh(data.expiresAt);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('sarab_refresh_token');
    try {
      if (memoryAccessToken && refreshToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${memoryAccessToken}`,
          },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Ignore logout errors
    } finally {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      clearSession();
      setUser(null);
      setAccessToken(null);
    }
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem('sarab_user', JSON.stringify(updated));
      return updated;
    });
  };

  const getToken = useCallback(() => memoryAccessToken, []);

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      isAuthenticated: !!user && !!memoryAccessToken,
      isLoading,
      login,
      signup,
      logout,
      updateUser,
      getToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Export for use in api.ts
export function getStoredToken(): string | null {
  return memoryAccessToken;
}
