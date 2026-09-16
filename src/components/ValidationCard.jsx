import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiCheckCircle, FiAlertCircle, FiInfo } = FiIcons;

function ValidationCard({ result, teamState, systemType }) {
  const messages = result.positionFaults;
  const isFree = teamState === 'libre';

  return (
    <section className={`validation-card ${result.valid ? 'valid' : 'invalid'}`}>
      <div className="validation-title">
        <SafeIcon icon={result.valid ? FiCheckCircle : FiAlertCircle} />
        <div>
          <span>
            {isFree
              ? 'Validación del modo libre'
              : `Validación del sistema ${systemType}`}
          </span>
          <strong>
            {result.valid ? 'Posición reglamentaria' : 'Falta de posición'}
          </strong>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={messages.join('-') || teamState}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="validation-message"
        >
          {messages.length > 0 ? (
            <ul>
              {messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : (
            <p>
              {isFree
                ? 'Todos los jugadores respetan las relaciones de posición. Puedes seguir moviéndolos libremente.'
                : 'Se respeta el orden de rotación y la sustitución reglamentaria entre centrales y líbero.'}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="rule-note">
        <SafeIcon icon={FiInfo} />
        {isFree
          ? 'En Libre no se aplica ninguna formación táctica: los jugadores parten de sus zonas neutrales y puedes comprobar las faltas al moverlos.'
          : 'El líbero nunca sube a zona delantera. Cuando llega a Z4, pasa a ser central; el central que llega a Z1 pasa a ser líbero.'}
      </div>
    </section>
  );
}

export default ValidationCard;