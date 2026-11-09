import React, { useEffect, useState } from 'react';
import PlayerRatings, { RatingSummary } from './PlayerRatings';
import { EMPTY_RATINGS } from '../data/playerRatings';

export default function TeamPlayers({ team, busy, onSave, onRemove, onRestore, onEditingChange }) {
  const [draft, setDraft] = useState(null);
  const [trash, setTrash] = useState(false);
  const [search, setSearch] = useState('');
  const players = team.players.filter((player) => Boolean(player.deleted) === trash);
  const filtered = players.filter((player) => `${player.name} ${player.number}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')));

  useEffect(() => () => onEditingChange?.(false), [onEditingChange]);

  const edit = (player) => {
    if (busy || draft) return;
    onEditingChange?.(true);
    setDraft(player
      ? { id: player.id, name: player.name, number: player.number, ratings: { ...EMPTY_RATINGS, ...player.ratings } }
      : { name: '', number: '', ratings: { ...EMPTY_RATINGS } });
  };
  const closeDraft = () => {
    onEditingChange?.(false);
    setDraft(null);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!draft?.name.trim()) return;
    const saved = await onSave(draft.id, { name: draft.name.trim(), number: draft.number, ratings: draft.ratings });
    if (saved) closeDraft();
  };

  return (
    <section className="wb-team-players" aria-label={`Plantilla de ${team.name}`}>
      <div className="wb-section-heading">
        <div><h3>Plantilla del equipo</h3><p>Los jugadores y sus valoraciones se comparten entre todos los sets de este equipo.</p></div>
        <button type="button" className="wb-primary" onClick={() => edit(null)} disabled={busy || Boolean(draft) || team.players.length >= 200}>Nuevo jugador</button>
      </div>
      {draft && (
        <form className="wb-player-editor" aria-label="Guardar jugador" onSubmit={save}>
          <h4>{draft.id ? `Editar a ${draft.name || 'jugador'}` : 'Nuevo jugador'}</h4>
          <fieldset disabled={busy} className="wb-form-fields">
            <div className="wb-player-name-fields">
              <label>Nombre<input autoFocus required type="text" maxLength={100} aria-label="Nombre del jugador" value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label>Dorsal<input type="text" inputMode="numeric" maxLength={3} aria-label="Dorsal del jugador" value={draft.number}
                onChange={(event) => setDraft({ ...draft, number: event.target.value.replace(/\D/g, '') })} /></label>
            </div>
            <PlayerRatings ratings={draft.ratings} onChange={(ratings) => setDraft({ ...draft, ratings })} />
            <div className="wb-form-actions">
              <button type="submit" className="wb-primary" disabled={!draft.name.trim() || busy}>{busy ? 'Guardando…' : 'Guardar jugador'}</button>
              <button type="button" className="wb-secondary" onClick={closeDraft}>Cancelar</button>
            </div>
          </fieldset>
        </form>
      )}
      <div className="wb-roster-tools">
        <label className="wb-search">Buscar jugador<input type="search" placeholder="Nombre o dorsal" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <button type="button" className="wb-secondary" aria-pressed={trash} disabled={busy || Boolean(draft)} onClick={() => setTrash(!trash)}>
          {trash ? 'Ver jugadores activos' : 'Papelera de jugadores'}
        </button>
      </div>
      <p className="wb-roster-count">{players.length} {trash ? 'jugadores en la papelera' : `jugadores · Hasta 8 por set`}</p>
      {trash && <p className="wb-muted">Puedes restaurar estos jugadores. Sus posiciones se conservan en los sets hasta que los quites de ellos.</p>}
      {filtered.length === 0 && <div className="wb-empty-state">{search ? 'No hay jugadores que coincidan con la búsqueda.' : trash ? 'La papelera está vacía.' : 'Añade tu primer jugador y asígnale sus posiciones.'}</div>}
      <div className="wb-player-cards">
        {filtered.map((player) => (
          <article className={`wb-player-card ${trash ? 'is-deleted' : ''}`} key={player.id}>
            <div className="wb-player-card-head">
              <span className="wb-player-number">{player.number || '—'}</span>
              <div><h4>{player.name}</h4><span className="wb-muted">{trash ? 'En la papelera' : 'Jugador del equipo'}</span></div>
              <div className="wb-player-actions">
                {trash ? <button type="button" className="wb-secondary" aria-label={`Restaurar a ${player.name}`} onClick={() => onRestore(player)} disabled={busy || Boolean(draft)}>Restaurar</button>
                  : <>
                    <button type="button" className="wb-secondary" aria-label={`Editar a ${player.name}`} onClick={() => edit(player)} disabled={busy || Boolean(draft)}>Editar</button>
                    <button type="button" className="wb-danger-text" aria-label={`Eliminar a ${player.name}`} onClick={() => onRemove(player)} disabled={busy || Boolean(draft)}>Eliminar</button>
                  </>}
              </div>
            </div>
            <RatingSummary ratings={player.ratings} />
          </article>
        ))}
      </div>
    </section>
  );
}
