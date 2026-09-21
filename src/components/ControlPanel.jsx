import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import MobileToolbar from './MobileToolbar';
import './ControlPanel.css';
import './TacticalSelect.css';
import {
  RECEPTION_SCHEMES,
  SYSTEMS,
  TACTICAL_PHASES
} from '../data/volleyball';

const {
  FiChevronDown,
  FiRotateCcw,
  FiRotateCw,
  FiRefreshCw,
  FiRadio
}=FiIcons;

const ROTATION_SELECTOR_ORDER=[1,6,5,4,3,2];

const ACTIVE_DEFENSE_DESCRIPTION='Tres bloqueadores en red, los jugadores de zonas 5 y 1 cubren las líneas laterales y el jugador de zona 6 protege el fondo.';

const MODE_DESCRIPTIONS={
  systems: 'Explora formaciones predefinidas, fases tácticas y esquemas de juego manteniendo el orden reglamentario.',
  libre: 'En modo Libre puedes mover jugadores, destinos y curvas tácticas.'
};

function TacticalSelect({id,value,onChange,children}) {
  return (
    <span className="tactical-select">
      <select
        id={id}
        value={value}
        onChange={(event)=> onChange(event.target.value)}
      >
        {children}
      </select>
      <SafeIcon
        icon={FiChevronDown}
        className="tactical-select-icon"
      />
    </span>
  );
}

function ArrowFilter({
  arrowFilter,
  onArrowFilterChange,
  type,
  exclusive=true
}) {
  const handleClick=()=> {
    onArrowFilterChange(exclusive ? `${type}-only` : type);
  };

  return (
    <button
      className={arrowFilter[type] ? 'active' : ''}
      aria-pressed={arrowFilter[type]}
      onClick={handleClick}
    >
      {type==='attack' ? 'Ataque' : 'Defensa'}
    </button>
  );
}

function FreeArrowFilters({arrowFilter,onArrowFilterChange}) {
  return (
    <div className="free-arrow-settings">
      <span className="field-label">
        Flechas visibles y editables
      </span>

      <div className="arrow-filter">
        <ArrowFilter
          arrowFilter={arrowFilter}
          onArrowFilterChange={onArrowFilterChange}
          type="attack"
          exclusive={false}
        />
        <ArrowFilter
          arrowFilter={arrowFilter}
          onArrowFilterChange={onArrowFilterChange}
          type="defense"
          exclusive={false}
        />
      </div>

      <span className="free-arrow-help">
        Activa un filtro. Arrastra el símbolo final para colocar el
        destino y la bolita central para curvar la línea.
      </span>
    </div>
  );
}

function SystemArrowFilter({
  arrowFilter,
  onArrowFilterChange,
  type
}) {
  return (
    <>
      <span className="field-label arrow-filter-label">
        Flechas visibles
      </span>
      <div
        className={`arrow-filter ${
          type==='attack' ? 'attack-only' : 'defense-only'
        }`}
      >
        <ArrowFilter
          arrowFilter={arrowFilter}
          onArrowFilterChange={onArrowFilterChange}
          type={type}
        />
      </div>
    </>
  );
}

function RotationControls({
  teamState,
  activeRotation,
  onRotationChange,
  onRotate
}) {
  const resetSelectedRotation=()=> {
    onRotationChange(activeRotation);
  };

  return (
    <div className="rotation-control-block">
      <span className="field-label">Rotación del colocador</span>

      <div
        className="rotation-selector"
        aria-label="Rotación activa"
      >
        {ROTATION_SELECTOR_ORDER.map((rotation)=> (
          <button
            key={rotation}
            className={
              activeRotation===`R${rotation}` ? 'active' : ''
            }
            onClick={()=> onRotationChange(`R${rotation}`)}
          >
            R{rotation}
          </button>
        ))}
      </div>

      <div className="rotation-actions">
        <button
          className="secondary-button"
          onClick={()=> onRotate('backward')}
        >
          <SafeIcon icon={FiRotateCcw} />
          Anterior
        </button>
        <button
          className="primary-button"
          onClick={()=> onRotate('forward')}
        >
          Rotar
          <SafeIcon icon={FiRotateCw} />
        </button>
      </div>

      {teamState==='libre' && (
        <button
          className="reset-button"
          onClick={resetSelectedRotation}
        >
          <SafeIcon icon={FiRefreshCw} />
          Reiniciar formación
        </button>
      )}
    </div>
  );
}

function DefenseSchemeSelector({
  defenseScheme,
  onDefenseSchemeChange
}) {
  return (
    <>
      <label
        className="field-label tactical-label"
        htmlFor="defense-scheme"
      >
        Esquema de defensa K-2
      </label>
      <TacticalSelect
        id="defense-scheme"
        value={defenseScheme}
        onChange={onDefenseSchemeChange}
      >
        <option value="3-1-2">3-2-1 · 6 atrás</option>
        <option value="3-1-2-forward" disabled>
          3-1-2 · 6 adelantado · Próximamente
        </option>
      </TacticalSelect>
      <div className="system-note">
        <span>{ACTIVE_DEFENSE_DESCRIPTION}</span>
      </div>
    </>
  );
}

function ControlPanel(props) {
  const {
    teamState,
    systemType,
    tacticalPhase,
    activeRotation,
    receptionScheme,
    defenseScheme,
    arrowFilter,
    freeServeEnabled,
    onStateChange,
    onSystemChange,
    onPhaseChange,
    onReceptionSchemeChange,
    onDefenseSchemeChange,
    onArrowFilterChange,
    onFreeServeChange,
    onRotationChange,
    onRotate
  }=props;

  const activeSystem=SYSTEMS[systemType];

  const handlePhaseChange=(phase)=> {
    onArrowFilterChange(
      phase==='receiving' ? 'attack-only' : 'defense-only'
    );
    onPhaseChange(phase);
  };

  return (
    <>
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
            className={teamState==='systems' ? 'active' : ''}
            onClick={()=> onStateChange('systems')}
          >
            Sistemas
          </button>
          <button
            className={teamState==='libre' ? 'active' : ''}
            onClick={()=> onStateChange('libre')}
          >
            Libre
          </button>
        </div>

        <p className="mode-description" aria-live="polite">
          {MODE_DESCRIPTIONS[teamState]}
        </p>

        <RotationControls
          teamState={teamState}
          activeRotation={activeRotation}
          onRotationChange={onRotationChange}
          onRotate={onRotate}
        />

        <div className="optional-settings">
          <span className="optional-settings-label">
            Configuración táctica
          </span>

          {teamState==='libre' && (
            <>
              <div className="free-serve-setting">
                <div>
                  <strong>Saque</strong>
                  <span>
                    Muestra el balón junto al jugador de Z1.
                  </span>
                </div>
                <button
                  className={freeServeEnabled ? 'active' : ''}
                  type="button"
                  role="switch"
                  aria-checked={freeServeEnabled}
                  aria-label="Mostrar jugador al saque"
                  onClick={()=> (
                    onFreeServeChange(!freeServeEnabled)
                  )}
                >
                  <span />
                </button>
              </div>

              <FreeArrowFilters
                arrowFilter={arrowFilter}
                onArrowFilterChange={onArrowFilterChange}
              />
            </>
          )}

          {teamState==='systems' && (
            <div className="system-settings">
              <label className="field-label" htmlFor="system">
                Sistema de juego
              </label>
              <TacticalSelect
                id="system"
                value={systemType}
                onChange={onSystemChange}
              >
                {Object.entries(SYSTEMS).map(([value,system])=> (
                  <option
                    key={value}
                    value={value}
                    disabled={value==='4-2'}
                  >
                    {system.label}
                    {value==='4-2' ? ' · Próximamente' : ''}
                  </option>
                ))}
              </TacticalSelect>

              <label
                className="field-label tactical-label"
                htmlFor="phase"
              >
                Fase táctica
              </label>
              <TacticalSelect
                id="phase"
                value={tacticalPhase}
                onChange={handlePhaseChange}
              >
                {Object.entries(TACTICAL_PHASES).map(
                  ([value,phase])=> (
                    <option
                      key={value}
                      value={value}
                      disabled={value==='postServe'}
                    >
                      {phase.label}
                      {value==='postServe'
                        ? ' · Próximamente'
                        : ''}
                    </option>
                  )
                )}
              </TacticalSelect>

              {tacticalPhase==='receiving' && (
                <>
                  <label
                    className="field-label tactical-label"
                    htmlFor="reception-scheme"
                  >
                    Esquema de recepción K-1
                  </label>
                  <TacticalSelect
                    id="reception-scheme"
                    value={receptionScheme}
                    onChange={onReceptionSchemeChange}
                  >
                    {Object.entries(RECEPTION_SCHEMES).map(
                      ([value,scheme])=> (
                        <option
                          key={value}
                          value={value}
                          disabled={value==='support'}
                        >
                          {scheme.label}
                          {value==='support'
                            ? ' · Próximamente'
                            : ''}
                        </option>
                      )
                    )}
                  </TacticalSelect>
                  <div className="system-note">
                    <span>
                      {RECEPTION_SCHEMES[receptionScheme].description}
                    </span>
                  </div>
                  <SystemArrowFilter
                    arrowFilter={arrowFilter}
                    onArrowFilterChange={onArrowFilterChange}
                    type="attack"
                  />
                </>
              )}

              {tacticalPhase==='serving' && (
                <>
                  <DefenseSchemeSelector
                    defenseScheme={defenseScheme}
                    onDefenseSchemeChange={onDefenseSchemeChange}
                  />
                  <SystemArrowFilter
                    arrowFilter={arrowFilter}
                    onArrowFilterChange={onArrowFilterChange}
                    type="defense"
                  />
                </>
              )}

              {activeSystem.description && (
                <div className="system-note">
                  <span>{activeSystem.description}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <MobileToolbar {...props} />
    </>
  );
}

export default ControlPanel;