export const K1_STANDARD_LAYOUT={
  R1: {
    OP: {x: 6.6,y: 24.8},
    C1: {x: 50.1,y: 24.8},
    P2: {x: 84.1,y: 66.8},
    P1: {x: 17.1,y: 65.8},
    L: {x: 50.1,y: 68.7},
    C: {x: 94.7,y: 73.6}
  },
  R3: {
    C: {x: 46,y: 31}
  },
  R4: {
    P1: {x: 19.5,y: 64.5},
    P2: {x: 50,y: 68},
    L: {x: 84,y: 65}
  }
};

export const getK1PlayerPosition=(
  rotation,
  receptionScheme,
  playerId,
  fallback
)=> {
  if (receptionScheme!=='standard') return fallback;

  return K1_STANDARD_LAYOUT[rotation]?.[playerId] || fallback;
};
