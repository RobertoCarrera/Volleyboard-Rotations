import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch, captureOAuthReturn, clearSessionToken, dataFetch, startGoogleSignIn } from '../api';

const TABLE = 'whiteboard_sets';

export default function useWhiteboardCloud({ sets, activeId, onLoad }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState('');
  const rowId = useRef(null);
  const loaded = useRef(false);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  const loadData = useCallback(async () => {
    setStatus('Cargando…');
    const res = await dataFetch(`read/${TABLE}`);
    if (res?.status !== 'success') {
      setStatus('Error al cargar');
      return;
    }
    const row = (Array.isArray(res?.data) ? res.data : [])[0];
    if (row) {
      rowId.current = row.id;
      try {
        const parsed = JSON.parse(row.state || '{}');
        if (parsed?.sets?.length) onLoadRef.current(parsed);
      } catch {
        /* estado corrupto: se sobrescribe al guardar */
      }
    }
    loaded.current = true;
    setStatus('Sincronizado');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      captureOAuthReturn();
      const res = await authFetch('get-session');
      const current = res?.data?.user;
      if (cancelled) return;
      if (current) {
        localStorage.setItem('user_id', current.id);
        setUser(current);
        await loadData();
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    if (!user || !loaded.current) return undefined;
    setStatus('Guardando…');
    const timer = setTimeout(async () => {
      const userId = localStorage.getItem('user_id');
      const payload = { name: 'Pizarra', state: JSON.stringify({ sets, activeId }), user_id: userId };
      const res = rowId.current
        ? await dataFetch(`update/${TABLE}/${rowId.current}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await dataFetch(`create/${TABLE}`, { method: 'POST', body: JSON.stringify(payload) });
      if (res?.status !== 'success') {
        setStatus('Error al guardar');
        return;
      }
      if (!rowId.current && res?.data?.id) rowId.current = res.data.id;
      else if (!rowId.current && res?.id) rowId.current = res.id;
      setStatus('Guardado');
    }, 800);
    return () => clearTimeout(timer);
  }, [sets, activeId, user]);

  const signOut = async () => {
    await authFetch('sign-out', { method: 'POST' });
    clearSessionToken();
    localStorage.removeItem('user_id');
    loaded.current = false;
    rowId.current = null;
    setUser(null);
    setStatus('');
  };

  return { user, checking, status, signInWithGoogle: startGoogleSignIn, signOut };
}
