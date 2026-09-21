const K2_SERVING_CENTRAL_OVERRIDES={
  R3: {
    L: {
      displayRole: 'C2',
      displayName: 'Central 2',
      displayColor: '#704fbd'
    }
  },
  R6: {
    L: {
      displayRole: 'C1',
      displayName: 'Central 1',
      displayColor: '#6149a7'
    }
  }
};

export const K2_312_LAYOUT={
  R1: {
    players: {
      OP: {x: 39,y: 14},
      C1: {x: 52,y: 14},
      P2: {x: 64,y: 14},
      P1: {x: 24,y: 78},
      L: {x: 43,y: 73},
      C: {x: 84,y: 94}
    },
    defense: {
      OP: {toX: 83.5,toY: 15,controlX: 64,controlY: 31},
      C1: {toX: 52,toY: 3.5,controlX: 52,controlY: 9},
      P2: {toX: 16.5,toY: 15,controlX: 42,controlY: 32},
      P1: {toX: 50,toY: 86,controlX: 36,controlY: 82},
      L: {toX: 7,toY: 67,controlX: 25,controlY: 70},
      C: {toX: 84,toY: 72,controlX: 84,controlY: 83}
    }
  },
  R2: {
    players: {
      P1: {x: 39.7,y: 11.6},
      OP: {x: 51,y: 20.1},
      C1: {x: 66,y: 12.7},
      L: {x: 22.2,y: 79.9},
      C: {x: 60.2,y: 64.4},
      P2: {x: 83.7,y: 94.1}
    },
    defense: {
      P1: {toX: 15.5,toY: 6.7,controlX: 26.8,controlY: 15.9},
      OP: {toX: 83.7,toY: 6.7,controlX: 75.4,controlY: 21.4},
      C1: {toX: 51.3,toY: 6,controlX: 56.6,controlY: 7.8},
      L: {toX: 15.3,toY: 64.2,controlX: 18.7,controlY: 72},
      C: {toX: 84,toY: 71.1,controlX: 74.2,controlY: 67.4},
      P2: {toX: 49.1,toY: 86.4,controlX: 66.4,controlY: 90.3}
    }
  },
  R3: {
    players: {
      C1: {x: 36.8,y: 8.3},
      P1: {x: 49.7,y: 15.1},
      OP: {x: 62,y: 8},
      C: {x: 26.6,y: 77.8},
      P2: {x: 40.5,y: 66.4},
      L: {x: 85.1,y: 93.6}
    },
    defense: {
      C1: {toX: 49.9,toY: 6.1,controlX: 43.5,controlY: 6.6},
      P1: {toX: 14,toY: 6.3,controlX: 31.4,controlY: 11.2},
      OP: {toX: 84.6,toY: 6.3,controlX: 73.5,controlY: 7.2},
      C: {toX: 90.1,toY: 63.8,controlX: 63.2,controlY: 69.2},
      P2: {toX: 50.4,toY: 90.7,controlX: 45.9,controlY: 78.9},
      L: {toX: 15.2,toY: 62.6,controlX: 69.3,controlY: 89.3}
    }
  },
  R4: {
    players: {
      C: {x: 37.3,y: 12.4},
      C1: {x: 50.4,y: 13.9},
      P1: {x: 62.5,y: 12.3},
      P2: {x: 25.2,y: 79.1},
      L: {x: 47.7,y: 69.2},
      OP: {x: 83.2,y: 93.7}
    },
    defense: {
      C: {toX: 84,toY: 5.8,controlX: 65.5,controlY: 29.5},
      C1: {toX: 50.2,toY: 4.9,controlX: 50.4,controlY: 9.2},
      P1: {toX: 13.8,toY: 6.9,controlX: 38.8,controlY: 28.4},
      P2: {toX: 50.4,toY: 81.4,controlX: 37.7,controlY: 79.8},
      L: {toX: 17.3,toY: 62.2,controlX: 32.1,controlY: 65.2},
      OP: {toX: 84.1,toY: 61.8,controlX: 83.8,controlY: 77.5}
    }
  },
  R5: {
    players: {
      P2: {x: 38.8,y: 8.2},
      C: {x: 50.3,y: 14.1},
      C1: {x: 64,y: 8.9},
      L: {x: 16.2,y: 79.6},
      OP: {x: 50.2,y: 64.4},
      P1: {x: 84.1,y: 93.2}
    },
    defense: {
      P2: {toX: 16.9,toY: 5.2,controlX: 26.8,controlY: 7.2},
      C: {toX: 84.9,toY: 5.3,controlX: 76.6,controlY: 28},
      C1: {toX: 49.8,toY: 5.3,controlX: 56.6,controlY: 5.7},
      L: {toX: 16,toY: 63,controlX: 16.1,controlY: 71.3},
      OP: {toX: 84.1,toY: 65.8,controlX: 68.7,controlY: 65.2},
      P1: {toX: 51.4,toY: 89.6,controlX: 67,controlY: 91}
    }
  },
  R6: {
    players: {
      C1: {x: 36.2,y: 11.7},
      P2: {x: 49.7,y: 13.4},
      C: {x: 63,y: 11.8},
      P1: {x: 50,y: 66.5},
      OP: {x: 27.1,y: 82.8},
      L: {x: 83.2,y: 93.8}
    },
    defense: {
      C1: {toX: 49.8,toY: 3.5,controlX: 49.8,controlY: 8.4},
      P2: {toX: 15.5,toY: 6.3,controlX: 25.7,controlY: 22.1},
      C: {toX: 83.4,toY: 4.1,controlX: 73.4,controlY: 10.8},
      P1: {toX: 50,toY: 89.4,controlX: 50,controlY: 78},
      OP: {toX: 83.5,toY: 65.7,controlX: 66.4,controlY: 76.1},
      L: {toX: 15,toY: 66.9,controlX: 61.2,controlY: 82.5}
    }
  }
};

export const getK2PlayerPosition=(
  rotation,
  defenseScheme,
  playerId,
  fallback
)=> {
  const position=defenseScheme==='3-1-2'
    ? K2_312_LAYOUT[rotation]?.players[playerId] || fallback
    : fallback;
  const identity=K2_SERVING_CENTRAL_OVERRIDES[rotation]?.[playerId];

  return identity ? {...position,...identity} : position;
};

export const applyK2DefenseLayout=(
  guidance,
  rotation,
  defenseScheme
)=> {
  if (defenseScheme !=='3-1-2') return guidance;

  const layout=K2_312_LAYOUT[rotation]?.defense;
  if (!layout) return guidance;

  return guidance.map((arrow)=> ({
    ...arrow,
    ...layout[arrow.playerId]
  }));
};