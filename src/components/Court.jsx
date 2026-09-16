import React,{useRef} from 'react';
import {motion} from 'framer-motion';
import {ZONES} from '../data/volleyball';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import './CourtGuidance.css';

const {FiArrowUp,FiArrowDown,FiArrowLeft,FiArrowRight}=FiIcons;
const directionIcons={up: FiArrowUp,down: FiArrowDown,left: FiArrowLeft,right: FiArrowRight};
const clampPosition=(value)=>Math.min(97,Math.max(3,value));

const getCurvePoint=(arrow,t=0.5)=>{
  const inverse=1-t;

  return {
    x: (inverse*inverse*arrow.fromX)+(2*inverse*t*arrow.controlX)+(t*t*arrow.toX),
    y: (inverse*inverse*arrow.fromY)+(2*inverse*t*arrow.controlY)+(t*t*arrow.toY)
  };
};

function ArrowEnd({arrow,onPointerDown,onPointerMove,onPointerUp}) {
  const handlers={
    'data-point': 'tip',
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp
  };

  if (arrow.type==='attack') {
    const targetTransform=`translate(${arrow.toX} ${arrow.toY}) scale(0.5) translate(${-arrow.toX} ${-arrow.toY})`;

    return (
      <g
        className="arrow-end-icon attack-end-icon"
        transform={targetTransform}
        {...handlers}
      >
        <path d={`M ${arrow.toX-3.8} ${arrow.toY-1.45} V ${arrow.toY-3.8} H ${arrow.toX-1.45}`} />
        <path d={`M ${arrow.toX+1.45} ${arrow.toY-3.8} H ${arrow.toX+3.8} V ${arrow.toY-1.45}`} />
        <path d={`M ${arrow.toX+3.8} ${arrow.toY+1.45} V ${arrow.toY+3.8} H ${arrow.toX+1.45}`} />
        <path d={`M ${arrow.toX-1.45} ${arrow.toY+3.8} H ${arrow.toX-3.8} V ${arrow.toY+1.45}`} />
        <path d={`M ${arrow.toX-0.8} ${arrow.toY} H ${arrow.toX+0.8} M ${arrow.toX} ${arrow.toY-0.8} V ${arrow.toY+0.8}`} />
      </g>
    );
  }

  return (
    <g className="arrow-end-icon defense-end-icon" {...handlers}>
      <path d={`M ${arrow.toX} ${arrow.toY-3.1} L ${arrow.toX+2.6} ${arrow.toY-1.8} V ${arrow.toY+0.6} C ${arrow.toX+2.6} ${arrow.toY+2.2} ${arrow.toX+1.4} ${arrow.toY+3.1} ${arrow.toX} ${arrow.toY+3.8} C ${arrow.toX-1.4} ${arrow.toY+3.1} ${arrow.toX-2.6} ${arrow.toY+2.2} ${arrow.toX-2.6} ${arrow.toY+0.6} V ${arrow.toY-1.8} Z`} />
      <path d={`M ${arrow.toX-1.1} ${arrow.toY+0.1} L ${arrow.toX-0.2} ${arrow.toY+1} L ${arrow.toX+1.3} ${arrow.toY-0.9}`} />
    </g>
  );
}

function Court({
  players,
  onMovePlayer,
  guidance=[],
  attackGuidance=[],
  defenseGuidance=[],
  arrowFilter={attack:false,defense:false},
  faultPlayerIds=[],
  onMoveArrowPoint
}) {
  const courtRef=useRef(null);
  const arrowLayerRef=useRef(null);
  const dragOffsets=useRef({});
  const arrowDrag=useRef(null);

  const getPosition=(event,element)=>{
    const bounds=element.getBoundingClientRect();

    return {
      x: ((event.clientX-bounds.left)/bounds.width)*100,
      y: ((event.clientY-bounds.top)/bounds.height)*100
    };
  };

  const handlePointerDown=(event,player)=>{
    event.currentTarget.setPointerCapture(event.pointerId);

    const pointer=getPosition(event,courtRef.current);

    dragOffsets.current[player.id]={
      x: player.x-pointer.x,
      y: player.y-pointer.y
    };
  };

  const handlePointerMove=(event,player)=>{
    if (!courtRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;

    const pointer=getPosition(event,courtRef.current);
    const offset=dragOffsets.current[player.id] || {x: 0,y: 0};

    onMovePlayer(
      player.id,
      clampPosition(pointer.x+offset.x),
      clampPosition(pointer.y+offset.y)
    );
  };

  const handlePointerUp=(event,playerId)=>{
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    delete dragOffsets.current[playerId];
  };

  const startArrowDrag=(event,arrow)=>{
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    arrowDrag.current={
      playerId: arrow.playerId,
      type: arrow.type,
      point: event.currentTarget.dataset.point,
      arrow
    };
  };

  const moveArrowDrag=(event)=>{
    if (
      !arrowDrag.current ||
      !arrowLayerRef.current ||
      !event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      return;
    }

    const pointer=getPosition(event,arrowLayerRef.current);
    const {arrow,point}=arrowDrag.current;

    if (point==='tip') {
      onMoveArrowPoint(
        arrowDrag.current.type,
        arrowDrag.current.playerId,
        'tip',
        clampPosition(pointer.x),
        clampPosition(pointer.y)
      );
      return;
    }

    onMoveArrowPoint(
      arrowDrag.current.type,
      arrowDrag.current.playerId,
      'control',
      clampPosition(2*pointer.x-(arrow.fromX+arrow.toX)/2),
      clampPosition(2*pointer.y-(arrow.fromY+arrow.toY)/2)
    );
  };

  const stopArrowDrag=(event)=>{
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
      <div className="court-top-label">
        COLOR DEL JUGADOR · DIANA: ATAQUE · ESCUDO: DEFENSA
      </div>

      <div className="court" ref={courtRef}>
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
          {visibleArrows.map((arrow)=>{
            const curvePoint=getCurvePoint(arrow);

            return (
              <g
                key={`${arrow.type}-${arrow.playerId}`}
                className="tactical-arrow"
                style={{'--arrow-color': arrow.color}}
              >
                <path
                  className="arrow-path"
                  d={`M ${arrow.fromX} ${arrow.fromY} Q ${arrow.controlX} ${arrow.controlY} ${arrow.toX} ${arrow.toY}`}
                />

                <ArrowEnd
                  arrow={arrow}
                  onPointerDown={(event)=>startArrowDrag(event,arrow)}
                  onPointerMove={moveArrowDrag}
                  onPointerUp={stopArrowDrag}
                />

                <circle
                  className="arrow-control"
                  cx={curvePoint.x}
                  cy={curvePoint.y}
                  r="0.7"
                  data-point="control"
                  aria-label="Curvatura de la flecha"
                  onPointerDown={(event)=>startArrowDrag(event,arrow)}
                  onPointerMove={moveArrowDrag}
                  onPointerUp={stopArrowDrag}
                  onPointerCancel={stopArrowDrag}
                />
              </g>
            );
          })}
        </svg>

        {Object.entries(ZONES).map(([number,zone])=>(
          <div className={`zone zone-${number}`} key={number}>
            <strong>Z{number}</strong>
            <span>{zone.title}</span>
          </div>
        ))}

        {guidance.map((item,index)=>{
          const Icon=directionIcons[item.direction] || FiArrowUp;
          const direction=item.direction || 'up';

          return (
            <div
              className={`position-guidance position-guidance-${direction}`}
              key={`${item.playerId}-${item.direction}-${index}`}
              style={{left: `${item.x}%`,top: `${item.y}%`}}
            >
              <SafeIcon icon={Icon} />
            </div>
          );
        })}

        {players.map((player)=>{
          const isFaulty=faultPlayerIds.includes(player.id);

          return (
            <motion.button
              className={`player ${isFaulty ? 'position-fault' : ''}`}
              key={player.id}
              aria-label={`${player.name},rol ${player.role},zona Z${player.rotationZone}`}
              animate={{left: `${player.x}%`,top: `${player.y}%`}}
              transition={{duration: 0}}
              style={{'--player-color': player.color}}
              onPointerDown={(event)=>handlePointerDown(event,player)}
              onPointerMove={(event)=>handlePointerMove(event,player)}
              onPointerUp={(event)=>handlePointerUp(event,player.id)}
              onPointerCancel={(event)=>handlePointerUp(event,player.id)}
            >
              <span>{player.role}</span>
              <small>{player.name}</small>
              <em className="player-zone-label">Z{player.rotationZone}</em>
            </motion.button>
          );
        })}
      </div>

      <div className="court-scale">
        <span>← 9 metros →</span>
        <span>Media pista: 9 × 9 m</span>
      </div>

      <div className="zone-legend" aria-label="Leyenda de acciones">
        <span>
          <strong className="attack-legend-dot">◎</strong> Ataque
        </span>
        <span>
          <strong className="defense-legend-dot">⬟</strong> Defensa
        </span>
      </div>
    </div>
  );
}

export default Court;