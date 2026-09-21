import React,{useRef} from 'react';
import {motion} from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import * as FaIcons from 'react-icons/fa';
import SafeIcon from '../common/SafeIcon';
import {ZONES} from '../data/volleyball';
import './CourtGuidance.css';

const {FiArrowUp,FiArrowDown,FiArrowLeft,FiArrowRight}=FiIcons;
const {FaVolleyballBall}=FaIcons;
const directionIcons={
  up: FiArrowUp,
  down: FiArrowDown,
  left: FiArrowLeft,
  right: FiArrowRight
};
const clampPosition=(value)=> Math.min(97,Math.max(3,value));

const getCurveMidpoint=(arrow)=> ({
  x: (
    arrow.fromX +
    (2 * arrow.controlX) +
    arrow.toX
  ) / 4,
  y: (
    arrow.fromY +
    (2 * arrow.controlY) +
    arrow.toY
  ) / 4
});

const getControlFromMidpoint=(arrow,x,y)=> ({
  x: (2 * x) - ((arrow.fromX + arrow.toX) / 2),
  y: (2 * y) - ((arrow.fromY + arrow.toY) / 2)
});

const getFaultConnections=(guidance)=> {
  const connections=[];
  for (let index=0;index < guidance.length - 1;index +=2) {
    const first=guidance[index];
    const second=guidance[index + 1];
    if (!first || !second || first.playerId===second.playerId) continue;
    connections.push({
      id: `${first.playerId}-${second.playerId}-${index}`,
      firstId: first.playerId,
      secondId: second.playerId
    });
  }
  return connections;
};

function AttackLegendIcon() {
  return (
    <svg className="legend-action-icon" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M 1.2 4.3 V 1.2 H 4.3 M 5.7 1.2 H 8.8 V 4.3 M 8.8 5.7 V 8.8 H 5.7 M 4.3 8.8 H 1.2 V 5.7" />
      <path d="M 4.2 5 H 5.8 M 5 4.2 V 5.8" />
    </svg>
  );
}

function DefenseLegendIcon() {
  return (
    <svg className="legend-action-icon" viewBox="0 0 10 10" aria-hidden="true">
      <path
        className="defense-shield"
        d="M 5 1 L 8 2.5 V 5.1 C 8 6.8 6.8 8 5 9 C 3.2 8 2 6.8 2 5.1 V 2.5 Z"
      />
      <path
        className="defense-check"
        d="M 3.8 5 L 4.7 5.9 L 6.4 4.2"
      />
    </svg>
  );
}

function AttackEnd({
  arrow,
  editable,
  onPointerDown,
  onPointerMove,
  onPointerUp
}) {
  const targetTransform=[
    `translate(${arrow.toX} ${arrow.toY})`,
    'scale(0.5)',
    `translate(${-arrow.toX} ${-arrow.toY})`
  ].join(' ');

  return (
    <g
      className={`arrow-end-icon attack-end-icon ${editable ? 'editable-arrow-end' : 'fixed-arrow-end'}`}
      transform={targetTransform}
      onPointerDown={editable ? onPointerDown : undefined}
      onPointerMove={editable ? onPointerMove : undefined}
      onPointerUp={editable ? onPointerUp : undefined}
      onPointerCancel={editable ? onPointerUp : undefined}
      aria-hidden="true"
    >
      <path d={`M ${arrow.toX - 3.8} ${arrow.toY - 1.45} V ${arrow.toY - 3.8} H ${arrow.toX - 1.45}`} />
      <path d={`M ${arrow.toX + 1.45} ${arrow.toY - 3.8} H ${arrow.toX + 3.8} V ${arrow.toY - 1.45}`} />
      <path d={`M ${arrow.toX + 3.8} ${arrow.toY + 1.45} V ${arrow.toY + 3.8} H ${arrow.toX + 1.45}`} />
      <path d={`M ${arrow.toX - 1.45} ${arrow.toY + 3.8} H ${arrow.toX - 3.8} V ${arrow.toY + 1.45}`} />
      <path d={`M ${arrow.toX - 0.8} ${arrow.toY} H ${arrow.toX + 0.8} M ${arrow.toX} ${arrow.toY - 0.8} V ${arrow.toY + 0.8}`} />
    </g>
  );
}

function DefenseEnd({
  arrow,
  editable,
  onPointerDown,
  onPointerMove,
  onPointerUp
}) {
  return (
    <g
      className={`arrow-end-icon defense-end-icon ${editable ? 'editable-arrow-end' : 'fixed-arrow-end'}`}
      onPointerDown={editable ? onPointerDown : undefined}
      onPointerMove={editable ? onPointerMove : undefined}
      onPointerUp={editable ? onPointerUp : undefined}
      onPointerCancel={editable ? onPointerUp : undefined}
      aria-hidden="true"
    >
      <path d={`M ${arrow.toX} ${arrow.toY - 3.1} L ${arrow.toX + 2.6} ${arrow.toY - 1.8} V ${arrow.toY + 0.6} C ${arrow.toX + 2.6} ${arrow.toY + 2.2} ${arrow.toX + 1.4} ${arrow.toY + 3.1} ${arrow.toX} ${arrow.toY + 3.8} C ${arrow.toX - 1.4} ${arrow.toY + 3.1} ${arrow.toX - 2.6} ${arrow.toY + 2.2} ${arrow.toX - 2.6} ${arrow.toY + 0.6} V ${arrow.toY - 1.8} Z`} />
      <path d={`M ${arrow.toX - 1.1} ${arrow.toY + 0.1} L ${arrow.toX - 0.2} ${arrow.toY + 1} L ${arrow.toX + 1.3} ${arrow.toY - 0.9}`} />
    </g>
  );
}

function TacticalArrow({
  arrow,
  editable,
  onStartDrag,
  onMoveDrag,
  onStopDrag
}) {
  const curveMidpoint=getCurveMidpoint(arrow);
  const createHandlers=(point)=> ({
    onPointerDown: (event)=> onStartDrag(event,arrow,point),
    onPointerMove: onMoveDrag,
    onPointerUp: onStopDrag
  });

  return (
    <g className="tactical-arrow" style={{'--arrow-color': arrow.color}}>
      <path
        className="arrow-path"
        d={`M ${arrow.fromX} ${arrow.fromY} Q ${arrow.controlX} ${arrow.controlY} ${arrow.toX} ${arrow.toY}`}
      />
      {editable && (
        <circle
          className="arrow-control"
          cx={curveMidpoint.x}
          cy={curveMidpoint.y}
          r="1.65"
          {...createHandlers('control')}
        />
      )}
      {arrow.type==='defense' ? (
        <DefenseEnd
          arrow={arrow}
          editable={editable}
          {...createHandlers('tip')}
        />
      ) : (
        <AttackEnd
          arrow={arrow}
          editable={editable}
          {...createHandlers('tip')}
        />
      )}
    </g>
  );
}

function FaultConnections({players,guidance}) {
  const connections=getFaultConnections(guidance);
  return connections.map((connection)=> {
    const first=players.find((player)=> player.id===connection.firstId);
    const second=players.find((player)=> player.id===connection.secondId);
    if (!first || !second) return null;

    const middleX=(first.x + second.x) / 2;
    const middleY=(first.y + second.y) / 2;

    return (
      <g className="fault-connection" key={connection.id}>
        <path d={`M ${first.x} ${first.y} Q ${middleX} ${middleY - 5} ${second.x} ${second.y}`} />
        <circle cx={middleX} cy={middleY - 2.5} r="1.1" />
      </g>
    );
  });
}

function Court({
  players,
  onMovePlayer,
  guidance=[],
  attackGuidance=[],
  defenseGuidance=[],
  arrowFilter={attack: false,defense: false},
  faultPlayerIds=[],
  serverPlayerId=null,
  onMoveArrowPoint,
  editable=false
}) {
  const courtRef=useRef(null);
  const arrowLayerRef=useRef(null);
  const dragOffsets=useRef({});
  const arrowDrag=useRef(null);

  const getPosition=(event,element)=> {
    const bounds=element.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100
    };
  };

  const handlePointerDown=(event,player)=> {
    if (!editable) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const pointer=getPosition(event,courtRef.current);
    dragOffsets.current[player.id]={
      x: player.x - pointer.x,
      y: player.y - pointer.y
    };
  };

  const handlePointerMove=(event,player)=> {
    if (
      !editable ||
      !courtRef.current ||
      !event.currentTarget.hasPointerCapture(event.pointerId)
    ) return;

    const pointer=getPosition(event,courtRef.current);
    const offset=dragOffsets.current[player.id] || {x: 0,y: 0};
    onMovePlayer(
      player.id,
      clampPosition(pointer.x + offset.x),
      clampPosition(pointer.y + offset.y)
    );
  };

  const handlePointerUp=(event,playerId)=> {
    if (!editable) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    delete dragOffsets.current[playerId];
  };

  const startArrowDrag=(event,arrow,point)=> {
    if (!editable) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    arrowDrag.current={
      playerId: arrow.playerId,
      type: arrow.type,
      point,
      arrow
    };
  };

  const moveArrowDrag=(event)=> {
    if (
      !editable ||
      !arrowDrag.current ||
      !arrowLayerRef.current ||
      !event.currentTarget.hasPointerCapture(event.pointerId)
    ) return;

    const pointer=getPosition(event,arrowLayerRef.current);
    const {type,playerId,point,arrow}=arrowDrag.current;

    if (point==='control') {
      const control=getControlFromMidpoint(
        arrow,
        clampPosition(pointer.x),
        clampPosition(pointer.y)
      );
      onMoveArrowPoint(
        type,
        playerId,
        point,
        control.x,
        control.y
      );
      return;
    }

    onMoveArrowPoint(
      type,
      playerId,
      point,
      clampPosition(pointer.x),
      clampPosition(pointer.y)
    );
  };

  const stopArrowDrag=(event)=> {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    arrowDrag.current=null;
  };

  const visibleArrows=[
    ...(arrowFilter.attack ? attackGuidance : []),
    ...(arrowFilter.defense ? defenseGuidance : [])
  ];

  return (
    <div className="court-shell">
      <div
        className={`court ${editable ? 'court-editable' : 'court-locked'}`}
        ref={courtRef}
      >
        <div className="net" />
        <div className="attack-line">
          <span>Línea de ataque · 3 m</span>
        </div>

        <svg
          ref={arrowLayerRef}
          className="attack-guidance-layer"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-label="Direcciones tácticas"
        >
          <FaultConnections players={players} guidance={guidance} />
          {visibleArrows.map((arrow)=> (
            <TacticalArrow
              key={`${arrow.type}-${arrow.playerId}`}
              arrow={arrow}
              editable={editable}
              onStartDrag={startArrowDrag}
              onMoveDrag={moveArrowDrag}
              onStopDrag={stopArrowDrag}
            />
          ))}
        </svg>

        {Object.entries(ZONES).map(([number,zone])=> (
          <div className={`zone zone-${number}`} key={number}>
            <strong>Z{number}</strong>
            <span>{zone.title}</span>
          </div>
        ))}

        {guidance.map((item,index)=> {
          const Icon=directionIcons[item.direction] || FiArrowUp;
          return (
            <div
              className={`position-guidance position-guidance-${item.direction || 'up'}`}
              key={`${item.playerId}-${item.direction}-${index}`}
              style={{left: `${item.x}%`,top: `${item.y}%`}}
            >
              <SafeIcon icon={Icon} />
            </div>
          );
        })}

        {players.map((player)=> {
          const isFaulty=faultPlayerIds.includes(player.id);
          const isServer=player.id===serverPlayerId;

          return (
            <motion.button
              className={`player ${editable ? 'player-editable' : 'player-locked'} ${isFaulty ? 'position-fault' : ''} ${isServer ? 'serving-player' : ''}`}
              key={player.id}
              aria-label={`${player.name},rol ${player.role},zona Z${player.rotationZone}${isServer ? ',jugador al saque' : ''}`}
              animate={{left: `${player.x}%`,top: `${player.y}%`}}
              transition={{duration: 0}}
              style={{'--player-color': player.color}}
              onPointerDown={(event)=> handlePointerDown(event,player)}
              onPointerMove={(event)=> handlePointerMove(event,player)}
              onPointerUp={(event)=> handlePointerUp(event,player.id)}
              onPointerCancel={(event)=> handlePointerUp(event,player.id)}
            >
              {isServer && (
                <span className="server-ball" aria-hidden="true">
                  <SafeIcon icon={FaVolleyballBall} fallback="volleyball" />
                </span>
              )}
              <span>{player.role}</span>
              <small>{player.name}</small>
              <em className="player-zone-label">Z{player.rotationZone}</em>
            </motion.button>
          );
        })}
      </div>

      <div className="zone-legend" aria-label="Leyenda de acciones">
        <span>
          <strong className="attack-legend-dot">
            <AttackLegendIcon />
          </strong>
          Ataque
        </span>
        <span>
          <strong className="defense-legend-dot">
            <DefenseLegendIcon />
          </strong>
          Defensa
        </span>
      </div>
    </div>
  );
}

export default Court;