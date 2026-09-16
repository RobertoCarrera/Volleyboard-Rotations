const getPlayerAtZone = (players, zone) => (
  players.find((player) => player.zone === zone)
);

const positionChecks = [
  {
    zones: [4, 5],
    message: 'El jugador de zona 4 debe estar más cerca de la red que el de zona 5.',
    test: (front, back, tolerance) => front.y < back.y - tolerance
  },
  {
    zones: [3, 6],
    message: 'El jugador de zona 3 debe estar más cerca de la red que el de zona 6.',
    test: (front, back, tolerance) => front.y < back.y - tolerance
  },
  {
    zones: [2, 1],
    message: 'El jugador de zona 2 debe estar más cerca de la red que el de zona 1.',
    test: (front, back, tolerance) => front.y < back.y - tolerance
  }
];

const validateRows = (players, tolerance) => {
  const faults = positionChecks
    .filter(({ zones, test }) => {
      const first = getPlayerAtZone(players, zones[0]);
      const second = getPlayerAtZone(players, zones[1]);

      return !test(first, second, tolerance);
    })
    .map(({ message }) => message);

  const zone4 = getPlayerAtZone(players, 4);
  const zone3 = getPlayerAtZone(players, 3);
  const zone2 = getPlayerAtZone(players, 2);
  const zone5 = getPlayerAtZone(players, 5);
  const zone6 = getPlayerAtZone(players, 6);
  const zone1 = getPlayerAtZone(players, 1);

  if (!(zone4.x + tolerance < zone3.x && zone3.x < zone2.x - tolerance)) {
    faults.push('En la línea delantera, zona 3 debe estar entre las zonas 4 y 2.');
  }

  if (!(zone5.x + tolerance < zone6.x && zone6.x < zone1.x - tolerance)) {
    faults.push('En la línea de fondo, zona 6 debe estar entre las zonas 5 y 1.');
  }

  return faults;
};

export const validateFormation = ({
  players,
  teamState,
  serverId,
  tolerance = 0.5
}) => {
  if (teamState === 'libre') {
    return {
      valid: true,
      rotationFault: false,
      positionFaults: [],
      expectedServer: getPlayerAtZone(players, 1)
    };
  }

  const expectedServer = getPlayerAtZone(players, 1);
  const rotationFault = Number(serverId) !== expectedServer.id;
  const positionFaults = validateRows(players, tolerance);

  return {
    valid: !rotationFault && positionFaults.length === 0,
    rotationFault,
    positionFaults,
    expectedServer
  };
};