import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTH_STATE_EVENT, authFetch, endSession, loadWhiteboard, saveWhiteboard, startGoogleSignIn } from '../api';

export default function useWhiteboardCloud({ sets, activeId, onLoad, teamId }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  const latest = useRef({ sets, activeId });
  const onLoadRef = useRef(onLoad);
  latest.current = { sets, activeId };
  onLoadRef.current = onLoad;

  const mounted = useRef(false);
  const generation = useRef(0);
  const loaded = useRef(false);
  const restoring = useRef(null);
  const lastSaved = useRef(null);
  const pending = useRef(null);
  const paused = useRef(false);
  const signingOut = useRef(false);
  const errorPhase = useRef('');
  const timer = useRef(null);
  const loadController = useRef(null);
  const saveController = useRef(null);
  const saveTask = useRef(null);

  const stopRequests = useCallback(() => {
    generation.current += 1;
    clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    loadController.current?.abort();
    saveController.current?.abort();
    loadController.current = null;
    saveController.current = null;
    saveTask.current = null;
  }, []);

  // Keep writes in order: a slower response must not let an older board
  // overwrite a newer one. Edits made during a save are sent afterwards.
  const flushPending = useCallback(() => {
    if (saveTask.current) return saveTask.current;
    if (!mounted.current || !loaded.current || paused.current || signingOut.current) return Promise.resolve(false);
    const currentGeneration = generation.current;
    const task = (async () => {
      while (pending.current) {
        const snapshot = pending.current;
        pending.current = null;
        if (snapshot === lastSaved.current) continue;
        const controller = new AbortController();
        saveController.current = controller;
        setStatus('Guardando…');
        let response;
        try {
          response = await saveWhiteboard(JSON.parse(snapshot), { teamId, signal: controller.signal });
        } catch {
          response = { status: 'error', error: 'No se pudo guardar la pizarra. Tus cambios siguen en esta pantalla.' };
        }
        if (saveController.current === controller) saveController.current = null;
        if (!mounted.current || controller.signal.aborted || generation.current !== currentGeneration) return false;
        if (response.status !== 'success') {
          paused.current = true;
          errorPhase.current = 'save';
          setError(response.error || 'No se pudo guardar la pizarra. Tus cambios siguen en esta pantalla.');
          setStatus('Cambios sin guardar');
          return false;
        }
        lastSaved.current = snapshot;
        errorPhase.current = '';
        setError('');
        const newest = JSON.stringify(latest.current);
        pending.current = newest !== snapshot ? newest : null;
        setStatus(pending.current ? 'Guardando…' : 'Guardado');
      }
      return generation.current === currentGeneration && lastSaved.current === JSON.stringify(latest.current);
    })();
    saveTask.current = task;
    void task.finally(() => { if (saveTask.current === task) saveTask.current = null; });
    return task;
  }, [teamId]);

  // A workspace switch may unmount this board. It must wait for the current
  // request and any newer edits, rather than cancelling the debounce silently.
  const flush = useCallback(async () => {
    if (!mounted.current || !loaded.current || paused.current || signingOut.current || restoring.current) return false;
    clearTimeout(timer.current);
    timer.current = null;
    const snapshot = JSON.stringify(latest.current);
    pending.current = snapshot !== lastSaved.current ? snapshot : null;
    return flushPending();
  }, [flushPending]);

  const retryLoad = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    mounted.current = true;
    stopRequests();
    loaded.current = false;
    setIsReady(false);
    restoring.current = null;
    lastSaved.current = null;
    paused.current = false;
    signingOut.current = false;
    errorPhase.current = '';
    setChecking(true);
    setError('');
    setStatus('Cargando pizarra…');
    const controller = new AbortController();
    loadController.current = controller;
    const currentGeneration = generation.current;
    const isCurrent = () => mounted.current && !controller.signal.aborted && generation.current === currentGeneration;

    const restore = async () => {
      const session = await authFetch('get-session', { signal: controller.signal });
      if (!isCurrent()) return;
      if (session.status !== 'success' || !session.data?.user) {
        errorPhase.current = 'load';
        setUser(null);
        setError(session.error || 'Inicia sesión con Google para cargar y guardar tu pizarra.');
        setStatus('Sin sincronizar');
        setChecking(false);
        return;
      }
      setUser(session.data.user);
      const response = await loadWhiteboard({ teamId, signal: controller.signal });
      if (!isCurrent()) return;
      if (response.status !== 'success') {
        errorPhase.current = 'load';
        setError(response.error);
        setStatus('Sin sincronizar');
        setChecking(false);
        return;
      }
      if (response.data) {
        lastSaved.current = JSON.stringify(response.data);
        restoring.current = lastSaved.current;
        onLoadRef.current(response.data);
      } else {
        // An empty account is a baseline, not a reason to write default data.
        lastSaved.current = JSON.stringify(latest.current);
      }
      loaded.current = true;
      setIsReady(true);
      setStatus(response.data ? 'Sincronizado' : 'Se guardará al hacer cambios');
      setChecking(false);
      setRevision((current) => current + 1);
    };

    const handleAuthState = (event) => {
      if (event.detail === 'signing-out') {
        signingOut.current = true;
        stopRequests();
        setChecking(true);
      } else if (event.detail === 'signed-out') {
        stopRequests();
        loaded.current = false;
        setIsReady(false);
        signingOut.current = false;
        setUser(null);
        setError('');
        setStatus('');
        setChecking(false);
      } else if (event.detail === 'signout-failed') {
        signingOut.current = false;
        if (loaded.current) {
          setChecking(false);
          setRevision((current) => current + 1);
        } else {
          retryLoad();
        }
      }
    };

    window.addEventListener(AUTH_STATE_EVENT, handleAuthState);
    void restore();
    return () => {
      mounted.current = false;
      window.removeEventListener(AUTH_STATE_EVENT, handleAuthState);
      stopRequests();
    };
  }, [attempt, retryLoad, stopRequests, teamId]);

  useEffect(() => {
    if (!user || checking || !loaded.current || paused.current || signingOut.current) return undefined;
    const snapshot = JSON.stringify({ sets, activeId });
    if (restoring.current) {
      // Wait until the parent's onLoad update has actually reached this hook.
      if (snapshot !== restoring.current) return undefined;
      restoring.current = null;
    }
    if (snapshot === lastSaved.current && !saveController.current) return undefined;
    setStatus('Cambios pendientes…');
    const scheduled = setTimeout(() => {
      timer.current = null;
      pending.current = snapshot;
      void flushPending();
    }, 800);
    timer.current = scheduled;
    return () => {
      clearTimeout(scheduled);
      if (timer.current === scheduled) timer.current = null;
    };
  }, [sets, activeId, user, checking, revision, flushPending]);

  const retry = useCallback(() => {
    if (errorPhase.current === 'save' && loaded.current) {
      paused.current = false;
      setError('');
      pending.current = JSON.stringify(latest.current);
      void flushPending();
    } else {
      retryLoad();
    }
  }, [flushPending, retryLoad]);

  const signInWithGoogle = useCallback(async () => {
    setError('');
    setChecking(true);
    setStatus('Abriendo Google…');
    const message = await startGoogleSignIn();
    if (message && mounted.current) {
      setError(message);
      setChecking(false);
    }
    return message;
  }, []);

  return {
    user, checking, isReady, status, error, retry, retryLoad, flush,
    signInWithGoogle,
    signOut: endSession
  };
}
