import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import './RotationDiagram.css';

const { FiBookOpen, FiExternalLink } = FiIcons;

const rules = [
  {
    number: '7.3–7.4',
    title: 'Orden y posiciones',
    text: 'Los seis jugadores conservan el orden de rotación registrado. Al recibir, deben respetar sus relaciones laterales y delantero–zaguero al golpe de saque.'
  },
  {
    number: '7.5',
    title: 'Falta de posición',
    text: 'Se produce si el equipo receptor no ocupa el orden posicional correcto cuando el sacador golpea el balón.'
  },
  {
    number: '7.6',
    title: 'Rotación',
    text: 'Al recuperar el saque, todos avanzan una posición en sentido horario: Z2→Z1→Z6→Z5→Z4→Z3→Z2.'
  },
  {
    number: '7.7',
    title: 'Falta de rotación',
    text: 'Se produce cuando el saque no se ejecuta según el orden de rotación. El orden debe corregirse.'
  }
];

const zones = [
  { zone: 4, title: 'Delantero izquierdo', className: 'rotation-zone-4' },
  { zone: 3, title: 'Delantero centro', className: 'rotation-zone-3' },
  { zone: 2, title: 'Delantero derecho', className: 'rotation-zone-2' },
  { zone: 5, title: 'Zaguero izquierdo', className: 'rotation-zone-5' },
  { zone: 6, title: 'Zaguero centro', className: 'rotation-zone-6' },
  { zone: 1, title: 'Zaguero derecho', className: 'rotation-zone-1' }
];

const arrows = [
  { label: '→', className: 'rotation-arrow-4-3' },
  { label: '→', className: 'rotation-arrow-3-2' },
  { label: '↓', className: 'rotation-arrow-2-1' },
  { label: '←', className: 'rotation-arrow-1-6' },
  { label: '←', className: 'rotation-arrow-6-5' },
  { label: '↑', className: 'rotation-arrow-5-4' }
];

function RotationDiagram() {
  return (
    <div className="rotation-diagram">
      <div className="diagram-label diagram-net">RED</div>

      <div className="rotation-court">
        <div className="diagram-label diagram-front">DELANTEROS</div>
        <div className="diagram-label diagram-back">ZAGUEROS</div>

        {zones.map((item) => (
          <div className={`rotation-zone ${item.className}`} key={item.zone}>
            <strong>Z{item.zone}</strong>
            <span>{item.title}</span>
          </div>
        ))}

        {arrows.map((arrow) => (
          <span className={`rotation-arrow ${arrow.className}`} key={arrow.className}>
            {arrow.label}
          </span>
        ))}
      </div>

      <div className="diagram-order">
        <span>Orden de rotación</span>
        <strong>Z2 → Z1 → Z6 → Z5 → Z4 → Z3 → Z2</strong>
      </div>
    </div>
  );
}

function RulesPanel() {
  return (
    <section className="rules-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Guía rápida</span>
          <h2>Cómo funciona la rotación</h2>
        </div>
        <SafeIcon icon={FiBookOpen} />
      </div>

      <RotationDiagram />

      <div className="rules-grid">
        {rules.map((rule) => (
          <article key={rule.number}>
            <span className="rule-number">Regla {rule.number}</span>
            <h3>{rule.title}</h3>
            <p>{rule.text}</p>
          </article>
        ))}
      </div>

      <a
        className="source-link"
        href="https://www.fivb.com/volleyball/the-game/official-volleyball-rules/"
        target="_blank"
        rel="noreferrer"
      >
        Consultar las Reglas Oficiales FIVB 2025–2028
        <SafeIcon icon={FiExternalLink} />
      </a>
    </section>
  );
}

export default RulesPanel;