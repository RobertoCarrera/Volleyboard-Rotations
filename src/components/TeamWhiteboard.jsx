import React, { useEffect, useMemo, useRef, useState } from 'react';
import WhiteboardCourt from './WhiteboardCourt';
import WhiteboardBench from './WhiteboardBench';
import TeamLineupSlots from './TeamLineupSlots';
import TeamSetRoster from './TeamSetRoster';
import useWhiteboardCloud from './useWhiteboardCloud';
import useLineupInteraction from './useLineupInteraction';
import { getNextRotation, getSystemRotation } from '../data/systemRotation';
import { getSlotKey, WHITEBOARD_SYSTEMS } from '../data/whiteboardSlots';

const ROTATIONS = ['R1', 'R6', 'R5', 'R4', 'R3', 'R2'];
const makeSet = (id, source) => ({ id, name: `Set ${id}`, rotation: source?.rotation || 'R1', phase: source?.phase || 'receiving', roster: source ? source.roster.map((player) => ({ ...player })) : [] });

export default function TeamWhiteboard({ team, onRegisterFlush, onManagePlayers, disabled }) {
  const [sets, setSets] = useState(() => [makeSet(1)]);
  const [activeId, setActiveId] = useState(1);
  const nextSetId = useRef(2);
  const boardRef = useRef(null);
  const active = sets.find((set) => set.id === activeId) || sets[0];
  const system = WHITEBOARD_SYSTEMS['5-1'];

  const handleLoad = (saved) => {
    nextSetId.current = Math.max(...saved.sets.map((set) => Number(set.id) || 0), 0) + 1;
    setSets(saved.sets);
    setActiveId(saved.sets.some((set) => set.id === saved.activeId) ? saved.activeId : saved.sets[0].id);
  };
  const cloud = useWhiteboardCloud({ sets, activeId, onLoad: handleLoad, teamId: team.id });
  const locked = Boolean(disabled || cloud.checking || !cloud.isReady);
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
  const unavailable = active.roster.filter((entry) => !resolvedRoster.some((player) => player.id === entry.id));
  const simPlayers = useMemo(() => getSystemRotation(active.rotation, active.phase), [active.rotation, active.phase]);
  const onCourtKeys = simPlayers.map((sim) => getSlotKey(sim, active.phase, resolvedRoster));
  const waiting = resolvedRoster.filter((player) => player.slot && !onCourtKeys.includes(player.slot));
  const bench = resolvedRoster.filter((player) => !player.slot);

  const assign = (slot, id) => {
    if (locked || (slot != null && !system.slots.some((position) => position.key === slot))
      || !resolvedRoster.some((player) => player.id === id)) return;
    patchActive((set) => ({ roster: set.roster.map((player) => {
      if (player.id === id) return { ...player, slot };
      return slot && player.slot === slot ? { ...player, slot: null } : player;
    }) }));
  };
  const interaction = useLineupInteraction({ roster: resolvedRoster,
    scope: `${team.id}:${active.id}:${active.rotation}:${active.phase}`, disabled: locked, onAssign: assign, boardRef });
  const removePlayer = (id) => {
    if (locked) return;
    interaction.cancel();
    patchActive((set) => ({ roster: set.roster.filter((player) => player.id !== id) }));
  };
  const togglePlayer = (id, checked) => {
    if (locked) return;
    if (!checked) { removePlayer(id); return; }
    if (!team.players.some((player) => player.id === id && !player.deleted)) return;
    patchActive((set) => ({ roster: set.roster.some((player) => player.id === id) ? set.roster : [...set.roster, { id, slot: null }] }));
  };
  const addAll = () => {
    if (locked) return;
    patchActive((set) => ({ roster: [...set.roster, ...team.players
      .filter((player) => !player.deleted && !set.roster.some((entry) => entry.id === player.id))
      .map((player) => ({ id: player.id, slot: null }))] }));
  };
  const returnToBench = (id) => { interaction.cancel(); assign(null, id); };
  const addSet = () => {
    if (sets.length >= 5) return;
    const id = nextSetId.current++;
    setSets((current) => [...current, makeSet(id, active)]);
    setActiveId(id);
  };
  const removeSet = () => {
    if (sets.length <= 1) return;
    const remaining = sets.filter((set) => set.id !== active.id);
    setSets(remaining);
    setActiveId(remaining[0].id);
  };
  const draggedPlayer = interaction.drag && resolvedRoster.find((player) => player.id === interaction.drag.id);

  return (
    <section ref={boardRef} className={`wb-team-board ${interaction.selectedPlayer ? 'has-player-selection' : ''}`} aria-label={`Pizarra de ${team.name}`}>
      {cloud.checking && <p role="status">{cloud.status || 'Cargando pizarra…'}</p>}
      {cloud.error && <div className="wb-error" role="alert"><p>{cloud.error}</p><button className="wb-secondary" type="button" onClick={cloud.retry} disabled={cloud.checking}>Reintentar</button></div>}
      <fieldset className="wb-form-fields" aria-label="Editar pizarra" disabled={locked} aria-busy={cloud.checking}>
        <div className="wb-set-bar">
          <div className="wb-set-list">{sets.map((set) => <button type="button" key={set.id} className={set.id === active.id ? 'active' : ''} aria-pressed={set.id === active.id} onClick={() => setActiveId(set.id)}>{set.name}</button>)}</div>
          <button type="button" className="wb-secondary" onClick={addSet} disabled={sets.length >= 5}>Nuevo set ({sets.length}/5)</button>
        </div>
        <div className="wb-layout wb-team-layout">
          <div className="wb-stage">
            <div className="wb-controls">
              <div className="wb-phase">{Object.entries({ receiving: 'K1 · Recepción', serving: 'K2 · Saque y defensa' }).map(([phase, name]) => <button type="button" key={phase} className={active.phase === phase ? 'active' : ''} aria-pressed={active.phase === phase} onClick={() => patchActive({ phase })}>{name}</button>)}</div>
              <div className="wb-rotation">{ROTATIONS.map((rotation) => <button type="button" key={rotation} className={active.rotation === rotation ? 'active' : ''} aria-pressed={active.rotation === rotation} onClick={() => patchActive({ rotation })}>{rotation}</button>)}</div>
              <div className="wb-rotate"><button type="button" onClick={() => patchActive({ rotation: getNextRotation(active.rotation, 'backward') })}>Anterior</button><button type="button" className="primary" onClick={() => patchActive({ rotation: getNextRotation(active.rotation, 'forward') })}>Rotar</button></div>
            </div>
            <div className={`wb-placement-hint ${interaction.selectedPlayer ? 'is-active' : ''}`}>
              <p>{interaction.selectedPlayer ? <><strong>{interaction.selectedPlayer.name}</strong><span>Elige una posición en la pista o en el panel.</span></> : <><strong>Prepara tu alineación</strong><span>Convoca jugadores y colócalos en la pista.</span></>}</p>
              {interaction.selectedPlayer && <button type="button" onClick={interaction.cancel}>Cancelar</button>}
            </div>
            <WhiteboardCourt simPlayers={simPlayers} roster={resolvedRoster} phase={active.phase} interaction={interaction} disabled={locked} />
            <WhiteboardBench bench={bench} waiting={waiting} interaction={interaction} onRemove={removePlayer} disabled={locked} />
          </div>
          <aside className="wb-side">
            <div className="wb-card wb-lineup-card"><span className="eyebrow">{active.name} · {system.label}</span><h3>Posiciones del set</h3><p>Pulsa un jugador y después su posición. Aquí también puedes colocar a los centrales y líberos que esperan fuera de pista.</p><TeamLineupSlots system={system} roster={resolvedRoster} interaction={interaction} onBench={returnToBench} disabled={locked} /></div>
            <TeamSetRoster players={team.players} roster={active.roster} onToggle={togglePlayer} onAddAll={addAll} onManagePlayers={onManagePlayers} disabled={locked} />
            {unavailable.length > 0 && <div className="wb-unavailable"><p>Hay jugadores de este set que están en la papelera.</p>{unavailable.map((entry) => {
              const player = team.players.find((item) => item.id === entry.id);
              return <button className="wb-danger-text" type="button" key={entry.id} onClick={() => removePlayer(entry.id)} aria-label={`Quitar a ${player?.name || 'Jugador no disponible'} de este set`}>Quitar a {player?.name || 'jugador no disponible'}</button>;
            })}</div>}
            <button type="button" className="wb-delete" onClick={removeSet} disabled={sets.length === 1}>Eliminar este set</button>
          </aside>
        </div>
      </fieldset>
      <div className="wb-sr-only" role="status" aria-live="polite">{interaction.announcement}</div>
      {draggedPlayer && <div className="wb-drag-preview" aria-hidden="true" style={{ left: interaction.drag.x, top: interaction.drag.y }}><b>{draggedPlayer.number || '—'}</b><span>{draggedPlayer.name}</span></div>}
      <div className="wb-save-status" role="status" aria-live="polite">{cloud.error ? cloud.status : `Guardado automático en tu cuenta · ${cloud.status || 'Sincronizado'}`}</div>
    </section>
  );
}
