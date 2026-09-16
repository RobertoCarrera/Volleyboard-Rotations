import React, { useMemo, useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from './common/SafeIcon';
import ControlPanel from './components/ControlPanel';
import Court from './components/Court';
import RulesPanel from './components/RulesPanel';
import ValidationCard from './components/ValidationCard';
import { getRotatedZone, INITIAL_PLAYERS, ZONES } from './data/volleyball';
import { validateFormation } from './utils/rotationValidator';
import './App.css';

const { FiMove, FiActivity } = FiIcons;

function App() {
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [teamState, setTeamState] = useState('receiving');
  const [serverId, setServerId] = useState(1);

  const validation = useMemo(
    () => validateFormation({ players, teamState, serverId, tolerance: 0.5 }),
    [players, teamState, serverId]
  );

  const movePlayer = (id, x, y) => {
    setPlayers((current) =>
      current.map((player) => player.id === id ? { ...player, x, y } : player)
    );
  };

  const rotate = (direction) => {
    const rotated = players.map((player) => {
      const zone = getRotatedZone(player.zone, direction);
      return { ...player, zone, x: ZONES[zone].x, y: ZONES[zone].y };
    });
    setPlayers(rotated);
    setServerId(rotated.find((player) => player.zone === 1).id);
  };

  const reset = () => {
    setPlayers(INITIAL_PLAYERS);
    setServerId(1);
    setTeamState('receiving');
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
          <h1>Domina cada rotación.<br /><em>Sin pisar la pista.</em></h1>
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
            serverId={serverId}
            players={players}
            onStateChange={setTeamState}
            onServerChange={setServerId}
            onRotate={rotate}
            onReset={reset}
          />
          <ValidationCard result={validation} teamState={teamState} />
        </aside>
      </section>

      <RulesPanel />

      <footer>
        <strong>RotaciónVóley</strong>
        <p>Herramienta educativa. Para decisiones oficiales, consulta siempre el reglamento FIVB vigente.</p>
      </footer>
    </main>
  );
}

export default App;