import React,{useState} from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import {MAX_ROSTER} from '../data/whiteboardSlots';

const {FiPlus, FiTrash2} = FiIcons;

export default function WhiteboardRoster({roster, onAdd, onUpdate, onRemove}) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const full = roster.length >= MAX_ROSTER;

  const submit = (event) => {
    event.preventDefault();
    if (full) return;
    onAdd(name.trim() || `Jugador ${roster.length + 1}`, number);
    setName('');
    setNumber('');
  };

  return (
    <div className="wb-roster">
      <div className="wb-roster-head">
        <h3>Plantilla del set</h3>
        <span>{roster.length}/{MAX_ROSTER}</span>
      </div>
      <form className="wb-add" onSubmit={submit}>
        <input
          type="text"
          maxLength={24}
          placeholder="Nombre"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Nombre del nuevo jugador"
        />
        <input
          type="text"
          inputMode="numeric"
          maxLength={3}
          placeholder="Dorsal"
          value={number}
          onChange={(event) => setNumber(event.target.value.replace(/\D/g, ''))}
          aria-label="Dorsal del nuevo jugador"
        />
        <button type="submit" disabled={full}>
          <SafeIcon icon={FiPlus} /> Añadir
        </button>
      </form>
      <div className="wb-roster-list">
        {roster.length === 0 && <p>Añade jugadores: empezarán en el banquillo.</p>}
        {roster.map((player) => (
          <div className="wb-roster-row" key={player.id}>
            <input
              type="text"
              maxLength={3}
              value={player.number}
              onChange={(event) => onUpdate(player.id, {number: event.target.value.replace(/\D/g, '')})}
              aria-label={`Dorsal de ${player.name}`}
            />
            <input
              type="text"
              maxLength={24}
              value={player.name}
              onChange={(event) => onUpdate(player.id, {name: event.target.value})}
              aria-label={`Nombre del jugador ${player.number}`}
            />
            <em>{player.slot || 'Banquillo'}</em>
            <button type="button" onClick={() => onRemove(player.id)} aria-label={`Eliminar a ${player.name}`}>
              <SafeIcon icon={FiTrash2} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
