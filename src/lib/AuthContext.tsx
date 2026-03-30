import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface User {
  _id: any;
  name: string;
  email?: string;
  createdAt: number;
}

interface AuthContextType {
  user: User | null;
  sessionToken: string | null;
  isLoading: boolean;
  isLocked: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithPasscode: (passcode: string) => Promise<void>;
  loginWithEmail: (email: string, passcode: string) => Promise<void>;
  signupWithEmail: (email: string, name: string, passcode: string) => Promise<void>;
  setupPasscode: (passcode: string, name: string) => Promise<void>;
  unlock: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  sessionToken: null,
  isLoading: true,
  isLocked: false,
  login: async () => {},
  signup: async () => {},
  loginWithPasscode: async () => {},
  loginWithEmail: async () => {},
  signupWithEmail: async () => {},
  setupPasscode: async () => {},
  unlock: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('buckets_session_token');
    } catch {
      return null;
    }
  });

  const [isLocked, setIsLocked] = useState(() => {
    // If we have a session token, start locked (user needs to enter passcode)
    try {
      const token = localStorage.getItem('buckets_session_token');
      const wasLocked = localStorage.getItem('buckets_is_locked');
      return !!(token && wasLocked === 'true');
    } catch {
      return false;
    }
  });

  const user = useQuery(
    api.users.getCurrentUser,
    sessionToken ? { sessionToken } : 'skip',
  );

  const loginAction = useAction(api.auth.login);
  const signupAction = useAction(api.auth.signup);
  const loginWithPasscodeAction = useAction(api.auth.loginWithPasscode);
  const loginWithEmailAction = useAction(api.auth.loginWithEmail);
  const signupWithEmailAction = useAction(api.auth.signupWithEmail);
  const setupPasscodeAction = useAction(api.auth.setupPasscode);
  const logoutMutation = useMutation(api.users.logout);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginAction({ email, password });
    try {
      localStorage.setItem('buckets_session_token', result.token);
      localStorage.removeItem('buckets_is_locked');
    } catch {}
    setSessionToken(result.token);
    setIsLocked(false);
  }, [loginAction]);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const result = await signupAction({ email, password, name });
    try {
      localStorage.setItem('buckets_session_token', result.token);
      localStorage.removeItem('buckets_is_locked');
    } catch {}
    setSessionToken(result.token);
    setIsLocked(false);
  }, [signupAction]);

  const loginWithPasscode = useCallback(async (passcode: string) => {
    const result = await loginWithPasscodeAction({ passcode });
    try {
      localStorage.setItem('buckets_session_token', result.token);
      localStorage.removeItem('buckets_is_locked');
    } catch {}
    setSessionToken(result.token);
    setIsLocked(false);
  }, [loginWithPasscodeAction]);

  const loginWithEmail = useCallback(async (email: string, passcode: string) => {
    const result = await loginWithEmailAction({ email, passcode });
    try {
      localStorage.setItem('buckets_session_token', result.token);
      localStorage.removeItem('buckets_is_locked');
    } catch {}
    setSessionToken(result.token);
    setIsLocked(false);
  }, [loginWithEmailAction]);

  const signupWithEmail = useCallback(async (email: string, name: string, passcode: string) => {
    const result = await signupWithEmailAction({ email, name, passcode });
    try {
      localStorage.setItem('buckets_session_token', result.token);
      localStorage.removeItem('buckets_is_locked');
    } catch {}
    setSessionToken(result.token);
    setIsLocked(false);
  }, [signupWithEmailAction]);

  const setupPasscode = useCallback(async (passcode: string, name: string) => {
    const result = await setupPasscodeAction({ passcode, name });
    try {
      localStorage.setItem('buckets_session_token', result.token);
      localStorage.removeItem('buckets_is_locked');
    } catch {}
    setSessionToken(result.token);
    setIsLocked(false);
  }, [setupPasscodeAction]);

  const unlock = useCallback(() => {
    try { localStorage.removeItem('buckets_is_locked'); } catch {}
    setIsLocked(false);
  }, []);

  const logout = useCallback(async () => {
    if (sessionToken) {
      try {
        await logoutMutation({ sessionToken });
      } catch {}
    }
    try {
      localStorage.removeItem('buckets_session_token');
      localStorage.removeItem('buckets_is_locked');
    } catch {}
    setSessionToken(null);
    setIsLocked(false);
  }, [sessionToken, logoutMutation]);

  // Auto-lock after 5 minutes of inactivity (app backgrounded/closed)
  const sessionTokenRef = useRef(sessionToken);
  sessionTokenRef.current = sessionToken;

  useEffect(() => {
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const LAST_ACTIVE_KEY = 'buckets_last_active';

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        try { localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString()); } catch {}
      } else if (document.visibilityState === 'visible') {
        if (!sessionTokenRef.current) return;
        try {
          const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
          if (lastActive) {
            const elapsed = Date.now() - parseInt(lastActive, 10);
            if (elapsed > TIMEOUT_MS) {
              // Lock instead of logout — session stays, just show passcode
              localStorage.setItem('buckets_is_locked', 'true');
              setIsLocked(true);
            }
          }
        } catch {}
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: (!sessionToken || user === undefined) ? null : (isLocked ? null : user),
        sessionToken,
        isLoading: sessionToken !== null && !isLocked && user === undefined,
        isLocked,
        login,
        signup,
        loginWithPasscode,
        loginWithEmail,
        signupWithEmail,
        setupPasscode,
        unlock,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
