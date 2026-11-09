import React, { useEffect, useMemo, useRef, useState } from 'react';
import WhiteboardCourt from './WhiteboardCourt';
import WhiteboardSlots from './WhiteboardSlots';
import useWhiteboardCloud from './useWhiteboardCloud';
import { RatingSummary } from './PlayerRatings';
import { getNextRotation, getSystemRotation } from '../data/systemRotation';
import { getSlotKey, MAX_ROSTER, WHITEBOARD_SYSTEMS } from '../data/whiteboardSlots';

const ROTATIONS = ['R1', 'R6', 'R5', 'R4', 'R3', 'R2'];
const makeSet = (id, source) => ({ id, name: `Set ${id}`, rotation: source?.rotation || 'R1', phase: source?.phase || 'receiving', roster: source ? source.roster.map((player) => ({ ...player })) : [] });

export default function TeamWhiteboard({ team, onRegisterFlush, onManagePlayers, disabled }) {
  const [sets, setSets] = useState(() => [makeSet(1)]);
  const [activeId, setActiveId] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const nextSetId = useRef(2);
  const active = sets.find((set) => set.id === activeId) || sets[0];
  const system = WHITEBOARD_SYSTEMS['5-1'];

  const handleLoad = (saved) => {
    nextSetId.current = Math.max(...saved.sets.map((set) => Number(set.id) || 0), 0) + 1;
    setSets(saved.sets);
    setActiveId(saved.sets.some((set) => set.id === saved.activeId) ? saved.activeId : saved.sets[0].id);
  };
  const cloud = useWhiteboardCloud({ sets, activeId, onLoad: handleLoad, teamId: team.id });
  useEffect(() => {
    onRegisterFlush?.(cloud.flush);
    return () => onRegisterFlush?.(null);
  }, [cloud.flush, onRegisterFlush]);

  const patchActive = (patch) => setSets((current) => current.map((set) => set.id === active.id
    ? { ...set, ...(typeof patch === 'function' ? patch(set) : patch) } : set));
  const resolvedRoster = active.roster.map((entry) => {
    const player = team.players.find((item) => item.id === entry.id);
    return player && !player.deleted ? { ...player, slot: entry.slot } : null;
  }).filter(Boolean);
  const available = team.players.filter((player) => !player.deleted && !active.roster.some((entry) => entry.id === player.id));
  const simPlayers = useMemo(() => getSystemRotation(active.rotation, active.phase), [active.rotation, active.phase]);
  const onCourtKeys = simPlayers.map((sim) => getSlotKey(sim, active.phase, resolvedRoster));
  const waiting = resolvedRoster.filter((player) => player.slot && !onCourtKeys.includes(player.slot));
  const bench = resolvedRoster.filter((player) => !player.slot);

  const addPlayer = (event) => {
    event.preventDefault();
    const chosen = available.find((player) => String(player.id) === selectedPlayer);
    if (!chosen || active.roster.length >= MAX_ROSTER) return;
    patchActive((set) => ({ roster: [...set.roster, { id: chosen.id, slot: null }] }));
    setSelectedPlayer('');
  };
  const assign = (slot, id) => patchActive((set) => ({ roster: set.roster.map((player) => {
    if (String(player.id) === String(id)) return { ...player, slot };
    return player.slot === slot ? { ...player, slot: null } : player;
  }) }));
  const addSet = () => {
    if (sets.length >= 5) return;
    const id = nextSetId.current++;
    setSets((current) => [...current, makeSet(id, active)]);
    setActiveId(id);
    setSelectedPlayer('');
  };
  const removeSet = () => {
    if (sets.length <= 1) return;
    const remaining = sets.filter((set) => set.id !== active.id);
    setSets(remaining);
    setActiveId(remaining[0].id);
  };

  return (
    <section className="wb-team-board" aria-label={`Pizarra de ${team.name}`}>
      {cloud.checking && <p role="status">{cloud.status || 'Cargando pizarra…'}</p>}
      {cloud.error && <div className="wb-error" role="alert"><p>{cloud.error}</p><button className="wb-secondary" type="button" onClick={cloud.retry} disabled={cloud.checking}>Reintentar</button></div>}
      <fieldset className="wb-form-fields" aria-label="Editar pizarra" disabled={disabled || cloud.checking || !cloud.isReady} aria-busy={cloud.checking}>
        <div className="wb-set-bar">
          <div className="wb-set-list">{sets.map((set) => <button type="button" key={set.id} className={set.id === active.id ? 'active' : ''} aria-pressed={set.id === active.id} onClick={() => { setActiveId(set.id); setSelectedPlayer(''); }}>{set.name}</button>)}</div>
          <button type="button" className="wb-secondary" onClick={addSet} disabled={sets.length >= 5}>Nuevo set ({sets.length}/5)</button>
        </div>
        <div className="wb-layout">
          <div className="wb-stage">
            <div className="wb-controls">
              <div className="wb-phase">{Object.entries({ receiving: 'K1 · Recepción', serving: 'K2 · Saque y defensa' }).map(([phase, name]) => <button type="button" key={phase} className={active.phase === phase ? 'active' : ''} aria-pressed={active.phase === phase} onClick={() => patchActive({ phase })}>{name}</button>)}</div>
              <div className="wb-rotation">{ROTATIONS.map((rotation) => <button type="button" key={rotation} className={active.rotation === rotation ? 'active' : ''} aria-pressed={active.rotation === rotation} onClick={() => patchActive({ rotation })}>{rotation}</button>)}</div>
              <div className="wb-rotate"><button type="button" onClick={() => patchActive({ rotation: getNextRotation(active.rotation, 'backward') })}>Anterior</button><button type="button" className="primary" onClick={() => patchActive({ rotation: getNextRotation(active.rotation, 'forward') })}>Rotar</button></div>
            </div>
            <WhiteboardCourt simPlayers={simPlayers} roster={resolvedRoster} phase={active.phase} />
            <div className="wb-zones-info">
              {[['En juego fuera de pista', waiting], ['Banquillo', bench]].map(([label, players]) => <div key={label}><strong>{label} · {players.length}</strong><div className="wb-chips">{players.length ? players.map((player) => <span className="wb-chip" key={player.id}><b>{player.number || '—'}</b> {player.name}{player.slot && <em>{player.slot}</em>}</span>) : <p>{label === 'Banquillo' ? 'Banquillo vacío.' : 'Nadie esperando.'}</p>}</div></div>)}
            </div>
          </div>
          <aside className="wb-side">
            <div className="wb-card"><span className="eyebrow">{active.name} · {system.label}</span><h3>Posiciones del set</h3><p>Elige quién juega en cada posición. Junto a cada jugador verás su valoración.</p><WhiteboardSlots system={system} roster={resolvedRoster} onAssign={assign} /></div>
            <div className="wb-card">
              <div className="wb-roster-head"><h3>Jugadores del set</h3><span>{active.roster.length}/{MAX_ROSTER}</span></div>
              <p>Elige jugadores de la plantilla. Quitarlos de este set no los elimina del equipo.</p>
              <form className="wb-select-player" onSubmit={addPlayer}>
                <label>Jugador del equipo<select aria-label="Añadir jugador al set" value={selectedPlayer} onChange={(event) => setSelectedPlayer(event.target.value)} disabled={active.roster.length >= MAX_ROSTER}><option value="">Seleccionar jugador</option>{available.map((player) => <option key={player.id} value={player.id}>#{player.number || '—'} {player.name}</option>)}</select></label>
                <button type="submit" className="wb-primary" disabled={!selectedPlayer || active.roster.length >= MAX_ROSTER}>Añadir al set</button>
              </form>
              {!team.players.some((player) => !player.deleted) && <p>Añade jugadores a la plantilla para empezar.</p>}
              <div className="wb-selected-players">{active.roster.map((entry) => {
                const player = team.players.find((item) => item.id === entry.id);
                const name = player?.name || 'Jugador no disponible';
                return <div className="wb-selected-player" key={entry.id}>
                  <div><strong>#{player?.number || '—'} {name}</strong><small>{!player || player.deleted ? 'En la papelera' : entry.slot || 'Banquillo'}</small><button type="button" className="wb-danger-text" aria-label={`Quitar a ${name} de este set`} onClick={() => patchActive((set) => ({ roster: set.roster.filter((item) => item.id !== entry.id) }))}>Quitar del set</button></div>
                  {player && !player.deleted && <RatingSummary ratings={player.ratings} />}
                </div>;
              })}</div>
              <button type="button" className="wb-secondary wb-full-width" onClick={onManagePlayers}>Gestionar plantilla</button>
            </div>
            <button type="button" className="wb-delete" onClick={removeSet} disabled={sets.length === 1}>Eliminar este set</button>
          </aside>
        </div>
      </fieldset>
      <div className="wb-save-status" role="status" aria-live="polite">{cloud.error ? cloud.status : `Guardado automático en tu cuenta · ${cloud.status || 'Sincronizado'}`}</div>
    </section>
  );
}
