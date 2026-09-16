import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ZONES } from '../data/volleyball';

function Court({ players, onMovePlayer }) {
  const courtRef = useRef(null);
  const dragOffsets = useRef({});

  const getPosition = (event) => {
    const bounds = courtRef.current.getBoundingClientRect();

    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100
    };
  };

  const handlePointerDown = (event, player) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const pointer = getPosition(event);

    dragOffsets.current[player.id] = {
      x: player.x - pointer.x,
      y: player.y - pointer.y
    };
  };

  const handlePointerMove = (event, player) => {
    if (
      !courtRef.current ||
      !event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      return;
    }

    const pointer = getPosition(event);
    const offset = dragOffsets.current[player.id] || { x: 0, y: 0 };

    onMovePlayer(
      player.id,
      Math.min(97, Math.max(3, pointer.x + offset.x)),
      Math.min(97, Math.max(3, pointer.y + offset.y))
    );
  };

  const handlePointerUp = (event, playerId) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    delete dragOffsets.current[playerId];
  };

  return (
    <div className="court-shell">
      <div className="court-top-label">RED · LÍNEA CENTRAL</div>

      <div className="court" ref={courtRef}>
        <div className="net" />

        <div className="attack-line">
          <span>Línea de ataque · 3 m</span>
        </div>

        {Object.entries(ZONES).map(([number, zone]) => (
          <div className={`zone zone-${number}`} key={number}>
            <strong>Z{number}</strong>
            <span>{zone.title}</span>
          </div>
        ))}

        {players.map((player) => (
          <motion.button
            className="player"
            key={player.id}
            aria-label={`${player.name}, rol ${player.role}, posición ${player.zone}`}
            animate={{
              left: `${player.x}%`,
              top: `${player.y}%`
            }}
            transition={{ duration: 0 }}
            style={{ '--player-color': player.color }}
            onPointerDown={(event) => handlePointerDown(event, player)}
            onPointerMove={(event) => handlePointerMove(event, player)}
            onPointerUp={(event) => handlePointerUp(event, player.id)}
            onPointerCancel={(event) => handlePointerUp(event, player.id)}
          >
            <span>{player.role}</span>
            <small>{player.name}</small>
          </motion.button>
        ))}
      </div>

      <div className="court-scale">
        <span>← 9 metros →</span>
        <span>Media pista: 9 × 9 m</span>
      </div>
    </div>
  );
}

export default Court;