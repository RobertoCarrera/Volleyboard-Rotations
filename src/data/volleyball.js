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
    description: 'Un colocador organiza el ataque y los otros cinco jugadores se especializan según la rotación.'
  },
  '4-2': {
    label: 'Sistema 4-2',
    description: 'Dos colocadores se reparten la organización del juego y siempre hay un colocador delantero.'
  }
};

export const TACTICAL_PHASES = {
  receiving: {
    label: 'Recepción · K1',
    description: 'Tres receptores forman la línea de pase mientras el colocador penetra hacia zona 2/3.'
  },
  serving: {
    label: 'Saque y defensa · K2',
    description: 'Los jugadores adoptan inmediatamente sus posiciones tácticas de bloqueo y defensa.'
  }
};

const ROLE_ORDER = ['C', 'OP', 'P1', 'P2', 'C1', 'L'];

const ROLE_DETAILS = {
  C: {name: 'Colocador', color: '#ffcf57'},
  OP: {name: 'Opuesto', color: '#fc785d'},
  P1: {name: 'Punta 1', color: '#69d8ae'},
  P2: {name: 'Punta 2', color: '#f18fca'},
  C1: {name: 'Central 1', color: '#9c83ff'},
  C2: {name: 'Central 2', color: '#b89cff'},
  L: {name: 'Líbero', color: '#65b8ff'}
};

const BASE_ROLE_ZONES = {
  C: 1,
  OP: 4,
  P1: 5,
  P2: 2,
  C1: 3,
  L: 6
};

/* Coordenadas K1: Y=0 es la red y Y=100 es el fondo.
   X=0 es el lateral izquierdo y X=100 el lateral derecho. */
const K1_PRESETS = {
  R1: {
    OP: {zone: 4, x: 16, y: 20},
    C1: {zone: 3, x: 50, y: 18},
    P2: {zone: 2, x: 74, y: 58},
    C: {zone: 1, x: 84, y: 64},
    L: {zone: 6, x: 50, y: 70},
    P1: {zone: 5, x: 22, y: 68}
  },
  R2: {
    C: {zone: 2, x: 80, y: 18},
    C1: {zone: 4, x: 16, y: 18},
    P2: {zone: 3, x: 28, y: 58},
    L: {zone: 5, x: 18, y: 70},
    P1: {zone: 6, x: 50, y: 70},
    OP: {zone: 1, x: 82, y: 75}
  },
  R3: {
    C: {zone: 3, x: 60, y: 18},
    P2: {zone: 4, x: 16, y: 22},
    C1: {zone: 2, x: 84, y: 18},
    OP: {zone: 5, x: 16, y: 78},
    L: {zone: 6, x: 48, y: 70},
    P1: {zone: 1, x: 78, y: 68}
  },
  R4: {
    C: {zone: 4, x: 20, y: 20},
    C1: {zone: 6, x: 50, y: 18},
    P1: {zone: 2, x: 78, y: 58},
    P2: {zone: 5, x: 20, y: 70},
    L: {zone: 6, x: 48, y: 70},
    OP: {zone: 1, x: 84, y: 75}
  },
  R5: {
    C: {zone: 5, x: 18, y: 58},
    P1: {zone: 4, x: 20, y: 50},
    C1: {zone: 3, x: 52, y: 18},
    OP: {zone: 2, x: 84, y: 20},
    P2: {zone: 1, x: 78, y: 70},
    L: {zone: 6, x: 48, y: 70}
  },
  R6: {
    C: {zone: 6, x: 52, y: 54},
    C1: {zone: 4, x: 16, y: 18},
    OP: {zone: 3, x: 50, y: 18},
    P1: {zone: 3, x: 78, y: 58},
    P2: {zone: 2, x: 22, y: 70},
    L: {zone: 5, x: 50, y: 72}
  }
};

const isFrontZone = (zone) => [2, 3, 4].includes(Number(zone));

export const getDisplayedRole = (playerId, zone) => {
  if (playerId !== 'C1' && playerId !== 'L') {
    return playerId;
  }

  if (isFrontZone(zone)) {
    return playerId === 'L' ? 'C2' : 'C1';
  }

  return 'L';
};

export const getDisplayedName = (playerId, zone) => (
  ROLE_DETAILS[getDisplayedRole(playerId, zone)].name
);

const getNextZone = (zone, steps) => {
  const index = ROTATION_ORDER.indexOf(zone);
  return ROTATION_ORDER[(index + steps) % ROTATION_ORDER.length];
};

const getTacticalPosition = (playerId, zone, phase) => {
  const position = ZONES[zone];

  if (phase === 'receiving') {
    return {x: position.x, y: position.y};
  }

  return {x: position.x, y: position.y};
};

const createRolePreset = (playerId, zone) => ({
  zone,
  role: getDisplayedRole(playerId, zone),
  receiving: getTacticalPosition(playerId, zone, 'receiving'),
  serving: getTacticalPosition(playerId, zone, 'serving')
});

const createK1Preset = (rotation) => Object.fromEntries(
  ROLE_ORDER.map((playerId) => {
    const preset = K1_PRESETS[`R${rotation}`][playerId];

    return [
      playerId,
      {
        zone: preset.zone,
        role: getDisplayedRole(playerId, preset.zone),
        receiving: {x: preset.x, y: preset.y},
        serving: getTacticalPosition(playerId, preset.zone, 'serving')
      }
    ];
  })
);

const createDefaultPreset = (rotation) => {
  const steps = rotation - 1;

  return Object.fromEntries(
    ROLE_ORDER.map((playerId) => {
      const zone = getNextZone(BASE_ROLE_ZONES[playerId], steps);
      return [playerId, createRolePreset(playerId, zone)];
    })
  );
};

export const TACTICAL_PRESETS = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((rotation) => {
    const rotationKey = `R${rotation}`;

    return [
      rotationKey,
      {
        ...createDefaultPreset(rotation),
        ...createK1Preset(rotation)
      }
    ];
  })
);

const createPlayer = (playerId, zone, position = null) => {
  const role = getDisplayedRole(playerId, zone);
  const details = ROLE_DETAILS[role];
  const coordinates = position || ZONES[zone];

  return {
    id: playerId,
    role,
    name: details.name,
    color: details.color,
    zone,
    x: coordinates.x,
    y: coordinates.y
  };
};

export const createNeutralPlayers = () => (
  ROLE_ORDER.map((playerId) => createPlayer(playerId, BASE_ROLE_ZONES[playerId]))
);

export const updatePlayerAtZone = (player, zone, position = null) => (
  createPlayer(player.id, zone, position)
);

export const INITIAL_PLAYERS = createNeutralPlayers();

export const getRotatedZone = (zone, direction) => {
  const index = ROTATION_ORDER.indexOf(zone);
  const offset = direction === 'forward' ? 1 : -1;

  return ROTATION_ORDER[
    (index + offset + ROTATION_ORDER.length) % ROTATION_ORDER.length
  ];
};