import React from 'react';
import { RatingBadge } from './PlayerRatings';
import { ratingForSlot } from '../data/playerRatings';

export default function TeamLineupSlots({ system, roster, interaction, onBench, disabled }) {
  return <div className="wb-lineup-slots">{system.slots.map((slot) => {
    const player = roster.find((item) => item.slot === slot.key);
    const selected = interaction.selectedPlayer;
    return <div className={`wb-lineup-slot ${interaction.overSlot === slot.key ? 'is-drop-over' : ''}`} key={slot.key}>
      <button type="button" className="wb-lineup-destination" data-lineup-slot={slot.key} disabled={disabled}
        aria-label={selected ? `Colocar a ${selected.name} en ${slot.key}` : `${slot.label}: ${player?.name || 'Libre'}`}
        onClick={(event) => interaction.chooseSlot(slot.key, undefined, event.currentTarget)}>
        <span className="wb-lineup-role"><b>{slot.key}</b><span>{slot.label}</span></span>
        <strong>{player ? `#${player.number || '—'} ${player.name}` : 'Libre'}</strong>
        <small>{slot.hint}</small>
        {(selected || player) && <RatingBadge value={ratingForSlot(selected || player, slot.key)} compact />}
      </button>
      {player && <button type="button" className="wb-slot-to-bench" disabled={disabled}
        aria-label={`Devolver a ${player.name} al banquillo`} title="Devolver al banquillo" onClick={() => onBench(player.id)}>
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5 3 9l4 4M3 9h9a4 4 0 0 1 0 8" /></svg>
      </button>}
    </div>;
  })}</div>;
}
