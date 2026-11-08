import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTH_STATE_EVENT, authFetch, captureOAuthReturn, endSession, startGoogleSignIn } from '../api';

export default function useAppAuth() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    const controller = new AbortController();
    const callbackError = captureOAuthReturn();
    if (callbackError) setError(callbackError);
    setChecking(true);

    const restoreSession = async () => {
      const response = await authFetch('get-session', { signal: controller.signal });
      if (cancelled || controller.signal.aborted) return;
      if (response.status === 'success') {
        setUser(response.data?.user ?? null);
        if (response.data?.user) setError('');
      } else {
        setError(response.error);
      }
      setChecking(false);
    };

    const handleAuthState = (event) => {
      if (event.detail === 'signing-out') {
        controller.abort();
        setChecking(true);
      } else if (event.detail === 'signed-out') {
        controller.abort();
        setUser(null);
        setError('');
        setChecking(false);
      } else if (event.detail === 'signout-failed') {
        setChecking(false);
      }
    };

    window.addEventListener(AUTH_STATE_EVENT, handleAuthState);
    restoreSession();
    return () => {
      cancelled = true;
      mounted.current = false;
      controller.abort();
      window.removeEventListener(AUTH_STATE_EVENT, handleAuthState);
    };
  }, [attempt]);

  const signOut = useCallback(async () => {
    setError('');
    const message = await endSession();
    if (message && mounted.current) setError(message);
    return message;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError('');
    const message = await startGoogleSignIn();
    if (message && mounted.current) setError(message);
    return message;
  }, []);

  const retrySession = useCallback(() => {
    setError('');
    setAttempt((current) => current + 1);
  }, []);

  return {
    user,
    checking,
    error,
    status: user ? 'Sesión iniciada' : '',
    signInWithGoogle,
    signOut,
    retrySession
  };
}
