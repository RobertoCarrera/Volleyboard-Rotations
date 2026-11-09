import React,{useEffect,useMemo,useRef,useState} from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import WhiteboardCourt from './WhiteboardCourt';
import WhiteboardRoster from './WhiteboardRoster';
import WhiteboardSlots from './WhiteboardSlots';
import useWhiteboardCloud from './useWhiteboardCloud';
import {getNextRotation,getSystemRotation,ROTATION_SEQUENCE} from '../data/systemRotation';
import {getSlotKey,MAX_ROSTER,WHITEBOARD_SYSTEMS} from '../data/whiteboardSlots';
import './Whiteboard.css';

const {FiPlus, FiRotateCw, FiRotateCcw, FiTrash2} = FiIcons;
const SELECTOR_ORDER = ['R1', 'R6', 'R5', 'R4', 'R3', 'R2'];
const PHASES = {receiving: 'K1 · Recepción', serving: 'K2 · Saque y defensa'};

const makeSet = (id, source = null) => ({
  id,
  name: `Set ${id}`,
  rotation: source?.rotation || 'R1',
  phase: source?.phase || 'receiving',
  roster: source ? source.roster.map((player) => ({...player})) : []
});

function PlayerChip({player}) {
  return (
    <span className="wb-chip">
      <b>{player.number || '—'}</b> {player.name}
      {player.slot && <em>{player.slot}</em>}
    </span>
  );
}

export default function LegacyWhiteboard({onClose, onRegisterFlush, disabled = false}) {
  const [sets, setSets] = useState(() => [makeSet(1)]);
  const [activeId, setActiveId] = useState(1);
  const nextPlayerId = useRef(1);
  const nextSetId = useRef(2);
  const system = WHITEBOARD_SYSTEMS['5-1'];
  const active = sets.find((set) => set.id === activeId) || sets[0];

  const handleLoad = (saved) => {
    const loadedSets = saved.sets;
    const maxSet = Math.max(...loadedSets.map((set) => Number(set.id) || 0), 0);
    const maxPlayer = Math.max(
      ...loadedSets.flatMap((set) => (set.roster || []).map((player) => Number(player.id) || 0)),
      0
    );
    nextSetId.current = maxSet + 1;
    nextPlayerId.current = maxPlayer + 1;
    setSets(loadedSets);
    setActiveId(loadedSets.some((set) => set.id === saved.activeId) ? saved.activeId : loadedSets[0].id);
  };
  const cloud = useWhiteboardCloud({sets, activeId, onLoad: handleLoad});
  useEffect(() => {
    onRegisterFlush?.(cloud.flush);
    return () => onRegisterFlush?.(null);
  }, [cloud.flush, onRegisterFlush]);

  const patchActive = (patch) => setSets((current) => current.map((set) => (
    set.id === active.id ? {...set, ...(typeof patch === 'function' ? patch(set) : patch)} : set
  )));

  const simPlayers = useMemo(
    () => getSystemRotation(active.rotation, active.phase),
    [active.rotation, active.phase]
  );
  const onCourtKeys = simPlayers.map((sim) => getSlotKey(sim, active.phase, active.roster));
  const bench = active.roster.filter((player) => !player.slot);
  const waiting = active.roster.filter((player) => player.slot && !onCourtKeys.includes(player.slot));

  const addPlayer = (name, number) => {
    const id = nextPlayerId.current++;
    patchActive((set) => ({roster: [...set.roster, {id, name, number: number || String(id), slot: null}]}));
  };
  const updatePlayer = (id, changes) => patchActive((set) => ({
    roster: set.roster.map((player) => (player.id === id ? {...player, ...changes} : player))
  }));
  const removePlayer = (id) => patchActive((set) => ({roster: set.roster.filter((player) => player.id !== id)}));
  const assign = (slotKey, playerId) => patchActive((set) => ({
    roster: set.roster.map((player) => {
      if (String(player.id) === String(playerId)) return {...player, slot: slotKey};
      return player.slot === slotKey ? {...player, slot: null} : player;
    })
  }));

  const addSet = () => {
    if (sets.length >= 5) return;
    const id = nextSetId.current++;
    setSets((current) => [...current, makeSet(id, active)]);
    setActiveId(id);
  };
  const removeSet = () => {
    if (sets.length === 1) return;
    const remaining = sets.filter((set) => set.id !== active.id);
    setSets(remaining);
    setActiveId(remaining[0].id);
  };

  return (
    <section className="wb-legacy-body">
      <div className="wb-header">
        <div>
          <span className="eyebrow">Tu equipo, a tu manera</span>
          <h3>Pizarra personal</h3>
          <p>Añade tu plantilla (hasta {MAX_ROSTER} por set), asigna cada jugador a una posición y mira cómo se coloca en K1 o K2 al rotar.</p>
        </div>
        <div className="wb-header-actions">
          <button type="button" className="wb-secondary" onClick={onClose}>Volver al simulador</button>
        </div>
      </div>

      {cloud.checking && <p role="status">{cloud.status || 'Comprobando sesión…'}</p>}
      {cloud.error && (
        <div className="wb-temp" role="alert">
          <p>{cloud.error}</p>
          <button type="button" className="wb-secondary" onClick={cloud.retry} disabled={cloud.checking}>
            Reintentar
          </button>
          {!cloud.user && (
            <button type="button" className="wb-secondary" onClick={cloud.signInWithGoogle} disabled={cloud.checking}>
              Iniciar sesión con Google
            </button>
          )}
        </div>
      )}

      <fieldset
        disabled={disabled || cloud.checking || !cloud.isReady}
        aria-busy={cloud.checking}
        aria-label="Editar pizarra"
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
      <div className="wb-set-bar">
        <div className="wb-set-list">
          {sets.map((set) => (
            <button
              type="button"
              key={set.id}
              className={set.id === active.id ? 'active' : ''}
              onClick={() => setActiveId(set.id)}
            >
              {set.name}
            </button>
          ))}
        </div>
        <button type="button" className="wb-secondary" onClick={addSet} disabled={sets.length >= 5}>
          <SafeIcon icon={FiPlus} /> Nuevo set ({sets.length}/5)
        </button>
      </div>

      <div className="wb-layout">
        <div className="wb-stage">
          <div className="wb-controls">
            <div className="wb-phase">
              {Object.entries(PHASES).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={active.phase === value ? 'active' : ''}
                  onClick={() => patchActive({phase: value})}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="wb-rotation">
              {SELECTOR_ORDER.map((rotation) => (
                <button
                  type="button"
                  key={rotation}
                  className={active.rotation === rotation ? 'active' : ''}
                  onClick={() => patchActive({rotation})}
                >
                  {rotation}
                </button>
              ))}
            </div>
            <div className="wb-rotate">
              <button type="button" onClick={() => patchActive({rotation: getNextRotation(active.rotation, 'backward')})}>
                <SafeIcon icon={FiRotateCcw} /> Anterior
              </button>
              <button type="button" className="primary" onClick={() => patchActive({rotation: getNextRotation(active.rotation, 'forward')})}>
                Rotar <SafeIcon icon={FiRotateCw} />
              </button>
            </div>
          </div>

          <WhiteboardCourt simPlayers={simPlayers} roster={active.roster} phase={active.phase} />

          <div className="wb-zones-info">
            <div>
              <strong>En juego fuera de pista · {waiting.length}</strong>
              <div className="wb-chips">
                {waiting.length ? waiting.map((player) => <PlayerChip key={player.id} player={player} />) : <p>Nadie esperando.</p>}
              </div>
            </div>
            <div>
              <strong>Banquillo · {bench.length}</strong>
              <div className="wb-chips">
                {bench.length ? bench.map((player) => <PlayerChip key={player.id} player={player} />) : <p>Banquillo vacío.</p>}
              </div>
            </div>
          </div>
        </div>

        <aside className="wb-side">
          <div className="wb-card">
            <span className="eyebrow">{active.name} · {system.label}</span>
            <h3>Posiciones del set</h3>
            <p>Elige quién ocupa cada posición. Los centrales y líberos que esperan se muestran fuera de pista.</p>
            <WhiteboardSlots system={system} roster={active.roster} onAssign={assign} />
          </div>
          <div className="wb-card">
            <WhiteboardRoster
              roster={active.roster}
              onAdd={addPlayer}
              onUpdate={updatePlayer}
              onRemove={removePlayer}
            />
          </div>
          <button type="button" className="wb-delete" onClick={removeSet} disabled={sets.length === 1}>
            <SafeIcon icon={FiTrash2} /> Eliminar este set
          </button>
          <div className="wb-temp" role="status" aria-live="polite">
            {cloud.checking || cloud.error
              ? cloud.status
              : cloud.user
              ? `Guardado automático en tu cuenta · ${cloud.status || 'Sincronizado'}`
              : 'Sesión temporal · Inicia sesión para guardar tu pizarra.'}
          </div>
        </aside>
      </div>
      </fieldset>
    </section>
  );
}
