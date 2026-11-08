import React, { useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import * as FaIcons from 'react-icons/fa';
import SafeIcon from '../common/SafeIcon';
import './WhiteboardAccount.css';

const {FiChevronDown, FiUser} = FiIcons;
const {FaGoogle} = FaIcons;

export default function WhiteboardAccount({ cloud }) {
  const { user, checking, status, error: sessionError, signInWithGoogle, signOut, retrySession } = cloud;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const visibleError = error || sessionError;

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError('');
    const message = await signInWithGoogle();
    if (message) {
      setError(message);
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setError('');
    const message = await signOut();
    if (message) setError(message);
    setBusy(false);
  };

  const errorNotice = visibleError && (
    <div className="wb-account-error" role="alert">
      <p>{visibleError}</p>
      {sessionError && retrySession && (
        <button type="button" disabled={checking || busy} onClick={() => { setError(''); retrySession(); }}>
          Comprobar sesión de nuevo
        </button>
      )}
    </div>
  );

  if (user) {
    return (
      <div className="wb-account-shell">
        <button
          type="button"
          className="wb-account-trigger"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <SafeIcon icon={FiUser} />
          <span>{user.name || user.email || 'Mi cuenta'}</span>
          <SafeIcon icon={FiChevronDown} />
        </button>
        {open && (
          <div className="wb-account-menu" role="dialog" aria-label="Cuenta">
            <div className="wb-account wb-account-in">
              <span>
                <b>{user.name || user.email}</b>
                <small>{status || 'Sesión iniciada'}</small>
              </span>
              <button type="button" onClick={handleSignOut} disabled={busy || checking}>
                {busy ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </button>
            </div>
          </div>
        )}
        {errorNotice}
      </div>
    );
  }

  return (
    <div className="wb-account-shell">
      <button
        type="button"
        className="wb-account-trigger wb-account-google-entry"
        onClick={handleGoogleSignIn}
        disabled={busy || checking}
        aria-label={checking ? 'Comprobando sesión' : 'Iniciar sesión con Google'}
        aria-busy={busy || checking}
      >
        <SafeIcon icon={FaGoogle} className="wb-account-google-icon" />
        <span>{busy ? 'Abriendo Google…' : checking ? 'Comprobando sesión…' : 'Continuar con Google'}</span>
      </button>
      {errorNotice}
    </div>
  );
}
