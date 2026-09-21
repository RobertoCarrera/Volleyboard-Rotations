export const ZONES = {
  1: {x: 83.33, y: 68, title: 'Zaguero derecho', short: 'Saque'},
  2: {x: 83.33, y: 27, title: 'Delantero derecho', short: 'Red'},
  3: {x: 50, y: 27, title: 'Delantero centro', short: 'Red'},
  4: {x: 16.67, y: 27, title: 'Delantero izquierdo', short: 'Red'},
  5: {x: 16.67, y: 68, title: 'Zaguero izquierdo', short: 'Fondo'},
  6: {x: 50, y: 68, title: 'Zaguero centro', short: 'Fondo'}
};

export const ROTATION_ORDER = [1, 6, 5, 4, 3, 2];

export const SYSTEMS = {
  '5-1': {
    label: 'Sistema 5-1',
    description: ''
  },
  '4-2': {
    label: 'Sistema 4-2',
    description: 'Dos colocadores se reparten la organización del juego y siempre hay un colocador delantero.'
  }
};

export const TACTICAL_PHASES = {
  receiving: {
    label: 'Recepción · K1',
    description: 'La recepción se organiza con tres receptores o con dos receptores y un apoyo adelantado.'
  },
  serving: {
    label: 'Saque y defensa · K2',
    description: 'En K2 se muestran los sistemas defensivos 3-1-2 y 3-2-1. La formación defensiva no cambia el orden reglamentario.'
  },
  postServe: {
    label: 'Después del saque · especialización',
    description: 'Tras el saque, cada jugador se desplaza a su zona especializada ofensiva o defensiva.'
  }
};

export const RECEPTION_SCHEMES = {
  standard: {
    label: '3 en línea · Estándar',
    description: ''
  },
  support: {
    label: '2+1',
    description: 'L y R1 reciben en fondo; R2 avanza como receptor de apoyo.'
  }
};

export const DEFENSE_SCHEMES = {
  '3-1-2': {
    label: '3-1-2 · 6 adelantado',
    description: 'Tres bloqueadores en red, el jugador de zona 6 cubre fintas y 5/1 defienden el fondo.'
  },
  '3-2-1': {
    label: '3-2-1 · 6 atrás',
    description: 'Tres bloqueadores en red, 5/1 cubren las líneas laterales y 6 protege el fondo.'
  }
};

export const SPECIALIZED_LIBERO_ZONES = [5, 6];

const ROLE_ORDER = ['C', 'OP', 'P1', 'P2', 'C1', 'L'];

const ROLE_DETAILS = {
  C: {
    name: 'Colocador',
    role: 'COL',
    color: '#173e8c'
  },
  OP: {
    name: 'Opuesto',
    role: 'O',
    color: '#b83f2d'
  },
  P1: {
    name: 'Receptor 1',
    role: 'R2',
    color: '#087554'
  },
  P2: {
    name: 'Receptor 2',
    role: 'R1',
    color: '#a53d76'
  },
  C1: {
    name: 'Central 1',
    role: 'C1',
    color: '#6149a7'
  },
  C2: {
    name: 'Central 2',
    role: 'C2',
    color: '#704fbd'
  },
  L: {
    name: 'Líbero',
    role: 'L',
    color: '#1f6d9f'
  }
};

const BASE_ROLE_ZONES = {
  C: 1,
  OP: 4,
  P1: 5,
  P2: 2,
  C1: 3,
  L: 6
};

const CENTRAL_TWO_ROTATIONS = ['R1', 'R2', 'R6'];

export const getDisplayedRole = (playerId, rotation = 'R1') => {
  if (playerId === 'C') return 'COL';
  if (playerId === 'OP') return 'O';
  if (playerId === 'P1') return 'R2';
  if (playerId === 'P2') return 'R1';

  if (playerId === 'C1') {
    return CENTRAL_TWO_ROTATIONS.includes(rotation) ? 'C2' : 'C1';
  }

  if (playerId === 'L') return 'L';
  return 'L';
};

export const getDisplayedName = (playerId, rotation = 'R1') => {
  const role = getDisplayedRole(playerId, rotation);
  const entry = Object.values(ROLE_DETAILS).find(
    (item) => item.role === role
  );

  return entry?.name || role;
};

const getNextZone = (zone, steps) => {
  const index = ROTATION_ORDER.indexOf(zone);

  return ROTATION_ORDER[
    (index + steps) % ROTATION_ORDER.length
  ];
};

const createRolePreset = (playerId, zone, rotation) => ({
  zone,
  role: getDisplayedRole(playerId, rotation),
  receiving: ZONES[zone],
  serving: ZONES[zone]
});

const createDefaultPreset = (rotation) => {
  const steps = rotation - 1;
  const rotationKey = `R${rotation}`;

  return Object.fromEntries(
    ROLE_ORDER.map((playerId) => {
      const zone = getNextZone(
        BASE_ROLE_ZONES[playerId],
        steps
      );

      return [
        playerId,
        createRolePreset(playerId, zone, rotationKey)
      ];
    })
  );
};

const RECEIVING_POSITIONS = {
  standard: {
    P1: {x: 20, y: 72},
    P2: {x: 82, y: 70},
    L: {x: 50, y: 74},
    OP: {x: 87, y: 47}
  },
  support: {
    P1: {x: 24, y: 73},
    L: {x: 76, y: 73},
    P2: {x: 50, y: 50},
    OP: {x: 87, y: 45}
  }
};

const ROTATION_RECEPTION_POSITIONS = {
  R1: {
    standard: {
      OP: {x: 13.2, y: 22.4},
      C1: {x: 61.3, y: 28.6},
      P2: {x: 84.2, y: 67.1},
      P1: {x: 16.2, y: 68.2},
      L: {x: 50, y: 68.2},
      C: {x: 93.5, y: 73.3}
    }
  },
  R2: {
    standard: {
      OP: {x: 72.3, y: 7.9},
      C: {x: 64.5, y: 17.6},
      C1: {x: 88, y: 26.7},
      P1: {x: 16.6, y: 69.4},
      L: {x: 51.2, y: 73.5},
      P2: {x: 84, y: 70.3}
    }
  },
  R3: {
    standard: {
      C1: {x: 7, y: 20},
      C: {x: 14, y: 27},
      P1: {x: 16, y: 68},
      P2: {x: 51, y: 74},
      L: {x: 83.33, y: 68},
      OP: {x: 94, y: 27}
    }
  },
  R4: {
    standard: {
      C: {x: 9.5, y: 18},
      C1: {x: 16.5, y: 28.5},
      P2: {x: 19.5, y: 64.5},
      L: {x: 50, y: 68},
      P1: {x: 84, y: 65},
      OP: {x: 94.5, y: 75}
    }
  },
  R5: {
    standard: {
      C: {x: 67, y: 10},
      C1: {x: 93, y: 28},
      P2: {x: 16, y: 66},
      L: {x: 50, y: 71},
      P1: {x: 88, y: 70},
      OP: {x: 70, y: 85}
    }
  },
  R6: {
    standard: {
      C1: {x: 8, y: 27},
      C: {x: 65, y: 9},
      P2: {x: 15, y: 72},
      OP: {x: 35, y: 87},
      P1: {x: 51, y: 75},
      L: {x: 85, y: 72}
    }
  }
};

const DEFENSE_POSITIONS = {
  '3-1-2': {
    4: {x: 18, y: 18},
    3: {x: 50, y: 16},
    2: {x: 82, y: 18},
    6: {x: 50, y: 48},
    5: {x: 20, y: 78},
    1: {x: 80, y: 78}
  },
  '3-2-1': {
    4: {x: 18, y: 18},
    3: {x: 50, y: 16},
    2: {x: 82, y: 18},
    5: {x: 20, y: 52},
    1: {x: 80, y: 52},
    6: {x: 50, y: 82}
  }
};

const SPECIALIZED_ZONES = {
  C: {front: 2, back: 1},
  OP: {front: 2, back: 1},
  P1: {front: 4, back: 6},
  P2: {front: 4, back: 6},
  C1: {front: 3, back: 5},
  L: {front: null, back: 5}
};

const isFrontZone = (zone) => (
  [2, 3, 4].includes(Number(zone))
);

const getSpecializedZone = (
  playerId,
  nominalZone,
  liberoZone = 5
) => {
  if (playerId === 'L') return liberoZone;

  const zones = SPECIALIZED_ZONES[playerId];

  return zones?.[
    isFrontZone(nominalZone) ? 'front' : 'back'
  ] || nominalZone;
};

const getReceptionPosition = (
  rotation,
  scheme,
  playerId,
  fallback
) => {
  const rotationKey = String(rotation).startsWith('R')
    ? rotation
    : `R${rotation}`;
  const rotationPositions =
    ROTATION_RECEPTION_POSITIONS[rotationKey];
  const position =
    rotationPositions?.[scheme]?.[playerId]
    || rotationPositions?.standard?.[playerId];

  return position
    || RECEIVING_POSITIONS[scheme]?.[playerId]
    || fallback;
};

const createSpecializedPreset = (
  rotation,
  liberoZone = 5
) => {
  const base = createDefaultPreset(rotation);
  const rotationKey = `R${rotation}`;

  return Object.fromEntries(
    ROLE_ORDER.map((playerId) => {
      const nominalZone = base[playerId].zone;
      const zone = getSpecializedZone(
        playerId,
        nominalZone,
        liberoZone
      );

      return [
        playerId,
        {
          ...base[playerId],
          role: getDisplayedRole(playerId, rotationKey),
          zone,
          postServe: ZONES[zone]
        }
      ];
    })
  );
};

const createTacticalPreset = (
  rotation,
  receptionScheme,
  defenseScheme,
  liberoZone = 5
) => {
  const base = createDefaultPreset(rotation);
  const specialized = createSpecializedPreset(
    rotation,
    liberoZone
  );
  const rotationKey = `R${rotation}`;

  return Object.fromEntries(
    ROLE_ORDER.map((playerId) => {
      const player = base[playerId];
      const receiving = getReceptionPosition(
        rotation,
        receptionScheme,
        playerId,
        ZONES[player.zone]
      );
      const serving =
        DEFENSE_POSITIONS[defenseScheme][player.zone];

      return [
        playerId,
        {
          ...player,
          role: getDisplayedRole(playerId, rotationKey),
          receiving,
          serving,
          postServe: specialized[playerId].postServe,
          postServeZone: specialized[playerId].zone
        }
      ];
    })
  );
};

export const TACTICAL_PRESETS = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((rotation) => [
    `R${rotation}`,
    createTacticalPreset(
      rotation,
      'standard',
      '3-1-2',
      5
    )
  ])
);

export const getTacticalPreset = (
  rotation,
  receptionScheme = 'standard',
  defenseScheme = '3-1-2',
  liberoZone = 5
) => {
  const rotationNumber = Number(
    String(rotation).replace('R', '')
  );

  return createTacticalPreset(
    rotationNumber,
    receptionScheme,
    defenseScheme,
    liberoZone
  );
};

const createPlayer = (
  playerId,
  zone,
  position = null,
  rotationZone = zone,
  rotation = 'R1'
) => {
  const defaultRole = getDisplayedRole(playerId, rotation);
  const defaultDetails = Object.values(ROLE_DETAILS).find(
    (item) => item.role === defaultRole
  );
  const coordinates = position || ZONES[zone];
  const role = position?.displayRole || defaultRole;
  const details = Object.values(ROLE_DETAILS).find(
    (item) => item.role === role
  ) || defaultDetails;

  return {
    id: playerId,
    role,
    name: position?.displayName || details?.name || role,
    color: position?.displayColor || details?.color || '#704fbd',
    zone,
    rotationZone,
    x: coordinates.x,
    y: coordinates.y
  };
};

export const createNeutralPlayers = (rotation = 'R1') => (
  ROLE_ORDER.map((playerId) => createPlayer(
    playerId,
    BASE_ROLE_ZONES[playerId],
    null,
    BASE_ROLE_ZONES[playerId],
    rotation
  ))
);

export const updatePlayerAtZone = (
  player,
  zone,
  position = null,
  rotationZone = player.rotationZone ?? zone,
  rotation = 'R1'
) => (
  createPlayer(
    player.id,
    zone,
    position,
    rotationZone,
    rotation
  )
);

export const INITIAL_PLAYERS = createNeutralPlayers('R1');

export const getRotatedZone = (zone, direction) => {
  const index = ROTATION_ORDER.indexOf(zone);
  const offset = direction === 'forward' ? 1 : -1;

  return ROTATION_ORDER[
    (index + offset + ROTATION_ORDER.length)
    % ROTATION_ORDER.length
  ];
};