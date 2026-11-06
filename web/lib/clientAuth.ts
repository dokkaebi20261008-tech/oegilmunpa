'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'oegil_session_user';
let memoryCachedUser: any = null;

export function getCachedUser(): any {
  if (memoryCachedUser) return memoryCachedUser;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      memoryCachedUser = JSON.parse(raw);
      return memoryCachedUser;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export function setCachedUser(user: any): void {
  memoryCachedUser = user;
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function useAuthUser() {
  const [currentUser, setCurrentUser] = useState<any>(() => getCachedUser());
  const [authChecking, setAuthChecking] = useState<boolean>(() => !getCachedUser());

  useEffect(() => {
    const cached = getCachedUser();
    if (cached) {
      setCurrentUser(cached);
      setAuthChecking(false);
    }

    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        if (d.authenticated && d.user) {
          setCachedUser(d.user);
          setCurrentUser(d.user);
        } else {
          setCachedUser(null);
          setCurrentUser(null);
        }
        setAuthChecking(false);
      })
      .catch(() => {
        setAuthChecking(false);
      });
  }, []);

  return { currentUser, setCurrentUser, authChecking };
}
