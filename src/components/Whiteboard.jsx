import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPlayer, createTeam, deletePlayer, deleteTeam, getTeam, listTeams, updatePlayer, updateTeam } from '../api';
import LegacyWhiteboard from './LegacyWhiteboard';
import TeamWhiteboard from './TeamWhiteboard';
import TeamPlayers from './TeamPlayers';
import './Whiteboard.css';

export default function Whiteboard({ onClose }) {
  const [teams, setTeams] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [teamData, setTeamData] = useState(null);
  const [view, setView] = useState('board');
  const [loading, setLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [teamError, setTeamError] = useState('');
  const [listAttempt, setListAttempt] = useState(0);
  const [teamAttempt, setTeamAttempt] = useState(0);
  const [teamForm, setTeamForm] = useState(null);
  const [playerEditing, setPlayerEditing] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [notice, setNotice] = useState('');
  const flushRef = useRef(null);
  const playerEditingRef = useRef(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const currentTeam = teamData?.id === Number(selectedId) ? teamData : null;
  const activeTeams = teams.filter((team) => !team.deleted);
  const deletedTeams = teams.filter((team) => team.deleted);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListError('');
    const load = async () => {
      const response = await listTeams({ signal: controller.signal });
      if (controller.signal.aborted) return;
      if (response.status !== 'success') setListError(response.error || 'No se pudieron cargar tus equipos.');
      else {
        setTeams(response.data);
        setSelectedId((current) => current || String(response.data.find((team) => !team.deleted)?.id || 'personal'));
      }
      setLoading(false);
    };
    void load();
    return () => controller.abort();
  }, [listAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    setTeamData(null);
    setTeamError('');
    if (!selectedId || selectedId === 'personal') {
      setTeamLoading(false);
      return () => controller.abort();
    }
    setTeamLoading(true);
    const load = async () => {
      const response = await getTeam(Number(selectedId), { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (response.status !== 'success') setTeamError(response.error || 'No se pudo cargar la plantilla del equipo.');
      else setTeamData(response.data);
      setTeamLoading(false);
    };
    void load();
    return () => controller.abort();
  }, [selectedId, teamAttempt]);

  const registerFlush = useCallback((flush) => { flushRef.current = flush; }, []);
  const updateEditing = useCallback((editing) => {
    playerEditingRef.current = editing;
    setPlayerEditing(editing);
  }, []);

  // Save the current board before changing its team or catalogue. A failed
  // save leaves the component mounted, with its local edits and retry intact.
  const perform = async (operation) => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (flushRef.current && !await flushRef.current()) {
        if (mounted.current) setError('Hay cambios de la pizarra sin guardar. Reintenta el guardado antes de continuar.');
        return false;
      }
      const result = await operation();
      return result !== false;
    } catch {
      if (mounted.current) setError('No se pudo completar el cambio. Inténtalo de nuevo.');
      return false;
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const accept = (response) => {
    if (!mounted.current) return false;
    if (response.status !== 'success') {
      setError(response.error || 'No se pudo guardar el cambio.');
      return false;
    }
    return true;
  };

  const selectTeam = (id) => {
    if (id === selectedId) return Promise.resolve(true);
    return perform(async () => {
      setSelectedId(id);
      setView('board');
      setConfirmation(null);
      setTeamForm(null);
      return true;
    });
  };

  const openRoster = () => perform(async () => { setView('players'); return true; });

  const saveTeam = async (event) => {
    event.preventDefault();
    if (playerEditingRef.current) {
      setError('Guarda o cancela la edición del jugador antes de cambiar de equipo.');
      return;
    }
    const name = teamForm?.name.trim();
    if (!name) return;
    await perform(async () => {
      const response = teamForm.id ? await updateTeam(teamForm.id, { name }) : await createTeam({ name });
      if (!accept(response)) return false;
      const saved = response.data;
      setTeams((current) => teamForm.id ? current.map((team) => team.id === saved.id ? { ...team, ...saved } : team) : [...current, saved]);
      if (currentTeam?.id === saved.id) setTeamData((current) => ({ ...current, name: saved.name }));
      setSelectedId(String(saved.id));
      setTeamForm(null);
      setNotice('Equipo guardado.');
      return true;
    });
  };

  const savePlayer = (playerId, data) => perform(async () => {
    const response = playerId ? await updatePlayer(currentTeam.id, playerId, data) : await createPlayer(currentTeam.id, data);
    if (!accept(response)) return false;
    const saved = response.data;
    setTeamData((current) => ({ ...current, players: playerId ? current.players.map((player) => player.id === saved.id ? saved : player) : [...current.players, saved] }));
    setNotice('Jugador guardado. Sus datos se usan en todos los sets de este equipo.');
    return true;
  });

  const restorePlayer = (player) => perform(async () => {
    const response = await updatePlayer(currentTeam.id, player.id, { deleted: false });
    if (!accept(response)) return false;
    setTeamData((current) => ({ ...current, players: current.players.map((item) => item.id === player.id ? { ...item, ...response.data, deleted: false } : item) }));
    setNotice(`${player.name} se ha restaurado.`);
    return true;
  });

  const restoreTeam = (team) => perform(async () => {
    const response = await updateTeam(team.id, { deleted: false });
    if (!accept(response)) return false;
    setTeams((current) => current.map((item) => item.id === team.id ? { ...item, ...response.data, deleted: false } : item));
    setSelectedId(String(team.id));
    setView('board');
    setShowTrash(false);
    setNotice(`${team.name} se ha restaurado.`);
    return true;
  });

  const confirmDelete = () => perform(async () => {
    if (!confirmation) return false;
    const { kind, item } = confirmation;
    const response = kind === 'team' ? await deleteTeam(item.id) : await deletePlayer(currentTeam.id, item.id);
    if (!accept(response)) return false;
    if (kind === 'team') {
      setTeams((current) => current.map((team) => team.id === item.id ? { ...team, deleted: true } : team));
      setSelectedId('personal');
      setView('board');
    } else {
      setTeamData((current) => ({ ...current, players: current.players.map((player) => player.id === item.id ? { ...player, deleted: true } : player) }));
    }
    setConfirmation(null);
    setNotice(`${item.name} se ha movido a la papelera.`);
    return true;
  });

  const controlsDisabled = busy || loading || teamLoading || playerEditing || Boolean(confirmation);
  return (
    <section className="whiteboard">
      <div className="wb-header">
        <div><span className="eyebrow">Tu equipo, a tu manera</span><h2>Pizarra</h2><p>Guarda tus equipos, valora a tus jugadores y prepara hasta 5 sets por equipo.</p></div>
        <button type="button" className="wb-secondary" onClick={onClose}>Volver al simulador</button>
      </div>

      {loading && <p role="status">Cargando tus equipos…</p>}
      {listError && <div className="wb-error" role="alert"><p>{listError}</p><button type="button" className="wb-secondary" onClick={() => setListAttempt((value) => value + 1)}>Reintentar equipos</button></div>}
      {!loading && !listError && <>
        <div className="wb-team-toolbar">
          <label className="wb-team-select">Equipo<select aria-label="Equipo de la pizarra" value={selectedId} disabled={controlsDisabled || Boolean(teamForm)} onChange={(event) => { void selectTeam(event.target.value); }}>
            <option value="personal">Pizarra personal</option>
            {activeTeams.map((team) => <option key={team.id} value={String(team.id)}>{team.name}</option>)}
          </select></label>
          <div className="wb-team-actions">
            <button type="button" className="wb-primary" disabled={controlsDisabled || Boolean(teamForm) || teams.length >= 100} onClick={() => setTeamForm({ name: '' })}>Nuevo equipo</button>
            {currentTeam && <><button type="button" className="wb-secondary" disabled={controlsDisabled || Boolean(teamForm)} onClick={() => setTeamForm({ id: currentTeam.id, name: currentTeam.name })}>Editar equipo</button><button type="button" className="wb-danger-text" disabled={controlsDisabled || Boolean(teamForm)} onClick={() => setConfirmation({ kind: 'team', item: currentTeam })}>Eliminar equipo</button></>}
            <button type="button" className="wb-secondary" disabled={controlsDisabled || Boolean(teamForm)} aria-expanded={showTrash} onClick={() => setShowTrash(!showTrash)}>Papelera de equipos{deletedTeams.length ? ` (${deletedTeams.length})` : ''}</button>
          </div>
        </div>

        {teamForm && <form className="wb-inline-editor" aria-label={teamForm.id ? 'Editar equipo' : 'Crear equipo'} onSubmit={saveTeam}>
          <label>Nombre del equipo<input autoFocus required maxLength={100} type="text" aria-label="Nombre del equipo" value={teamForm.name} disabled={busy} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} /></label>
          <div className="wb-form-actions"><button type="submit" className="wb-primary" disabled={busy || !teamForm.name.trim()}>{busy ? 'Guardando…' : teamForm.id ? 'Guardar equipo' : 'Crear equipo'}</button><button type="button" className="wb-secondary" disabled={busy} onClick={() => setTeamForm(null)}>Cancelar</button></div>
        </form>}

        {error && <div className="wb-error" role="alert"><p>{error}</p></div>}
        {notice && <p className="wb-notice" role="status">{notice}</p>}
        {confirmation && <div className="wb-confirmation" role="dialog" aria-modal="false" aria-labelledby="wb-confirm-title">
          <h3 id="wb-confirm-title">Eliminar {confirmation.item.name}</h3>
          <p>{confirmation.kind === 'team' ? 'El equipo dejará de aparecer entre tus equipos activos. Su plantilla y sus sets se conservarán y podrás recuperarlos desde la papelera.' : 'El jugador dejará de aparecer en la pista y entre los disponibles. Puedes restaurarlo desde la papelera; sus asignaciones se conservan hasta que lo quites de cada set.'}</p>
          <div className="wb-form-actions"><button type="button" className="wb-delete" disabled={busy} onClick={confirmDelete}>Confirmar eliminación</button><button type="button" className="wb-secondary" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</button></div>
        </div>}

        {showTrash && <section className="wb-team-trash" aria-label="Equipos eliminados"><h3>Papelera de equipos</h3><p>Los equipos eliminados conservan sus jugadores y sus sets.</p>{deletedTeams.length ? deletedTeams.map((team) => <div className="wb-trash-row" key={team.id}><strong>{team.name}</strong><button type="button" className="wb-secondary" disabled={controlsDisabled} aria-label={`Restaurar equipo ${team.name}`} onClick={() => restoreTeam(team)}>Restaurar</button></div>) : <p>La papelera está vacía.</p>}</section>}

        {teamLoading && <p role="status">Cargando plantilla del equipo…</p>}
        {teamError && <div className="wb-error" role="alert"><p>{teamError}</p><button type="button" className="wb-secondary" onClick={() => setTeamAttempt((value) => value + 1)}>Reintentar plantilla</button></div>}
        {selectedId === 'personal' && <><p className="wb-personal-note">Aquí se conservan tus sets anteriores. Crea un equipo para gestionar una plantilla y sus valoraciones.</p><LegacyWhiteboard onClose={onClose} onRegisterFlush={registerFlush} disabled={busy || loading || teamLoading || Boolean(confirmation) || Boolean(teamForm)} /></>}
        {currentTeam && !teamLoading && <>
          <div className="wb-view-tabs" aria-label="Vista del equipo"><button type="button" aria-pressed={view === 'board'} className={view === 'board' ? 'active' : ''} disabled={busy || playerEditing || Boolean(confirmation) || Boolean(teamForm)} onClick={() => setView('board')}>Pizarra</button><button type="button" aria-pressed={view === 'players'} className={view === 'players' ? 'active' : ''} disabled={busy || playerEditing || Boolean(confirmation) || Boolean(teamForm)} onClick={openRoster}>Plantilla</button></div>
          <div hidden={view !== 'board'}><TeamWhiteboard key={currentTeam.id} team={currentTeam} onRegisterFlush={registerFlush} onManagePlayers={openRoster} disabled={busy || Boolean(confirmation) || Boolean(teamForm)} /></div>
          {view === 'players' && <TeamPlayers key={currentTeam.id} team={currentTeam} busy={busy || Boolean(confirmation) || Boolean(teamForm)} onSave={savePlayer} onRemove={(player) => setConfirmation({ kind: 'player', item: player })} onRestore={restorePlayer} onEditingChange={updateEditing} />}
        </>}
      </>}
    </section>
  );
}
