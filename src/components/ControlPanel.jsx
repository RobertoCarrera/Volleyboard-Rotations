import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import {
  DEFENSE_SCHEMES,
  RECEPTION_SCHEMES,
  SYSTEMS,
  TACTICAL_PHASES
} from '../data/volleyball';

const {FiRotateCcw,FiRotateCw,FiRefreshCw,FiRadio,FiInfo}=FiIcons;

function ArrowFilter({arrowFilter,onArrowFilterChange}) {
  return (
    <>
      <span className="field-label arrow-filter-label">Flechas visibles</span>
      <div className="arrow-filter" aria-label="Filtrar flechas visibles">
        <button
          className={arrowFilter.attack ? 'active' : ''}
          aria-pressed={arrowFilter.attack}
          onClick={()=>onArrowFilterChange('attack')}
        >
          Ataque
        </button>
        <button
          className={arrowFilter.defense ? 'active' : ''}
          aria-pressed={arrowFilter.defense}
          onClick={()=>onArrowFilterChange('defense')}
        >
          Defensa
        </button>
      </div>
    </>
  );
}

function ControlPanel({
  teamState,
  systemType,
  tacticalPhase,
  activeRotation,
  receptionScheme,
  defenseScheme,
  arrowFilter,
  onStateChange,
  onSystemChange,
  onPhaseChange,
  onReceptionSchemeChange,
  onDefenseSchemeChange,
  onArrowFilterChange,
  onRotationChange,
  onRotate,
  onReset
}) {
  const activeSystem=SYSTEMS[systemType];

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
          className={teamState==='libre' ? 'active' : ''}
          onClick={()=>onStateChange('libre')}
        >
          Libre
        </button>
        <button
          className={teamState==='systems' ? 'active' : ''}
          onClick={()=>onStateChange('systems')}
        >
          Sistemas
        </button>
      </div>

      {teamState==='systems' && (
        <div className="system-settings">
          <label className="field-label" htmlFor="system">Sistema de juego</label>
          <select id="system" value={systemType} onChange={(event)=>onSystemChange(event.target.value)}>
            {Object.entries(SYSTEMS).map(([value,system])=>(
              <option key={value} value={value}>{system.label}</option>
            ))}
          </select>

          <label className="field-label tactical-label" htmlFor="phase">Fase táctica</label>
          <select id="phase" value={tacticalPhase} onChange={(event)=>onPhaseChange(event.target.value)}>
            {Object.entries(TACTICAL_PHASES).map(([value,phase])=>(
              <option key={value} value={value}>{phase.label}</option>
            ))}
          </select>

          {tacticalPhase==='receiving' && (
            <>
              <label className="field-label tactical-label" htmlFor="reception-scheme">
                Esquema de recepción K-1
              </label>
              <select
                id="reception-scheme"
                value={receptionScheme}
                onChange={(event)=>onReceptionSchemeChange(event.target.value)}
              >
                {Object.entries(RECEPTION_SCHEMES).map(([value,scheme])=>(
                  <option key={value} value={value}>{scheme.label}</option>
                ))}
              </select>

              <div className="system-note">
                <SafeIcon icon={FiInfo} />
                <span>{RECEPTION_SCHEMES[receptionScheme].description}</span>
              </div>
            </>
          )}

          {tacticalPhase==='serving' && (
            <>
              <label className="field-label tactical-label" htmlFor="defense-scheme">
                Esquema de defensa K-2
              </label>
              <select
                id="defense-scheme"
                value={defenseScheme}
                onChange={(event)=>onDefenseSchemeChange(event.target.value)}
              >
                {Object.entries(DEFENSE_SCHEMES).map(([value,scheme])=>(
                  <option key={value} value={value}>{scheme.label}</option>
                ))}
              </select>

              <div className="system-note">
                <SafeIcon icon={FiInfo} />
                <span>{DEFENSE_SCHEMES[defenseScheme].description}</span>
              </div>
            </>
          )}

          {tacticalPhase==='postServe' && (
            <div className="system-note">
              <SafeIcon icon={FiInfo} />
              <span>
                Tras el saque: puntas a Z4/Z6, centrales a Z3/Z5, colocador y opuesto a Z2/Z1.
                El líbero ocupa habitualmente Z5; si se mueve a Z6, intercambia su posición con el punta.
              </span>
            </div>
          )}

          {tacticalPhase!=='postServe' && (
            <ArrowFilter
              arrowFilter={arrowFilter}
              onArrowFilterChange={onArrowFilterChange}
            />
          )}

          <div className="system-note">
            <SafeIcon icon={FiInfo} />
            <span>{activeSystem.description}</span>
          </div>
        </div>
      )}

      <span className="field-label">Rotación del colocador</span>
      <div className="rotation-selector" aria-label="Rotación activa">
        {[1,2,3,4,5,6].map((rotation)=>(
          <button
            key={rotation}
            className={activeRotation===`R${rotation}` ? 'active' : ''}
            onClick={()=>onRotationChange(`R${rotation}`)}
          >
            R{rotation}
          </button>
        ))}
      </div>

      <div className="rotation-actions">
        <button className="secondary-button" onClick={()=>onRotate('backward')}>
          <SafeIcon icon={FiRotateCcw} /> Anterior
        </button>
        <button className="primary-button" onClick={()=>onRotate('forward')}>
          Rotar <SafeIcon icon={FiRotateCw} />
        </button>
      </div>

      <button className="reset-button" onClick={onReset}>
        <SafeIcon icon={FiRefreshCw} /> Reiniciar formación
      </button>
    </section>
  );
}

export default ControlPanel;