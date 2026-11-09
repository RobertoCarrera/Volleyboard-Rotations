import React, { useId, useState } from 'react';
import { RatingBadge } from './PlayerRatings';
import { PLAYER_POSITIONS } from '../data/playerRatings';
import './TeamSetRoster.css';

export default function TeamSetRoster({ players, roster, onToggle, onAddAll, onManagePlayers, disabled = false }) {
  const [search, setSearch] = useState('');
  const searchId = useId();
  const activePlayers = players.filter((player) => !player.deleted);
  const selected = new Map(roster.map((entry) => [entry.id, entry]));
  const selectedCount = activePlayers.filter((player) => selected.has(player.id)).length;
  const allSelected = activePlayers.length > 0 && selectedCount === activePlayers.length;
  const hasSearch = activePlayers.length > 8;
  const query = hasSearch ? search.trim().toLocaleLowerCase('es') : '';
  const filtered = activePlayers.filter((player) => `${player.name} ${player.number || ''}`.toLocaleLowerCase('es').includes(query));
  const blocked = (event) => disabled || event?.currentTarget?.matches?.(':disabled');

  return (
    <div className="wb-card wb-set-roster">
      <div className="wb-set-roster-heading">
        <div><span className="eyebrow">Convocatoria</span><h3>Jugadores del set</h3></div>
        <span className="wb-called-count" aria-live="polite"><b>{selectedCount}</b> convocados</span>
      </div>
      <p>Marca para añadir al banquillo. Desmarca para quitar de este set.</p>
      <button type="button" className="wb-add-entire-roster" disabled={disabled || !activePlayers.length || allSelected}
        onClick={(event) => { if (!blocked(event)) onAddAll(); }}>
        <svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        Añadir a todos al banquillo
      </button>
      {hasSearch && <label className="wb-set-roster-search" htmlFor={searchId}>
        <span>Buscar en la plantilla</span>
        <input id={searchId} type="search" placeholder="Nombre o dorsal" value={search} disabled={disabled}
          onChange={(event) => setSearch(event.target.value)} />
      </label>}
      {activePlayers.length === 0
        ? <p className="wb-set-roster-empty">Añade jugadores a la plantilla para preparar este set.</p>
        : <div className="wb-roster-checklist" role="group" aria-label="Convocar jugadores al set">
          {filtered.length === 0 && <p className="wb-set-roster-empty">No hay jugadores que coincidan con la búsqueda.</p>}
          {filtered.map((player) => {
            const entry = selected.get(player.id);
            return <label className={`wb-roster-choice${entry ? ' is-selected' : ''}`} key={player.id}>
              <input type="checkbox" checked={Boolean(entry)} aria-label={`Convocar a ${player.name}`} disabled={disabled}
                onChange={(event) => { if (!blocked(event)) onToggle(player.id, event.target.checked); }} />
              <span className="wb-choice-number" aria-hidden="true">{player.number || '—'}</span>
              <span className="wb-choice-details">
                <span className="wb-choice-title"><strong>{player.name}</strong><span className="wb-choice-location">{entry ? entry.slot || 'Banquillo' : 'Sin convocar'}</span></span>
                {PLAYER_POSITIONS.some(({ key }) => player.ratings?.[key] != null) && <span className="wb-rating-summary">
                  {PLAYER_POSITIONS.filter(({ key }) => player.ratings?.[key] != null).map(({ key, short }) => (
                    <RatingBadge key={key} value={player.ratings[key]} label={short} />
                  ))}
                </span>}
              </span>
            </label>;
          })}
        </div>}
      <div className="wb-set-roster-footer">
        <span>La plantilla del equipo se conserva.</span>
        <button type="button" className="wb-secondary wb-full-width" disabled={disabled}
          onClick={(event) => { if (!blocked(event)) onManagePlayers(); }}>Gestionar plantilla</button>
      </div>
    </div>
  );
}
