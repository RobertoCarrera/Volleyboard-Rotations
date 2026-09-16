import React,{useMemo,useState} from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from './common/SafeIcon';
import ControlPanel from './components/ControlPanel';
import Court from './components/Court';
import RulesPanel from './components/RulesPanel';
import ValidationCard from './components/ValidationCard';
import {createNeutralPlayers,getRotatedZone,getTacticalPreset,updatePlayerAtZone,ZONES} from './data/volleyball';
import {getAttackGuidance,getDefenseGuidance} from './data/tacticalGuidance';
import {validateFormation} from './utils/rotationValidator';
import './App.css';

const {FiMove,FiActivity}=FiIcons;

const getRotationNumber=(rotation)=>Number(rotation.replace('R',''));

const getNeutralRotation=(rotation)=>{
  const steps=getRotationNumber(rotation)-1;

  return createNeutralPlayers().map((player)=>{
    let zone=player.zone;

    for(let step=0;step<steps;step+=1){
      zone=getRotatedZone(zone,'forward');
    }

    return updatePlayerAtZone(player,zone,ZONES[zone],zone);
  });
};

function App(){
  const [players,setPlayers]=useState(createNeutralPlayers);
  const [teamState,setTeamState]=useState('libre');
  const [systemType,setSystemType]=useState('5-1');
  const [tacticalPhase,setTacticalPhase]=useState('receiving');
  const [activeRotation,setActiveRotation]=useState('R1');
  const [receptionScheme,setReceptionScheme]=useState('standard');
  const [defenseScheme,setDefenseScheme]=useState('3-1-2');
  const [arrowFilter,setArrowFilter]=useState({attack:false,defense:false});
  const [arrowPoints,setArrowPoints]=useState({attack:{},defense:{}});

  const validation=useMemo(
    ()=>validateFormation({players,teamState,tolerance:0.5}),
    [players,teamState]
  );

  const attackGuidance=useMemo(
    ()=>getAttackGuidance(players,teamState,tacticalPhase,activeRotation,arrowPoints.attack),
    [players,teamState,tacticalPhase,activeRotation,arrowPoints.attack]
  );

  const defenseGuidance=useMemo(
    ()=>getDefenseGuidance(players,teamState,tacticalPhase,activeRotation,arrowPoints.defense),
    [players,teamState,tacticalPhase,activeRotation,arrowPoints.defense]
  );

  const applyPreset=(
    rotation,
    phase=tacticalPhase,
    reception=receptionScheme,
    defense=defenseScheme
  )=>{
    const preset=getTacticalPreset(rotation,reception,defense);

    setPlayers((current)=>current.map((player)=>{
      const rolePreset=preset[player.id];
      const zone=phase==='postServe' ? rolePreset.postServeZone : rolePreset.zone;
      const position=rolePreset[phase];

      return updatePlayerAtZone(player,zone,position,rolePreset.zone);
    }));

    setActiveRotation(rotation);
  };

  const handleStateChange=(state)=>{
    setTeamState(state);

    if(state==='systems'){
      applyPreset(activeRotation);
      return;
    }

    setPlayers(getNeutralRotation(activeRotation));
  };

  const handlePhaseChange=(phase)=>{
    setTacticalPhase(phase);
    setArrowPoints({attack:{},defense:{}});

    if(teamState==='systems'){
      applyPreset(activeRotation,phase);
    }
  };

  const handleReceptionSchemeChange=(scheme)=>{
    setReceptionScheme(scheme);
    setArrowPoints({attack:{},defense:{}});

    if(teamState==='systems'&&tacticalPhase==='receiving'){
      applyPreset(activeRotation,tacticalPhase,scheme,defenseScheme);
    }
  };

  const handleDefenseSchemeChange=(scheme)=>{
    setDefenseScheme(scheme);
    setArrowPoints({attack:{},defense:{}});

    if(teamState==='systems'&&tacticalPhase==='serving'){
      applyPreset(activeRotation,tacticalPhase,receptionScheme,scheme);
    }
  };

  const handleRotationChange=(rotation)=>{
    setArrowPoints({attack:{},defense:{}});

    if(teamState==='systems'){
      applyPreset(rotation);
      return;
    }

    setPlayers(getNeutralRotation(rotation));
    setActiveRotation(rotation);
  };

  const movePlayer=(id,x,y)=>{
    setPlayers((current)=>current.map((player)=>(
      player.id===id ? {...player,x,y} : player
    )));
  };

  const moveArrowPoint=(type,playerId,point,x,y)=>{
    setArrowPoints((current)=>({
      ...current,
      [type]:{
        ...current[type],
        [playerId]:{
          ...current[type][playerId],
          ...(point==='tip'
            ? {toX:x,toY:y}
            : {controlX:x,controlY:y})
        }
      }
    }));
  };

  const toggleArrowFilter=(type)=>{
    setArrowFilter((current)=>({...current,[type]:!current[type]}));
  };

  const rotate=(direction)=>{
    if(teamState==='systems'){
      const currentNumber=getRotationNumber(activeRotation);
      const nextNumber=direction==='forward'
        ? currentNumber===6 ? 1 : currentNumber+1
        : currentNumber===1 ? 6 : currentNumber-1;

      setArrowPoints({attack:{},defense:{}});
      applyPreset(`R${nextNumber}`);
      return;
    }

    setPlayers((current)=>current.map((player)=>{
      const zone=getRotatedZone(player.zone,direction);
      const rotationZone=getRotatedZone(player.rotationZone,direction);

      return updatePlayerAtZone(player,zone,ZONES[zone],rotationZone);
    }));

    setActiveRotation((current)=>{
      const currentNumber=getRotationNumber(current);
      const nextNumber=direction==='forward'
        ? currentNumber===6 ? 1 : currentNumber+1
        : currentNumber===1 ? 6 : currentNumber-1;

      return `R${nextNumber}`;
    });
  };

  const reset=()=>{
    setPlayers(createNeutralPlayers());
    setArrowPoints({attack:{},defense:{}});
    setArrowFilter({attack:false,defense:false});
    setTeamState('libre');
    setSystemType('5-1');
    setTacticalPhase('receiving');
    setActiveRotation('R1');
    setReceptionScheme('standard');
    setDefenseScheme('3-1-2');
  };

  return(
    <main>
      <header className="hero">
        <nav>
          <a className="brand" href="#top">
            <span><SafeIcon icon={FiActivity}/></span>
            Rotación<span>Vóley</span>
          </a>
          <span className="edition-badge">Reglas 2025–2028 · FCVB</span>
        </nav>

        <div className="hero-copy" id="top">
          <span className="eyebrow">Aprende haciendo</span>
          <h1>Domina cada rotación.<br/><em>Sin pisar la pista.</em></h1>
          <p>Mueve a los jugadores,prueba formaciones y entiende visualmente cuándo existe una falta de posición o de rotación.</p>
          <div className="drag-tip">
            <SafeIcon icon={FiMove}/>
            Arrastra jugadores y puntos de las flechas para editar ataque y defensa
          </div>
        </div>
      </header>

      <section className="simulator">
        <div className="court-column">
          <Court
            players={players}
            guidance={validation.guidance}
            attackGuidance={attackGuidance}
            defenseGuidance={defenseGuidance}
            arrowFilter={arrowFilter}
            faultPlayerIds={validation.faultPlayerIds}
            onMovePlayer={movePlayer}
            onMoveArrowPoint={moveArrowPoint}
          />
        </div>

        <aside>
          <ControlPanel
            teamState={teamState}
            systemType={systemType}
            tacticalPhase={tacticalPhase}
            activeRotation={activeRotation}
            receptionScheme={receptionScheme}
            defenseScheme={defenseScheme}
            arrowFilter={arrowFilter}
            onStateChange={handleStateChange}
            onSystemChange={setSystemType}
            onPhaseChange={handlePhaseChange}
            onReceptionSchemeChange={handleReceptionSchemeChange}
            onDefenseSchemeChange={handleDefenseSchemeChange}
            onArrowFilterChange={toggleArrowFilter}
            onRotationChange={handleRotationChange}
            onRotate={rotate}
            onReset={reset}
          />
          <ValidationCard result={validation} teamState={teamState} systemType={systemType}/>
        </aside>
      </section>

      <RulesPanel/>

      <footer>
        <strong>RotaciónVóley</strong>
        <p>Herramienta educativa. Para decisiones oficiales,consulta siempre el reglamento FIVB vigente.</p>
      </footer>
    </main>
  );
}

export default App;