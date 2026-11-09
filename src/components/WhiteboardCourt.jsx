import React from 'react';
import {getSlotKey} from '../data/whiteboardSlots';

export default function WhiteboardCourt({simPlayers, roster, phase, interaction, disabled = false}) {
  const Token = interaction ? 'button' : 'div';
  return (
    <div className="wb-court" aria-label="Pista de la pizarra">
      <div className="wb-net" />
      <div className="wb-attack-line" />
      {simPlayers.map((sim) => {
        const key = getSlotKey(sim, phase, roster);
        const person = roster.find((player) => player.slot === key);
        return (
          <Token
            key={sim.id}
            type={interaction ? 'button' : undefined}
            disabled={interaction ? disabled : undefined}
            className={`wb-token ${person ? '' : 'empty'} ${interaction?.selectedPlayer ? 'is-destination' : ''} ${interaction?.overSlot === key ? 'is-drop-over' : ''}`}
            style={{left: `${sim.x}%`, top: `${sim.y}%`, '--token-color': sim.color}}
            data-lineup-slot={interaction ? key : undefined}
            aria-label={interaction?.selectedPlayer ? `Colocar a ${interaction.selectedPlayer.name} en ${key}, zona ${sim.rotationZone}` : `${person?.name || 'Sin asignar'} en ${key}, zona ${sim.rotationZone}`}
            onClick={interaction ? (event) => interaction.chooseSlot(key, undefined, event.currentTarget) : undefined}
          >
            <strong>{person ? person.number || '—' : key}</strong>
            <span>{person ? person.name : 'Libre'}</span>
            <small>{key} · Z{sim.rotationZone}</small>
          </Token>
        );
      })}
    </div>
  );
}
