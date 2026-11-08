import React from 'react';

export default function WhiteboardSlots({system, roster, onAssign}) {
  return (
    <div className="wb-slots">
      {system.slots.map((slot) => {
        const current = roster.find((player) => player.slot === slot.key);
        return (
          <label className="wb-slot" key={slot.key}>
            <span className="wb-slot-title">
              <b>{slot.key}</b> {slot.label}
            </span>
            <small>{slot.hint}</small>
            <select
              value={current?.id ?? ''}
              onChange={(event) => onAssign(slot.key, event.target.value)}
            >
              <option value="">— Banquillo / vacío —</option>
              {roster.map((player) => (
                <option
                  key={player.id}
                  value={player.id}
                  disabled={Boolean(player.slot) && player.slot !== slot.key}
                >
                  #{player.number || '—'} {player.name}
                  {player.slot && player.slot !== slot.key ? ` (${player.slot})` : ''}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
