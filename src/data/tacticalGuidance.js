import {ZONES} from './volleyball';

const ATTACK_TARGETS = {O: 2,C1: 3,C2: 3,R1: 4,R2: 4,COL: 2};
const PIPE_ATTACK_TARGET = {x: 50,y: 6};

const ROTATION_ARROW_POINTS = {
  R2: {
    attack: {
      P1: {toX: 8,toY: 6,controlX: 5,controlY: 38},
      OP: {toX: 90,toY: 7,controlX: 91,controlY: 27},
      C1: {toX: 50,toY: 33,controlX: 72,controlY: 34},
      P2: {toX: 50,toY: 6,controlX: 72,controlY: 35}
    },
    defense: {
      L: {toX: 6,toY: 68,controlX: 28,controlY: 79},
      C: {toX: 83,toY: 77,controlX: 72,controlY: 56},
      P2: {toX: 50,toY: 86,controlX: 65,controlY: 79}
    }
  },
  R3: {
    attack: {
      P1: {toX: 8,toY: 6,controlX: 5,controlY: 38},
      OP: {toX: 90,toY: 7,controlX: 91,controlY: 27},
      C1: {toX: 50,toY: 6,controlX: 44,controlY: 24},
      P2: {toX: 50,toY: 38,controlX: 50,controlY: 66}
    },
    defense: {
      C: {toX: 83,toY: 83,controlX: 73,controlY: 62},
      P2: {toX: 50,toY: 93,controlX: 50,controlY: 89},
      C1: {toX: 13,toY: 83,controlX: 57,controlY: 84}
    }
  }
};

const isFrontRowPlayer = (player) => [2,3,4].includes(Number(player.zone));
const isBackRowPlayer = (player) => [1,5,6].includes(Number(player.zone));
const isReceiver = (player) => player.id === 'P1' || player.id === 'P2';

const createArrowPoint = (player,target,type) => {
  const curveOffset = type === 'attack' ? -12 : 12;

  return {
    toX: target.x,
    toY: target.y,
    controlX: (player.x + target.x) / 2,
    controlY: (player.y + target.y) / 2 + curveOffset
  };
};

const getSavedArrow = (defaults,savedPoints) => ({
  ...defaults,
  ...savedPoints
});

const canAttack = (player) => {
  if (player.id === 'L') {
    return false;
  }

  if (isReceiver(player)) {
    return true;
  }

  return isFrontRowPlayer(player) && Boolean(ATTACK_TARGETS[player.role]);
};

const canDefend = (player) => {
  if (isReceiver(player)) {
    return true;
  }

  return isBackRowPlayer(player);
};

const getAttackDefaults = (player,rotation) => {
  const configured = ROTATION_ARROW_POINTS[rotation]?.attack?.[player.id];

  if (configured) {
    return configured;
  }

  if (isReceiver(player) && isBackRowPlayer(player)) {
    return createArrowPoint(player,PIPE_ATTACK_TARGET,'attack');
  }

  const targetZone = ATTACK_TARGETS[player.role];
  const zone = ZONES[targetZone];

  return createArrowPoint(player,{x: zone.x,y: 6},'attack');
};

const getReceivingDefenseTarget = (player) => {
  if (player.role === 'L') {
    return ZONES[5];
  }

  if (isReceiver(player)) {
    return ZONES[6];
  }

  return ZONES[1];
};

const getK2Target = (player) => {
  if (player.y < 35) {
    return {x: player.x,y: 5};
  }

  if (player.y < 62) {
    return {x: player.x,y: 63};
  }

  if (player.x < 35) {
    return {x: 8,y: 84};
  }

  if (player.x > 65) {
    return {x: 92,y: 84};
  }

  return {x: 50,y: 93};
};

const getDefenseDefaults = (player,tacticalPhase,rotation) => {
  const configured = ROTATION_ARROW_POINTS[rotation]?.defense?.[player.id];

  if (tacticalPhase === 'receiving' && configured) {
    return configured;
  }

  const target = tacticalPhase === 'serving'
    ? getK2Target(player)
    : getReceivingDefenseTarget(player);

  return createArrowPoint(player,target,'defense');
};

export const getAttackGuidance = (
  players,
  teamState,
  tacticalPhase,
  rotation,
  arrowPoints
) => {
  if (teamState !== 'systems' || tacticalPhase !== 'receiving') {
    return [];
  }

  return players
    .filter(canAttack)
    .map((player) => ({
      type: 'attack',
      playerId: player.id,
      color: player.color,
      fromX: player.x,
      fromY: player.y,
      ...getSavedArrow(
        getAttackDefaults(player,rotation),
        arrowPoints[player.id]
      )
    }));
};

export const getDefenseGuidance = (
  players,
  teamState,
  tacticalPhase,
  rotation,
  arrowPoints
) => {
  if (
    teamState !== 'systems' ||
    !['receiving','serving'].includes(tacticalPhase)
  ) {
    return [];
  }

  const eligiblePlayers = players.filter(canDefend);

  return eligiblePlayers.map((player) => ({
    type: 'defense',
    playerId: player.id,
    color: player.color,
    fromX: player.x,
    fromY: player.y,
    ...getSavedArrow(
      getDefenseDefaults(player,tacticalPhase,rotation),
      arrowPoints[player.id]
    )
  }));
};