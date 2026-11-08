import React, { useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import * as FaIcons from 'react-icons/fa';
import SafeIcon from '../common/SafeIcon';
import './WhiteboardAccount.css';

const {FiChevronDown, FiUser} = FiIcons;
const {FaGoogle} = FaIcons;

export default function WhiteboardAccount({ cloud }) {
  const { user, checking, status, signInWithGoogle, signOut } = cloud;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError('');
    const message = await signInWithGoogle();
    if (message) {
      setError(message);
      setBusy(false);
    }
  };

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
          <span>{user.name || user.email}</span>
          <SafeIcon icon={FiChevronDown} />
        </button>
        {open && (
          <div className="wb-account-menu" role="dialog" aria-label="Cuenta">
            <div className="wb-account wb-account-in">
              <span>
                <b>{user.name || user.email}</b>
                <small>{status || 'Sesión iniciada'}</small>
              </span>
              <button type="button" onClick={signOut}>Cerrar sesión</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wb-account-shell">
      <button
        type="button"
        className="wb-account-trigger wb-account-google-entry"
        onClick={handleGoogleSignIn}
        disabled={busy}
        aria-label={checking ? 'Iniciar sesión directamente con Google' : 'Iniciar sesión con Google'}
        aria-busy={busy}
      >
        <SafeIcon icon={FaGoogle} className="wb-account-google-icon" />
        <span>{busy ? 'Abriendo Google…' : 'Continuar con Google'}</span>
      </button>
      {error && <p className="wb-account-error" role="alert">{error}</p>}
    </div>
  );
}
