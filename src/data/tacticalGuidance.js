import {ZONES} from './volleyball';

const ATTACK_TARGETS={O: 2,C1: 3,C2: 3,R1: 4,R2: 4,COL: 2};
const PIPE_ATTACK_TARGET={x: 50,y: 38};
const BACK_ROW_OPPOSITE_TARGET={x: 83,y: 38};
const FREE_ARROW_DISTANCE=14;

const ROTATION_ARROW_POINTS={
  R1: {
    attack: {
      OP: {toX: 5.2,toY: 5,controlX: 6.6,controlY: 14.1},
      C1: {toX: 50.1,toY: 18.4,controlX: 50.1,controlY: 21.6},
      P2: {toX: 84.1,toY: 5,controlX: 84.1,controlY: 35.8},
      P1: {toX: 50,toY: 38.5,controlX: 34.2,controlY: 57.7}
    }
  },
  R2: {
    attack: {
      P1: {toX: 8,toY: 6,controlX: 5,controlY: 37},
      OP: {toX: 86,toY: 16,controlX: 84,controlY: 10},
      C1: {toX: 50,toY: 17,controlX: 63,controlY: 36},
      P2: {toX: 50,toY: 39,controlX: 57,controlY: 63}
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
  },
  R4: {
    attack: {
      C: {toX: 71,toY: 7,controlX: 48,controlY: 33},
      C1: {toX: 50,toY: 21,controlX: 43,controlY: 43},
      P1: {toX: 50,toY: 38,controlX: 66,controlY: 68},
      P2: {toX: 3,toY: 7,controlX: 8,controlY: 43},
      OP: {toX: 83,toY: 38,controlX: 94,controlY: 54}
    }
  },
  R5: {
    attack: {
      C: {toX: 78,toY: 7,controlX: 72,controlY: 25},
      C1: {toX: 50,toY: 18,controlX: 69,controlY: 36},
      P2: {toX: 8,toY: 6,controlX: 8,controlY: 36},
      P1: {toX: 50,toY: 38,controlX: 57,controlY: 59},
      OP: {toX: 83,toY: 38,controlX: 78,controlY: 56}
    }
  },
  R6: {
    attack: {
      C1: {toX: 50,toY: 17,controlX: 34,controlY: 25},
      C: {toX: 78,toY: 10,controlX: 72,controlY: 10},
      P2: {toX: 16,toY: 20,controlX: 16,controlY: 52},
      P1: {toX: 50,toY: 38,controlX: 50,controlY: 55},
      OP: {toX: 83,toY: 38,controlX: 76,controlY: 78}
    }
  }
};

const clamp=(value)=> Math.min(97,Math.max(3,value));
const isFrontRowPlayer=(player)=> [2,3,4].includes(Number(player.zone));
const isBackRowPlayer=(player)=> [1,5,6].includes(Number(player.zone));
const isReceiver=(player)=> player.id==='P1' || player.id==='P2';

const createArrowPoint=(player,target,type)=> {
  const curveOffset=type==='attack' ? -12 : 12;
  return {
    toX: target.x,
    toY: target.y,
    controlX: (player.x + target.x) / 2,
    controlY: (player.y + target.y) / 2 + curveOffset
  };
};

const createFreeArrowPoint=(player)=> {
  const toY=clamp(player.y - FREE_ARROW_DISTANCE);
  return {
    toX: player.x,
    toY,
    controlX: player.x,
    controlY: (player.y + toY) / 2
  };
};

const getSavedArrow=(defaults,savedPoints)=> ({
  ...defaults,
  ...savedPoints
});

const canAttack=(player)=> {
  if (player.id==='L') return false;
  if (player.id==='OP' || player.role==='O') return true;
  if (isReceiver(player)) return true;
  if (player.id==='C1' && ['R5','R6'].includes(player.rotation)) return true;
  return isFrontRowPlayer(player) && (
    Boolean(ATTACK_TARGETS[player.role]) ||
    player.id==='C1'
  );
};

const getAttackDefaults=(player,rotation)=> {
  const configured=ROTATION_ARROW_POINTS[rotation]?.attack?.[player.id];
  if (configured) return configured;

  if ((player.id==='OP' || player.role==='O') && isBackRowPlayer(player)) {
    return createArrowPoint(player,BACK_ROW_OPPOSITE_TARGET,'attack');
  }

  if (isReceiver(player) && isBackRowPlayer(player)) {
    return createArrowPoint(player,PIPE_ATTACK_TARGET,'attack');
  }

  const targetZone=ATTACK_TARGETS[player.role] || 3;
  const zone=ZONES[targetZone];
  return createArrowPoint(player,{x: zone.x,y: 6},'attack');
};

const getK2Target=(player)=> {
  if (player.y < 35) return {x: player.x,y: 5};
  if (player.y < 62) return {x: player.x,y: 63};
  if (player.x < 35) return {x: 8,y: 84};
  if (player.x > 65) return {x: 92,y: 84};
  return {x: 50,y: 93};
};

const getDefenseDefaults=(player,rotation)=> {
  const configured=ROTATION_ARROW_POINTS[rotation]?.defense?.[player.id];
  if (configured) return configured;
  return createArrowPoint(player,getK2Target(player),'defense');
};

export const getAttackGuidance=(
  players,
  teamState,
  tacticalPhase,
  rotation,
  arrowPoints
)=> {
  const isFree=teamState==='libre';
  if (!isFree && (teamState!=='systems' || tacticalPhase!=='receiving')) {
    return [];
  }

  return players
    .filter((player)=> isFree || canAttack({...player,rotation}))
    .map((player)=> ({
      type: 'attack',
      playerId: player.id,
      color: player.color,
      fromX: player.x,
      fromY: player.y,
      ...getSavedArrow(
        isFree
          ? createFreeArrowPoint(player)
          : getAttackDefaults({...player,rotation},rotation),
        arrowPoints[player.id]
      )
    }));
};

export const getDefenseGuidance=(
  players,
  teamState,
  tacticalPhase,
  rotation,
  arrowPoints
)=> {
  const isFree=teamState==='libre';
  if (!isFree && (teamState!=='systems' || tacticalPhase!=='serving')) {
    return [];
  }

  return players.map((player)=> ({
    type: 'defense',
    playerId: player.id,
    color: player.color,
    fromX: player.x,
    fromY: player.y,
    ...getSavedArrow(
      isFree
        ? createFreeArrowPoint(player)
        : getDefenseDefaults(player,rotation),
      arrowPoints[player.id]
    )
  }));
};