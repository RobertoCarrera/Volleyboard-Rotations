import React from 'react';
import {AnimatePresence,motion} from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const {
  FiCheckCircle,
  FiAlertCircle,
  FiInfo
}=FiIcons;

function ValidationCard({result}) {
  const messages=result.positionFaults;

  return (
    <section
      className={`validation-card ${result.valid ? 'valid' : 'invalid'}`}
    >
      <div className="validation-title">
        <SafeIcon
          icon={result.valid ? FiCheckCircle : FiAlertCircle}
        />
        <div>
          <span>Validación del modo libre</span>
          <strong>
            {result.valid
              ? 'Posición reglamentaria'
              : 'Falta de posición'}
          </strong>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={messages.join('-') || 'valid'}
          initial={{opacity: 0,y: 5}}
          animate={{opacity: 1,y: 0}}
          exit={{opacity: 0}}
          className="validation-message"
        >
          {messages.length > 0 ? (
            <ul>
              {messages.map((message)=> (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : (
            <p>
              Todos los jugadores respetan las relaciones de posición.
              Puedes seguir moviéndolos libremente.
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="rule-note">
        <SafeIcon icon={FiInfo} />
        En Libre no se aplica ninguna formación táctica: los jugadores
        parten de sus zonas neutrales y puedes comprobar las faltas al
        moverlos.
      </div>
    </section>
  );
}

export default ValidationCard;