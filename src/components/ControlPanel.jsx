import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { SYSTEMS, TACTICAL_PHASES } from '../data/volleyball';

const { FiRotateCcw, FiRotateCw, FiRefreshCw, FiRadio, FiInfo } = FiIcons;

function ControlPanel({
  teamState,
  systemType,
  tacticalPhase,
  activeRotation,
  onStateChange,
  onSystemChange,
  onPhaseChange,
  onRotationChange,
  onRotate,
  onReset
}) {
  const activeSystem = SYSTEMS[systemType];

  return (
    <section className="control-panel">
      <div className="control-heading">
        <div>
          <span className="eyebrow">Simulación</span>
          <h2>Control de modo</h2>
        </div>
        <SafeIcon icon={FiRadio} />
      </div>

      <div className="segmented" aria-label="Modo de juego">
        <button
          className={teamState === 'libre' ? 'active' : ''}
          onClick={() => onStateChange('libre')}
        >
          Libre
        </button>
        <button
          className={teamState === 'systems' ? 'active' : ''}
          onClick={() => onStateChange('systems')}
        >
          Sistemas
        </button>
      </div>

      {teamState === 'systems' && (
        <div className="system-settings">
          <label className="field-label" htmlFor="system">
            Sistema de juego
          </label>
          <select
            id="system"
            value={systemType}
            onChange={(event) => onSystemChange(event.target.value)}
          >
            {Object.entries(SYSTEMS).map(([value, system]) => (
              <option key={value} value={value}>
                {system.label}
              </option>
            ))}
          </select>

          <label className="field-label tactical-label" htmlFor="phase">
            Fase táctica
          </label>
          <select
            id="phase"
            value={tacticalPhase}
            onChange={(event) => onPhaseChange(event.target.value)}
          >
            {Object.entries(TACTICAL_PHASES).map(([value, phase]) => (
              <option key={value} value={value}>
                {phase.label}
              </option>
            ))}
          </select>

          <div className="system-note">
            <SafeIcon icon={FiInfo} />
            <span>{activeSystem.description}</span>
          </div>
        </div>
      )}

      {teamState === 'systems' && (
        <>
          <span className="field-label">Rotación del colocador</span>
          <div className="rotation-selector" aria-label="Rotación activa">
            {[1, 2, 3, 4, 5, 6].map((rotation) => (
              <button
                key={rotation}
                className={activeRotation === `R${rotation}` ? 'active' : ''}
                onClick={() => onRotationChange(`R${rotation}`)}
              >
                R{rotation}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="rotation-actions">
        <button
          className="secondary-button"
          onClick={() => onRotate('backward')}
        >
          <SafeIcon icon={FiRotateCcw} />
          Anterior
        </button>
        <button
          className="primary-button"
          onClick={() => onRotate('forward')}
        >
          Rotar
          <SafeIcon icon={FiRotateCw} />
        </button>
      </div>

      <button className="reset-button" onClick={onReset}>
        <SafeIcon icon={FiRefreshCw} />
        Reiniciar formación
      </button>
    </section>
  );
}

export default ControlPanel;