import React from 'react';

function Grip() {
  return <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true">{[4, 9, 14].flatMap((y) => [4, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />))}</svg>;
}

export function LineupPlayer({ player, interaction, onRemove, disabled }) {
  const selected = interaction.selectedPlayer?.id === player.id;
  return (
    <div className={`wb-bench-player ${selected ? 'is-selected' : ''} ${interaction.drag?.id === player.id ? 'is-dragging' : ''}`}>
      <button type="button" className="wb-bench-grip" tabIndex={-1} disabled={disabled}
        aria-label={`Arrastrar a ${player.name} a una posición`} title="Arrastra a una posición"
        {...interaction.sourceHandlers(player.id)} onClick={(event) => interaction.selectPlayer(player.id, event)}><Grip /></button>
      <button type="button" className="wb-bench-select" disabled={disabled} aria-label={`Colocar a ${player.name}`} aria-pressed={selected}
        {...interaction.sourceHandlers(player.id, false)} onClick={(event) => interaction.selectPlayer(player.id, event)}>
        <span className="wb-bench-number">{player.number || '—'}</span>
        <span className="wb-bench-name">{player.name}{player.slot && <small>{player.slot}</small>}</span>
      </button>
      <button type="button" className="wb-bench-remove" disabled={disabled}
        aria-label={`Quitar a ${player.name} de este set`} title="Quitar de este set"
        onClick={() => onRemove(player.id)}><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg></button>
    </div>
  );
}

export default function WhiteboardBench({ bench, waiting, interaction, onRemove, disabled }) {
  return (
    <div className="wb-lineup-zones">
      <section className={`wb-bench ${interaction.overSlot === 'bench' ? 'is-drop-over' : ''}`} data-lineup-slot="bench" aria-label="Banquillo del set">
        <div className="wb-bench-heading"><h3>Banquillo <span>{bench.length}</span></h3><span>Listos para entrar</span></div>
        <p>Arrastra a la pista o pulsa un jugador y después una posición.</p>
        <div className="wb-bench-grid">{bench.map((player) => <LineupPlayer key={player.id} player={player} interaction={interaction} onRemove={onRemove} disabled={disabled} />)}</div>
        {!bench.length && <div className="wb-bench-empty">No hay jugadores en el banquillo.</div>}
        {interaction.selectedPlayer?.slot && <button type="button" className="wb-return-bench" disabled={disabled} onClick={(event) => interaction.chooseSlot('bench', undefined, event.currentTarget)}>Devolver a {interaction.selectedPlayer.name} al banquillo</button>}
      </section>
      {waiting.length > 0 && <section className="wb-waiting" aria-label="Jugadores en juego fuera de pista">
        <div className="wb-bench-heading"><h3>En juego fuera de pista <span>{waiting.length}</span></h3></div>
        <p>Centrales y líberos que esperan según la rotación.</p>
        <div className="wb-bench-grid">{waiting.map((player) => <LineupPlayer key={player.id} player={player} interaction={interaction} onRemove={onRemove} disabled={disabled} />)}</div>
      </section>}
    </div>
  );
}
