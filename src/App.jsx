import React, { useMemo, useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from './common/SafeIcon';
import ControlPanel from './components/ControlPanel';
import Court from './components/Court';
import RulesPanel from './components/RulesPanel';
import ValidationCard from './components/ValidationCard';
import {
  createNeutralPlayers,
  getRotatedZone,
  TACTICAL_PRESETS,
  updatePlayerAtZone,
  ZONES
} from './data/volleyball';
import { validateFormation } from './utils/rotationValidator';
import './App.css';

const { FiMove, FiActivity } = FiIcons;

function App() {
  const [players, setPlayers] = useState(createNeutralPlayers);
  const [teamState, setTeamState] = useState('libre');
  const [systemType, setSystemType] = useState('5-1');
  const [tacticalPhase, setTacticalPhase] = useState('receiving');
  const [activeRotation, setActiveRotation] = useState('R1');

  const validation = useMemo(
    () => validateFormation({
      players,
      teamState,
      tolerance: 0.5
    }),
    [players, teamState]
  );

  const applyPreset = (rotation, phase = tacticalPhase) => {
    const preset = TACTICAL_PRESETS[rotation];

    setPlayers((current) => current.map((player) => {
      const rolePreset = preset[player.id];
      const position = rolePreset[phase];

      return updatePlayerAtZone(player, rolePreset.zone, position);
    }));

    setActiveRotation(rotation);
  };

  const handleStateChange = (state) => {
    setTeamState(state);

    if (state === 'systems') {
      applyPreset(activeRotation, tacticalPhase);
    } else {
      setPlayers(createNeutralPlayers());
    }
  };

  const handlePhaseChange = (phase) => {
    setTacticalPhase(phase);

    if (teamState === 'systems') {
      applyPreset(activeRotation, phase);
    }
  };

  const handleRotationChange = (rotation) => {
    applyPreset(rotation);
  };

  const movePlayer = (id, x, y) => {
    setPlayers((current) => current.map((player) => (
      player.id === id
        ? { ...player, x, y }
        : player
    )));
  };

  const rotate = (direction) => {
    if (teamState === 'systems') {
      const currentNumber = Number(activeRotation.replace('R', ''));
      const nextNumber = direction === 'forward'
        ? currentNumber === 6 ? 1 : currentNumber + 1
        : currentNumber === 1 ? 6 : currentNumber - 1;

      applyPreset(`R${nextNumber}`);
      return;
    }

    setPlayers((current) => current.map((player) => {
      const zone = getRotatedZone(player.zone, direction);

      return updatePlayerAtZone(player, zone, ZONES[zone]);
    }));
  };

  const reset = () => {
    setPlayers(createNeutralPlayers());
    setTeamState('libre');
    setSystemType('5-1');
    setTacticalPhase('receiving');
    setActiveRotation('R1');
  };

  return (
    <main>
      <header className="hero">
        <nav>
          <a className="brand" href="#top">
            <span><SafeIcon icon={FiActivity} /></span>
            Rotación<span>Vóley</span>
          </a>
          <span className="edition-badge">Reglas 2025–2028</span>
        </nav>

        <div className="hero-copy" id="top">
          <span className="eyebrow">Aprende haciendo</span>
          <h1>
            Domina cada rotación.
            <br />
            <em>Sin pisar la pista.</em>
          </h1>
          <p>
            Mueve a los jugadores, prueba formaciones y entiende visualmente
            cuándo existe una falta de posición o de rotación.
          </p>
          <div className="drag-tip">
            <SafeIcon icon={FiMove} />
            Arrastra cualquier jugador para comprobar la formación
          </div>
        </div>
      </header>

      <section className="simulator">
        <div className="court-column">
          <Court players={players} onMovePlayer={movePlayer} />
        </div>

        <aside>
          <ControlPanel
            teamState={teamState}
            systemType={systemType}
            tacticalPhase={tacticalPhase}
            activeRotation={activeRotation}
            onStateChange={handleStateChange}
            onSystemChange={setSystemType}
            onPhaseChange={handlePhaseChange}
            onRotationChange={handleRotationChange}
            onRotate={rotate}
            onReset={reset}
          />
          <ValidationCard
            result={validation}
            teamState={teamState}
            systemType={systemType}
          />
        </aside>
      </section>

      <RulesPanel />

      <footer>
        <strong>RotaciónVóley</strong>
        <p>
          Herramienta educativa. Para decisiones oficiales, consulta siempre el
          reglamento FIVB vigente.
        </p>
      </footer>
    </main>
  );
}

export default App;