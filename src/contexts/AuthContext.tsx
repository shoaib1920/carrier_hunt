import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile } from '../../types';
import {
  subscribeAuthState,
  fetchUserProfile,
  loginUser,
  logoutUser,
  registerUser,
  updateUserProfile,
  loginWithGoogle as loginGoogle,
  loginWithGithub as loginGithub,
  completeOAuthRedirect,
} from '../services/firebaseAuth';

type AuthContextValue = {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  loginWithGoogle: (role: string) => Promise<void>;
  loginWithGithub: (role: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  setError: (error: string | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profileSyncInProgress = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const redirectProfile = await completeOAuthRedirect();
        if (!cancelled && redirectProfile) {
          setProfile(redirectProfile);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      }
    };

    void init();

    const unsubscribe = subscribeAuthState(async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      if (profileSyncInProgress.current) {
        return;
      }

      try {
        const savedProfile = await fetchUserProfile(user.uid);
        setProfile(savedProfile);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      await loginUser(email, password);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
      throw err;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, role: string) => {
    setError(null);
    profileSyncInProgress.current = true;
    setLoading(true);
    try {
      const created = await registerUser(name, email, password, role as UserProfile['role']);
      setProfile(created);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      profileSyncInProgress.current = false;
      setLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async (role: string = 'student') => {
    setError(null);
    profileSyncInProgress.current = true;
    setLoading(true);
    try {
      const userProfile = await loginGoogle(role as UserProfile['role']);
      if (userProfile) {
        setProfile(userProfile);
      }
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      profileSyncInProgress.current = false;
      setLoading(false);
    }
  }, []);

  const loginWithGithub = useCallback(async (role: string = 'student') => {
    setError(null);
    profileSyncInProgress.current = true;
    setLoading(true);
    try {
      const userProfile = await loginGithub(role as UserProfile['role']);
      if (userProfile) {
        setProfile(userProfile);
      }
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      profileSyncInProgress.current = false;
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await logoutUser();
      setProfile(null);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!profile?.uid) throw new Error('No authenticated user');
    await updateUserProfile(profile.uid, updates);
    const updatedProfile = await fetchUserProfile(profile.uid);
    setProfile(updatedProfile);
  }, [profile]);

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      loading,
      error,
      login,
      register,
      loginWithGoogle,
      loginWithGithub,
      logout,
      updateProfile,
      setError,
    }),
    [firebaseUser, profile, loading, error, login, register, loginWithGoogle, loginWithGithub, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
