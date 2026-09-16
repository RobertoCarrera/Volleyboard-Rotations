import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiCheckCircle, FiAlertCircle, FiInfo } = FiIcons;

function ValidationCard({ result, teamState }) {
  const messages = [
    ...(result.rotationFault
      ? [`Falta de rotación: debe sacar ${result.expectedServer.name}.`]
      : []),
    ...result.positionFaults
  ];

  return (
    <section className={`validation-card ${result.valid ? 'valid' : 'invalid'}`}>
      <div className="validation-title">
        <SafeIcon icon={result.valid ? FiCheckCircle : FiAlertCircle} />
        <div>
          <span>Validación en el golpe de saque</span>
          <strong>{result.valid ? 'Formación reglamentaria' : 'Infracción detectada'}</strong>
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
              {messages.map((message) => <li key={message}>{message}</li>)}
            </ul>
          ) : (
            <p>
              {teamState === 'serving'
                ? 'El equipo al saque no está sujeto a relaciones posicionales; se comprueba el orden de saque.'
                : 'Se cumplen las relaciones entre delanteros, zagueros y jugadores laterales.'}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="rule-note">
        <SafeIcon icon={FiInfo} />
        La posición se evalúa en el instante del golpe de saque. Después, los jugadores pueden desplazarse libremente.
      </div>
    </section>
  );
}

export default ValidationCard;