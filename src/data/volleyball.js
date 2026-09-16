export const ZONES = {
  1: { x: 83.33, y: 68, title: 'Zaguero derecho', short: 'Saque' },
  2: { x: 83.33, y: 27, title: 'Delantero derecho', short: 'Red' },
  3: { x: 50, y: 27, title: 'Delantero centro', short: 'Red' },
  4: { x: 16.67, y: 27, title: 'Delantero izquierdo', short: 'Red' },
  5: { x: 16.67, y: 68, title: 'Zaguero izquierdo', short: 'Fondo' },
  6: { x: 50, y: 68, title: 'Zaguero centro', short: 'Fondo' }
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
  C: { name: 'Colocador', color: '#ffcf57' },
  OP: { name: 'Opuesto', color: '#fc785d' },
  P1: { name: 'Punta 1', color: '#69d8ae' },
  P2: { name: 'Punta 2', color: '#f18fca' },
  C1: { name: 'Central', color: '#9c83ff' },
  L: { name: 'Líbero', color: '#65b8ff' }
};

const BASE_ROLE_ZONES = {
  C: 1,
  OP: 4,
  P1: 5,
  P2: 2,
  C1: 3,
  L: 6
};

const getNextZone = (zone, steps) => {
  const index = ROTATION_ORDER.indexOf(zone);
  return ROTATION_ORDER[(index + steps) % ROTATION_ORDER.length];
};

const getTacticalPosition = (role, zone, phase) => {
  const position = ZONES[zone];

  if (phase === 'receiving' && role === 'C') {
    const receivingPositions = {
      1: { x: 78, y: 53 },
      6: { x: 42, y: 54 },
      5: { x: 11, y: 55 },
      4: { x: 11, y: 20 },
      3: { x: 50, y: 20 },
      2: { x: 82, y: 20 }
    };

    return receivingPositions[zone];
  }

  if (phase === 'receiving' && role === 'OP') {
    return {
      x: position.x,
      y: position.y < 50 ? 17 : 76
    };
  }

  if (phase === 'receiving' && role === 'C1' && zone === 3) {
    return { x: 58, y: 17 };
  }

  return {
    x: position.x,
    y: phase === 'serving' ? position.y : position.y
  };
};

export const TACTICAL_PRESETS = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((rotation) => {
    const steps = rotation - 1;
    const roles = Object.fromEntries(
      ROLE_ORDER.map((role) => {
        const zone = getNextZone(BASE_ROLE_ZONES[role], steps);

        return [
          role,
          {
            zone,
            ...getTacticalPosition(role, zone, 'receiving'),
            receiving: getTacticalPosition(role, zone, 'receiving'),
            serving: getTacticalPosition(role, zone, 'serving')
          }
        ];
      })
    );

    return [`R${rotation}`, roles];
  })
);

export const INITIAL_PLAYERS = ROLE_ORDER.map((role) => {
  const details = ROLE_DETAILS[role];
  const preset = TACTICAL_PRESETS.R1[role];

  return {
    id: role,
    role,
    name: details.name,
    color: details.color,
    zone: preset.zone,
    x: preset.receiving.x,
    y: preset.receiving.y
  };
});

export const getRotatedZone = (zone, direction) => {
  const index = ROTATION_ORDER.indexOf(zone);
  const offset = direction === 'forward' ? 1 : -1;

  return ROTATION_ORDER[
    (index + offset + ROTATION_ORDER.length) % ROTATION_ORDER.length
  ];
};