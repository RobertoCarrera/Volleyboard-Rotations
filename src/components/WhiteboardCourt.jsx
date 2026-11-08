import React from 'react';
import {getSlotKey} from '../data/whiteboardSlots';

export default function WhiteboardCourt({simPlayers, roster, phase}) {
  return (
    <div className="wb-court" aria-label="Pista de la pizarra">
      <div className="wb-net" />
      <div className="wb-attack-line" />
      {simPlayers.map((sim) => {
        const key = getSlotKey(sim, phase, roster);
        const person = roster.find((player) => player.slot === key);
        return (
          <div
            key={sim.id}
            className={`wb-token ${person ? '' : 'empty'}`}
            style={{left: `${sim.x}%`, top: `${sim.y}%`, '--token-color': sim.color}}
            aria-label={`${person?.name || 'Sin asignar'} en ${key}, zona ${sim.rotationZone}`}
          >
            <strong>{person ? person.number || '—' : key}</strong>
            <span>{person ? person.name : 'Libre'}</span>
            <small>{key} · Z{sim.rotationZone}</small>
          </div>
        );
      })}
    </div>
  );
}
