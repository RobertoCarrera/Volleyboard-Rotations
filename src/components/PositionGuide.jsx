import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import './PositionGuide.css';

const { FiMapPin, FiShield, FiTarget } = FiIcons;

const positions = [
  {
    title: 'Bandas / Puntas',
    role: 'R1 · R2',
    icon: FiTarget,
    color: '#69d8ae',
    front: [4],
    back: [6, 5],
    description:
      'Cuando son delanteros se ubican en la zona 4. Al pasar a la zaga, juegan habitualmente en la zona 6. Si el líbero se desplaza a Z6, el punta cubre Z5.'
  },
  {
    title: 'Centrales',
    role: 'C1 · C2',
    icon: FiMapPin,
    color: '#9c83ff',
    front: [3],
    back: [5],
    description:
      'En la línea delantera juegan en la zona 3. Al pasar a la zaga, su posición teórica es la zona 5, donde habitualmente son reemplazados por el líbero.'
  },
  {
    title: 'Opuesto',
    role: 'O',
    icon: FiTarget,
    color: '#fc785d',
    front: [2],
    back: [1],
    description:
      'Cuando actúa como delantero se posiciona en la zona 2. Al pasar a la línea zaguera, juega desde la zona 1.'
  },
  {
    title: 'Colocador / Armador',
    role: 'COL',
    icon: FiMapPin,
    color: '#ffcf57',
    front: [2],
    back: [1],
    description:
      'Si está como delantero se ubica en la zona 2. Cuando pasa a ser zaguero, juega desde la zona 1.'
  },
  {
    title: 'Líbero',
    role: 'L',
    icon: FiShield,
    color: '#65b8ff',
    front: [],
    back: [5, 6],
    description:
      'Es un especialista defensivo que solo juega en zaga. Habitualmente ocupa Z5 reemplazando al central, pero también puede desplazarse a Z6. En ese caso, el punta cubre Z5.'
  }
];

const courtZones = [
  { number: 4, label: 'Delantero izquierdo', line: 'front' },
  { number: 3, label: 'Delantero centro', line: 'front' },
  { number: 2, label: 'Delantero derecho', line: 'front' },
  { number: 5, label: 'Zaguero izquierdo', line: 'back' },
  { number: 6, label: 'Zaguero centro', line: 'back' },
  { number: 1, label: 'Zaguero derecho', line: 'back' }
];

function MiniCourt({ position }) {
  const highlightedZones = [...position.front, ...position.back];

  return (
    <div
      className="mini-court"
      aria-label={`Campo de voleibol con las zonas habituales de ${position.title}`}
    >
      <span className="mini-net">RED</span>
      <span className="mini-line mini-front-label">DELANTEROS</span>
      <span className="mini-line mini-back-label">ZAGUEROS</span>

      <div className="mini-court-grid">
        {courtZones.map((zone) => {
          const highlighted = highlightedZones.includes(zone.number);

          return (
            <div
              className={`mini-zone mini-zone-${zone.number} ${
                highlighted ? 'highlighted' : ''
              }`}
              key={zone.number}
              style={
                highlighted
                  ? { '--zone-color': position.color }
                  : undefined
              }
            >
              <strong>Z{zone.number}</strong>
              <span>{zone.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PositionCard({ position }) {
  const Icon = position.icon;
  const frontLabel = position.front.length
    ? position.front.map((zone) => `Z${zone}`).join(' / ')
    : 'No juega';
  const backLabel = position.back.length
    ? position.back.map((zone) => `Z${zone}`).join(' / ')
    : 'No juega';

  return (
    <article className="position-card">
      <div className="position-card-heading">
        <span
          className="position-icon"
          style={{ '--position-color': position.color }}
        >
          <SafeIcon icon={Icon} />
        </span>
        <div>
          <h3>{position.title}</h3>
          <span className="position-role">{position.role}</span>
        </div>
      </div>

      <MiniCourt position={position} />

      <div className="position-zones">
        <div>
          <span className="position-line-label">Delantero</span>
          <strong>{frontLabel}</strong>
        </div>
        <div>
          <span className="position-line-label">Zaguero</span>
          <strong>{backLabel}</strong>
        </div>
      </div>

      <p>{position.description}</p>
    </article>
  );
}

function PositionGuide() {
  return (
    <section className="position-guide">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Después del saque</span>
          <h2>Dónde juega cada posición</h2>
        </div>
        <SafeIcon icon={FiMapPin} />
      </div>

      <p className="position-guide-intro">
        Después del saque, cada especialista se desplaza a la zona en la que
        desarrolla su función. La distribución defensiva habitual es Z1 para
        el colocador u opuesto, Z5 para el líbero y Z6 para el punta.
      </p>

      <div className="position-grid">
        {positions.map((position) => (
          <PositionCard key={position.role} position={position} />
        ))}
      </div>
    </section>
  );
}

export default PositionGuide;