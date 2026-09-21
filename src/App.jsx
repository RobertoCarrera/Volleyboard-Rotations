import React,{useEffect,useMemo,useState} from 'react';
import ControlPanel from './components/ControlPanel';
import Court from './components/Court';
import RulesPanel from './components/RulesPanel';
import ValidationCard from './components/ValidationCard';
import {
  createNeutralPlayers,
  getRotatedZone,
  getTacticalPreset,
  updatePlayerAtZone,
  ZONES
} from './data/volleyball';
import {getK1PlayerPosition} from './data/k1Layout';
import {
  applyK2DefenseLayout,
  getK2PlayerPosition
} from './data/k2Layout';
import {
  getAttackGuidance,
  getDefenseGuidance
} from './data/tacticalGuidance';
import {validateFormation} from './utils/rotationValidator';
import './App.css';

const LOGO_URL='https://media-manager-c.questera.ai/greta-media/cc76ec2ec846f09d0b7678ce8abad966b6b15cfbd815d897acbcc672bcb758daed108b7569ea9863a79623fb5385aba3/images/aW1hZ2UvcG5n/fd2b1aedfb9791bd72672e89731464b5.png';
const ROTATION_SEQUENCE=['R1','R6','R5','R4','R3','R2'];

const ROTATION_PRESET_MAP={
  R1: 'R1',
  R6: 'R2',
  R5: 'R3',
  R4: 'R4',
  R3: 'R5',
  R2: 'R6'
};

const LIBERO_CENTRAL_SWAP={
  R3: {L: 5,C1: 2},
  R4: {L: 6,C1: 3},
  R5: {L: 1,C1: 4}
};

const FREE_MODE_CENTRAL_OVERRIDES={
  R5: {
    L: {
      displayRole: 'C2',
      displayName: 'Central 2',
      displayColor: '#704fbd'
    }
  },
  R2: {
    L: {
      displayRole: 'C1',
      displayName: 'Central 1',
      displayColor: '#6149a7'
    }
  }
};

const getPresetRotation=(rotation)=> (
  ROTATION_PRESET_MAP[rotation] || rotation
);

const getRotationSteps=(rotation)=> {
  const index=ROTATION_SEQUENCE.indexOf(rotation);
  return index >= 0 ? index : 0;
};

const getCorrectedZone=(rotation,playerId,zone)=> (
  LIBERO_CENTRAL_SWAP[rotation]?.[playerId] || zone
);

const getFreeModePosition=(
  rotation,
  playerId,
  zone,
  serveEnabled
)=> ({
  ...ZONES[zone],
  ...(serveEnabled
    ? FREE_MODE_CENTRAL_OVERRIDES[rotation]?.[playerId]
    : {})
});

const getNeutralRotation=(rotation,serveEnabled=false)=> {
  const steps=getRotationSteps(rotation);

  return createNeutralPlayers(rotation).map((player)=> {
    let zone=player.zone;

    for (let step=0;step < steps;step +=1) {
      zone=getRotatedZone(zone,'forward');
    }

    const correctedZone=getCorrectedZone(
      rotation,
      player.id,
      zone
    );

    return updatePlayerAtZone(
      player,
      correctedZone,
      getFreeModePosition(
        rotation,
        player.id,
        correctedZone,
        serveEnabled
      ),
      correctedZone,
      rotation
    );
  });
};

const getSystemRotation=(
  rotation,
  phase='receiving',
  reception='standard',
  defense='3-1-2'
)=> {
  const sourceRotation=getPresetRotation(rotation);
  const preset=getTacticalPreset(
    sourceRotation,
    reception,
    defense
  );

  return createNeutralPlayers(sourceRotation).map((player)=> {
    const rolePreset=preset[player.id];
    const nominalZone=getCorrectedZone(
      rotation,
      player.id,
      rolePreset.zone
    );
    const zone=phase==='postServe'
      ? rolePreset.postServeZone
      : nominalZone;

    let position=rolePreset[phase];

    if (phase==='receiving') {
      position=getK1PlayerPosition(
        sourceRotation,
        reception,
        player.id,
        position
      );
    }

    if (phase==='serving') {
      position=getK2PlayerPosition(
        sourceRotation,
        defense,
        player.id,
        position
      );
    }

    return updatePlayerAtZone(
      player,
      zone,
      position,
      nominalZone,
      sourceRotation
    );
  });
};

const getNextRotation=(rotation,direction)=> {
  const currentIndex=ROTATION_SEQUENCE.indexOf(rotation);
  const offset=direction==='forward' ? 1 : -1;
  const nextIndex=(
    currentIndex + offset + ROTATION_SEQUENCE.length
  ) % ROTATION_SEQUENCE.length;

  return ROTATION_SEQUENCE[nextIndex];
};

function App() {
  const [players,setPlayers]=useState(()=> (
    getSystemRotation('R1','receiving','standard','3-1-2')
  ));
  const [teamState,setTeamState]=useState('systems');
  const [systemType,setSystemType]=useState('5-1');
  const [tacticalPhase,setTacticalPhase]=useState('receiving');
  const [activeRotation,setActiveRotation]=useState('R1');
  const [receptionScheme,setReceptionScheme]=useState('standard');
  const [defenseScheme,setDefenseScheme]=useState('3-1-2');
  const [freeServeEnabled,setFreeServeEnabled]=useState(false);
  const [arrowFilter,setArrowFilter]=useState({
    attack: true,
    defense: false
  });
  const [arrowPoints,setArrowPoints]=useState({
    attack: {},
    defense: {}
  });

  const presetRotation=getPresetRotation(activeRotation);

  useEffect(()=> {
    if (!('serviceWorker' in navigator)) return undefined;

    const registerWorker=()=> {
      navigator.serviceWorker.register('/sw.js').catch(
        ()=> undefined
      );
    };

    window.addEventListener('load',registerWorker);

    return ()=> window.removeEventListener('load',registerWorker);
  },[]);

  const validation=useMemo(
    ()=> validateFormation({
      players,
      teamState,
      tolerance: 0.5
    }),
    [players,teamState]
  );

  const attackGuidance=useMemo(
    ()=> getAttackGuidance(
      players,
      teamState,
      tacticalPhase,
      presetRotation,
      arrowPoints.attack
    ),
    [
      players,
      teamState,
      tacticalPhase,
      presetRotation,
      arrowPoints.attack
    ]
  );

  const defenseGuidance=useMemo(()=> {
    const guidance=getDefenseGuidance(
      players,
      teamState,
      tacticalPhase,
      presetRotation,
      arrowPoints.defense
    );

    const presetGuidance=teamState==='systems'
      ? applyK2DefenseLayout(
        guidance,
        presetRotation,
        defenseScheme
      )
      : guidance;

    return presetGuidance.map((arrow)=> ({
      ...arrow,
      ...arrowPoints.defense[arrow.playerId]
    }));
  },[
    players,
    teamState,
    tacticalPhase,
    presetRotation,
    defenseScheme,
    arrowPoints.defense
  ]);

  const applyPreset=(
    rotation,
    phase=tacticalPhase,
    reception=receptionScheme,
    defense=defenseScheme
  )=> {
    setPlayers(
      getSystemRotation(
        rotation,
        phase,
        reception,
        defense
      )
    );
    setActiveRotation(rotation);
  };

  const handleStateChange=(state)=> {
    setTeamState(state);
    setArrowPoints({attack: {},defense: {}});

    if (state==='systems') {
      setArrowFilter(
        tacticalPhase==='receiving'
          ? {attack: true,defense: false}
          : {attack: false,defense: true}
      );
      applyPreset(activeRotation);
      return;
    }

    setArrowFilter({attack: false,defense: false});
    setPlayers(
      getNeutralRotation(activeRotation,freeServeEnabled)
    );
  };

  const handlePhaseChange=(phase)=> {
    setTacticalPhase(phase);
    setArrowPoints({attack: {},defense: {}});

    if (teamState==='systems') {
      applyPreset(activeRotation,phase);
    }
  };

  const handleReceptionSchemeChange=(scheme)=> {
    setReceptionScheme(scheme);
    setArrowPoints({attack: {},defense: {}});

    if (
      teamState==='systems' &&
      tacticalPhase==='receiving'
    ) {
      applyPreset(
        activeRotation,
        tacticalPhase,
        scheme,
        defenseScheme
      );
    }
  };

  const handleDefenseSchemeChange=(scheme)=> {
    setDefenseScheme(scheme);
    setArrowPoints({attack: {},defense: {}});

    if (
      teamState==='systems' &&
      tacticalPhase==='serving'
    ) {
      applyPreset(
        activeRotation,
        tacticalPhase,
        receptionScheme,
        scheme
      );
    }
  };

  const handleRotationChange=(rotation)=> {
    setArrowPoints({attack: {},defense: {}});

    if (teamState==='systems') {
      applyPreset(rotation);
      return;
    }

    setPlayers(
      getNeutralRotation(rotation,freeServeEnabled)
    );
    setActiveRotation(rotation);
  };

  const handleFreeServeChange=(enabled)=> {
    setFreeServeEnabled(enabled);

    if (teamState==='libre') {
      setPlayers(getNeutralRotation(activeRotation,enabled));
      setArrowPoints({attack: {},defense: {}});
    }
  };

  const movePlayer=(id,x,y)=> {
    if (teamState!=='libre') return;

    setPlayers((current)=> current.map((player)=> (
      player.id===id ? {...player,x,y} : player
    )));
  };

  const moveArrowPoint=(type,playerId,point,x,y)=> {
    if (teamState!=='libre') return;

    setArrowPoints((current)=> ({
      ...current,
      [type]: {
        ...current[type],
        [playerId]: {
          ...current[type][playerId],
          ...(point==='tip'
            ? {toX: x,toY: y}
            : {controlX: x,controlY: y})
        }
      }
    }));
  };

  const toggleArrowFilter=(type)=> {
    if (type==='attack-only') {
      setArrowFilter({attack: true,defense: false});
      return;
    }

    if (type==='defense-only') {
      setArrowFilter({attack: false,defense: true});
      return;
    }

    setArrowFilter((current)=> ({
      ...current,
      [type]: !current[type]
    }));
  };

  const rotate=(direction)=> {
    const nextRotation=getNextRotation(
      activeRotation,
      direction
    );

    setArrowPoints({attack: {},defense: {}});

    if (teamState==='systems') {
      applyPreset(nextRotation);
      return;
    }

    setPlayers(
      getNeutralRotation(nextRotation,freeServeEnabled)
    );
    setActiveRotation(nextRotation);
  };

  const reset=()=> {
    setPlayers(
      getSystemRotation(
        'R1',
        'receiving',
        'standard',
        '3-1-2'
      )
    );
    setArrowPoints({attack: {},defense: {}});
    setArrowFilter({attack: true,defense: false});
    setTeamState('systems');
    setSystemType('5-1');
    setTacticalPhase('receiving');
    setActiveRotation('R1');
    setReceptionScheme('standard');
    setDefenseScheme('3-1-2');
    setFreeServeEnabled(false);
  };

  const showServeBall=teamState==='systems'
    ? tacticalPhase==='serving'
    : freeServeEnabled;

  const serverPlayerId=showServeBall
    ? players.find(
      (player)=> Number(player.rotationZone)===1
    )?.id
    : null;

  const validationGuidance=teamState==='libre'
    ? validation.guidance
    : [];

  const validationFaultPlayerIds=teamState==='libre'
    ? validation.faultPlayerIds
    : [];

  const controlProps={
    teamState,
    systemType,
    tacticalPhase,
    activeRotation,
    receptionScheme,
    defenseScheme,
    arrowFilter,
    freeServeEnabled,
    onStateChange: handleStateChange,
    onSystemChange: setSystemType,
    onPhaseChange: handlePhaseChange,
    onReceptionSchemeChange: handleReceptionSchemeChange,
    onDefenseSchemeChange: handleDefenseSchemeChange,
    onArrowFilterChange: toggleArrowFilter,
    onFreeServeChange: handleFreeServeChange,
    onRotationChange: handleRotationChange,
    onRotate: rotate,
    onReset: reset
  };

  return (
    <main>
      <header className="hero">
        <nav>
          <a
            className="brand"
            href="#top"
            aria-label="Rotación Vóley"
          >
            <img src={LOGO_URL} alt="" />
          </a>
          <span className="edition-badge">
            Reglas 2025–2028 · FCVB
          </span>
        </nav>

        <div className="hero-copy" id="top">
          <span className="eyebrow">Aprende haciendo</span>
          <h1>
            Domina cada rotación.
            <br />
            <em>Sin pisar la pista.</em>
          </h1>
          <p>
            Explora las formaciones y entiende visualmente cuándo
            existe una falta de posición o de rotación.
          </p>
        </div>
      </header>

      <section className="simulator">
        <div className="court-column">
          <Court
            players={players}
            guidance={validationGuidance}
            attackGuidance={attackGuidance}
            defenseGuidance={defenseGuidance}
            arrowFilter={arrowFilter}
            faultPlayerIds={validationFaultPlayerIds}
            serverPlayerId={serverPlayerId}
            onMovePlayer={movePlayer}
            onMoveArrowPoint={moveArrowPoint}
            editable={teamState==='libre'}
          />
        </div>

        <aside>
          {teamState==='libre' && (
            <ValidationCard result={validation} />
          )}
          <ControlPanel {...controlProps} />
        </aside>
      </section>

      <RulesPanel />

      <footer>
        <p>
          Herramienta educativa. Para decisiones oficiales, consulta
          siempre el reglamento FIVB vigente.
        </p>
      </footer>
    </main>
  );
}

export default App;