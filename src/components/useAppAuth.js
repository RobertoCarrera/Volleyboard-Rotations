import { useCallback, useEffect, useState } from 'react';
import { authFetch, captureOAuthReturn, clearSessionToken, startGoogleSignIn } from '../api';

export default function useAppAuth() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      captureOAuthReturn();
      const response = await authFetch('get-session');
      if (cancelled) return;
      setUser(response?.data?.user ?? null);
      setChecking(false);
    };

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await authFetch('sign-out', { method: 'POST' });
    clearSessionToken();
    localStorage.removeItem('user_id');
    setUser(null);
  }, []);

  return {
    user,
    checking,
    status: user ? 'Sesión iniciada' : '',
    signInWithGoogle: startGoogleSignIn,
    signOut
  };
}
