import {createNeutralPlayers,getTacticalPreset,updatePlayerAtZone} from './volleyball';
import {getK1PlayerPosition} from './k1Layout';
import {getK2PlayerPosition} from './k2Layout';

export const ROTATION_SEQUENCE = ['R1', 'R6', 'R5', 'R4', 'R3', 'R2'];

const ROTATION_PRESET_MAP = {R1: 'R1', R6: 'R2', R5: 'R3', R4: 'R4', R3: 'R5', R2: 'R6'};
const LIBERO_CENTRAL_SWAP = {R3: {L: 5, C1: 2}, R4: {L: 6, C1: 3}, R5: {L: 1, C1: 4}};

const getCorrectedZone = (rotation, playerId, zone) => (
  LIBERO_CENTRAL_SWAP[rotation]?.[playerId] || zone
);

export const getNextRotation = (rotation, direction) => {
  const index = ROTATION_SEQUENCE.indexOf(rotation);
  const offset = direction === 'forward' ? 1 : -1;
  return ROTATION_SEQUENCE[(index + offset + ROTATION_SEQUENCE.length) % ROTATION_SEQUENCE.length];
};

export const getSystemRotation = (rotation, phase = 'receiving') => {
  const sourceRotation = ROTATION_PRESET_MAP[rotation] || rotation;
  const preset = getTacticalPreset(sourceRotation, 'standard', '3-1-2');
  return createNeutralPlayers(sourceRotation).map((player) => {
    const rolePreset = preset[player.id];
    const nominalZone = getCorrectedZone(rotation, player.id, rolePreset.zone);
    let position = rolePreset[phase];
    if (phase === 'receiving') {
      position = getK1PlayerPosition(sourceRotation, 'standard', player.id, position);
    }
    if (phase === 'serving') {
      position = getK2PlayerPosition(sourceRotation, '3-1-2', player.id, position);
    }
    return updatePlayerAtZone(player, nominalZone, position, nominalZone, sourceRotation);
  });
};
