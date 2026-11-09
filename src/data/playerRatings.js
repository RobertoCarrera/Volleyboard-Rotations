export const PLAYER_POSITIONS = [
  { key: 'COL', label: 'Colocador', short: 'Colocador' },
  { key: 'O', label: 'Opuesto', short: 'Opuesto' },
  { key: 'R', label: 'Punta / receptor', short: 'Punta' },
  { key: 'C', label: 'Central', short: 'Central' },
  { key: 'L', label: 'Líbero', short: 'Líbero' }
];

export const SLOT_POSITION = { COL: 'COL', O: 'O', R1: 'R', R2: 'R', C1: 'C', C2: 'C', L1: 'L', L2: 'L' };
export const EMPTY_RATINGS = Object.freeze({ COL: null, O: null, R: null, C: null, L: null });
export const ratingForSlot = (player, slot) => player?.ratings?.[SLOT_POSITION[slot]] ?? null;
