export const MAX_ROSTER = 8;

export const WHITEBOARD_SYSTEMS = {
  '5-1': {
    label: 'Sistema 5-1',
    slots: [
      {key: 'COL', label: 'Colocador', hint: 'Siempre en pista'},
      {key: 'O', label: 'Opuesto', hint: 'Frente o fondo'},
      {key: 'R1', label: 'Receptor 1', hint: 'Punta'},
      {key: 'R2', label: 'Receptor 2', hint: 'Punta'},
      {key: 'C1', label: 'Central 1', hint: 'Sale por el líbero en zaga'},
      {key: 'C2', label: 'Central 2', hint: 'Sale por el líbero en zaga'},
      {key: 'L1', label: 'Líbero 1', hint: 'Recepción (K1) y defensa si no hay Líbero 2'},
      {key: 'L2', label: 'Líbero 2', hint: 'Solo defensa (K2), opcional'}
    ]
  }
};

export const getSlotKey = (simPlayer, phase, roster) => {
  if (simPlayer.role !== 'L') return simPlayer.role;
  const hasSecond = roster.some((player) => player.slot === 'L2');
  return phase === 'serving' && hasSecond ? 'L2' : 'L1';
};
