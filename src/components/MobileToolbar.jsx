import React,{useEffect,useRef,useState} from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import {
  RECEPTION_SCHEMES,
  SYSTEMS,
  TACTICAL_PHASES
} from '../data/volleyball';
import './MobileToolbar.css';
import './TacticalSelect.css';

const {
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiDownload,
  FiRefreshCw,
  FiRotateCw,
  FiShare,
  FiSliders
}=FiIcons;

const ROTATION_SELECTOR_ORDER=[1,6,5,4,3,2];

function ToolbarSelect({label,value,onChange,children}) {
  return (
    <label className="mobile-toolbar-field">
      <span>{label}</span>
      <div className="tactical-select">
        <select
          value={value}
          onChange={(event)=> onChange(event.target.value)}
        >
          {children}
        </select>
        <SafeIcon
          icon={FiChevronDown}
          className="tactical-select-icon"
        />
      </div>
    </label>
  );
}

function RotationDropdown({activeRotation,onRotationChange}) {
  const [open,setOpen]=useState(false);
  const dropdownRef=useRef(null);

  useEffect(()=> {
    const closeDropdown=(event)=> {
      if (!dropdownRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown',closeDropdown);
    return ()=> {
      document.removeEventListener('pointerdown',closeDropdown);
    };
  },[]);

  const selectRotation=(rotation)=> {
    onRotationChange(rotation);
    setOpen(false);
  };

  return (
    <div className="mobile-rotation-dropdown" ref={dropdownRef}>
      <span className="mobile-rotation-label">Rotación</span>
      <button
        className="mobile-rotation-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={()=> setOpen((current)=> !current)}
      >
        <strong>{activeRotation}</strong>
        <SafeIcon icon={open ? FiChevronUp : FiChevronDown} />
      </button>

      {open && (
        <div
          className="mobile-rotation-menu"
          role="listbox"
          aria-label="Seleccionar rotación"
        >
          <span className="mobile-rotation-menu-title">
            Rotación activa
          </span>
          <div className="mobile-rotation-options">
            {ROTATION_SELECTOR_ORDER.map((rotation)=> {
              const value=`R${rotation}`;
              const selected=activeRotation===value;

              return (
                <button
                  key={value}
                  className={selected ? 'selected' : ''}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={()=> selectRotation(value)}
                >
                  <span>{value}</span>
                  {selected && <SafeIcon icon={FiCheck} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function InstallPrompt() {
  const [installEvent,setInstallEvent]=useState(null);
  const [showIosHelp,setShowIosHelp]=useState(false);
  const [visible,setVisible]=useState(false);

  useEffect(()=> {
    const standalone=window.matchMedia(
      '(display-mode: standalone)'
    ).matches || window.navigator.standalone;

    if (
      standalone ||
      sessionStorage.getItem('pwa-prompt-dismissed')
    ) {
      return undefined;
    }

    const isMobile=window.matchMedia(
      '(max-width: 620px)'
    ).matches;
    const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent);

    if (isMobile && isIos) {
      setVisible(true);
      setShowIosHelp(true);
    }

    const handleInstallAvailable=(event)=> {
      event.preventDefault();
      setInstallEvent(event);
      setVisible(true);
    };

    const handleInstalled=()=> {
      setInstallEvent(null);
      setVisible(false);
    };

    window.addEventListener(
      'beforeinstallprompt',
      handleInstallAvailable
    );
    window.addEventListener('appinstalled',handleInstalled);

    return ()=> {
      window.removeEventListener(
        'beforeinstallprompt',
        handleInstallAvailable
      );
      window.removeEventListener('appinstalled',handleInstalled);
    };
  },[]);

  const dismiss=()=> {
    sessionStorage.setItem('pwa-prompt-dismissed','true');
    setVisible(false);
  };

  const install=async()=> {
    if (!installEvent) {
      setShowIosHelp(true);
      return;
    }

    await installEvent.prompt();
    const choice=await installEvent.userChoice;

    if (choice.outcome==='accepted') {
      setVisible(false);
    }

    setInstallEvent(null);
  };

  if (!visible) return null;

  return (
    <aside
      className="pwa-install-prompt"
      aria-label="Instalar aplicación"
    >
      <div className="pwa-install-icon">
        <SafeIcon icon={installEvent ? FiDownload : FiShare} />
      </div>
      <div className="pwa-install-copy">
        <strong>Instala Rotación Vóley</strong>
        <span>
          {showIosHelp && !installEvent
            ? 'Pulsa Compartir y después “Añadir a pantalla de inicio”.'
            : 'Úsala a pantalla completa y accede más rápido.'}
        </span>
      </div>
      {installEvent && (
        <button
          className="pwa-install-action"
          type="button"
          onClick={install}
        >
          Instalar
        </button>
      )}
      <button
        className="pwa-install-close"
        type="button"
        aria-label="Cerrar invitación"
        onClick={dismiss}
      >
        ×
      </button>
    </aside>
  );
}

function MobileToolbar(props) {
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

  const [courtVisible,setCourtVisible]=useState(false);
  const [expanded,setExpanded]=useState(false);

  useEffect(()=> {
    const court=document.querySelector('.court-shell');
    if (!court) return undefined;

    const observer=new IntersectionObserver(
      ([entry])=> {
        const visible=entry.isIntersecting &&
          entry.intersectionRatio > 0.08;
        setCourtVisible(visible);

        if (!visible) {
          setExpanded(false);
        }
      },
      {
        threshold: [0,0.08,0.2],
        rootMargin: '0px 0px -72px 0px'
      }
    );

    observer.observe(court);
    return ()=> observer.disconnect();
  },[]);

  useEffect(()=> {
    document.body.classList.toggle(
      'mobile-toolbar-expanded',
      courtVisible && expanded
    );

    return ()=> {
      document.body.classList.remove(
        'mobile-toolbar-expanded'
      );
    };
  },[courtVisible,expanded]);

  const changePhase=(phase)=> {
    onArrowFilterChange(
      phase==='receiving' ? 'attack-only' : 'defense-only'
    );
    onPhaseChange(phase);
  };

  const resetSelectedRotation=()=> {
    onRotationChange(activeRotation);
  };

  return (
    <>
      <InstallPrompt />

      <div
        className={`mobile-toolbar ${
          courtVisible ? 'visible' : ''
        } ${expanded ? 'expanded' : ''}`}
        aria-hidden={!courtVisible}
      >
        {expanded && (
          <button
            className="mobile-toolbar-backdrop"
            type="button"
            aria-label="Cerrar opciones tácticas"
            onClick={()=> setExpanded(false)}
          />
        )}

        {expanded && (
          <div className="mobile-toolbar-sheet">
            <div className="mobile-toolbar-sheet-heading">
              <strong>Opciones tácticas</strong>
              <button
                type="button"
                aria-label="Cerrar opciones"
                onClick={()=> setExpanded(false)}
              >
                <SafeIcon icon={FiChevronDown} />
              </button>
            </div>

            <div className="mobile-toolbar-mode">
              <button
                className={
                  teamState==='systems' ? 'active' : ''
                }
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

            {teamState==='systems' ? (
              <div className="mobile-toolbar-grid">
                <ToolbarSelect
                  label="Sistema"
                  value={systemType}
                  onChange={onSystemChange}
                >
                  {Object.entries(SYSTEMS).map(
                    ([value,system])=> (
                      <option
                        key={value}
                        value={value}
                        disabled={value==='4-2'}
                      >
                        {system.label}
                        {value==='4-2'
                          ? ' · Próximamente'
                          : ''}
                      </option>
                    )
                  )}
                </ToolbarSelect>

                <ToolbarSelect
                  label="Fase"
                  value={tacticalPhase}
                  onChange={changePhase}
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
                </ToolbarSelect>

                {tacticalPhase==='receiving' && (
                  <ToolbarSelect
                    label="Recepción K-1"
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
                  </ToolbarSelect>
                )}

                {tacticalPhase==='serving' && (
                  <ToolbarSelect
                    label="Defensa K-2"
                    value={defenseScheme}
                    onChange={onDefenseSchemeChange}
                  >
                    <option value="3-1-2">
                      3-2-1 · 6 atrás
                    </option>
                    <option value="3-1-2-forward" disabled>
                      3-1-2 · 6 adelantado · Próximamente
                    </option>
                  </ToolbarSelect>
                )}
              </div>
            ) : (
              <div className="mobile-toolbar-free">
                <button
                  className={freeServeEnabled ? 'active' : ''}
                  role="switch"
                  aria-checked={freeServeEnabled}
                  onClick={()=> (
                    onFreeServeChange(!freeServeEnabled)
                  )}
                >
                  Saque
                </button>
                <button
                  className={arrowFilter.attack ? 'active' : ''}
                  onClick={()=> onArrowFilterChange('attack')}
                >
                  Ataque
                </button>
                <button
                  className={arrowFilter.defense ? 'active' : ''}
                  onClick={()=> onArrowFilterChange('defense')}
                >
                  Defensa
                </button>
              </div>
            )}
          </div>
        )}

        <div
          className={`mobile-toolbar-bar ${
            teamState==='libre'
              ? 'mobile-toolbar-bar-free'
              : 'mobile-toolbar-bar-systems'
          }`}
        >
          {teamState==='libre' && (
            <button
              className="mobile-toolbar-icon mobile-toolbar-reset"
              aria-label="Reiniciar formación"
              title="Reiniciar formación"
              onClick={resetSelectedRotation}
            >
              <SafeIcon icon={FiRefreshCw} />
            </button>
          )}

          <RotationDropdown
            activeRotation={activeRotation}
            onRotationChange={onRotationChange}
          />

          <button
            className="mobile-toolbar-rotate"
            onClick={()=> onRotate('forward')}
          >
            Rotar
            <SafeIcon icon={FiRotateCw} />
          </button>

          <button
            className={`mobile-toolbar-options ${
              expanded ? 'active' : ''
            }`}
            aria-expanded={expanded}
            aria-label={
              expanded
                ? 'Cerrar opciones tácticas'
                : 'Mostrar opciones tácticas'
            }
            onClick={()=> setExpanded((current)=> !current)}
          >
            <SafeIcon
              icon={expanded ? FiChevronDown : FiChevronUp}
              className="mobile-toolbar-options-arrow"
            />
            <SafeIcon
              icon={FiSliders}
              className="mobile-toolbar-options-main"
            />
          </button>
        </div>
      </div>
    </>
  );
}

export default MobileToolbar;