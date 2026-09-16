import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiCheckCircle, FiAlertCircle, FiInfo } = FiIcons;

function ValidationCard({ result, teamState, systemType }) {
  const messages = [
    ...(result.rotationFault
      ? [`Falta de rotación: debe sacar ${result.expectedServer.name}.`]
      : []),
    ...result.positionFaults
  ];

  const isFree = teamState === 'libre';

  return (
    <section className={`validation-card ${result.valid ? 'valid' : 'invalid'}`}>
      <div className="validation-title">
        <SafeIcon icon={result.valid ? FiCheckCircle : FiAlertCircle} />
        <div>
          <span>
            {isFree ? 'Validación del modo libre' : `Validación del sistema ${systemType}`}
          </span>
          <strong>
            {isFree
              ? 'Juego libre activo'
              : result.valid
                ? 'Sistema reglamentario'
                : 'Revisión necesaria'}
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
          {isFree ? (
            <p>
              En este modo los jugadores pueden desplazarse libremente. No se
              señalan faltas de posición ni de saque.
            </p>
          ) : messages.length > 0 ? (
            <ul>
              {messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : (
            <p>
              Se respeta el orden de rotación y las relaciones entre
              delanteros, zagueros y jugadores laterales.
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="rule-note">
        <SafeIcon icon={FiInfo} />
        {isFree
          ? 'El modo libre sirve para mover y explorar la pista sin validaciones.'
          : 'El líbero puede sustituir a jugadores zagueros, pero no puede bloquear ni atacar por encima de la red.'}
      </div>
    </section>
  );
}

export default ValidationCard;