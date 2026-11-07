import React from "react";
import { ArrowRight, AudioLines, X } from "lucide-react";

export default function HelpModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="close" aria-label="Cerrar" onClick={onClose}>
          <X />
        </button>
        <div className="brand-icon">
          <AudioLines />
        </div>
        <h2 id="help-title">Tres pasos. Muchas risas.</h2>
        <ol>
          <li>
            <strong>Prepara el reto.</strong> Escribe una película y graba su
            nombre, sin que el otro jugador lo escuche.
          </li>
          <li>
            <strong>Escucha e imita.</strong> Pásale el dispositivo. Que escuche
            la voz invertida y grabe su mejor imitación.
          </li>
          <li>
            <strong>Adivina.</strong> Invertimos esa imitación. Escuchen el
            resultado, también pueden oír la imitación tal como se grabó y
            compararla con el original. Si hace falta, activen la reproducción
            lenta al 85 %.
          </li>
        </ol>
        <p>
          Jueguen en el mismo dispositivo, por turnos. Usa audífonos para
          mantener el título en secreto. El audio se procesa localmente y se
          borra al recargar.
        </p>
        <button className="primary" onClick={onClose}>
          ¡Vamos a jugar! <ArrowRight size={17} />
        </button>
      </section>
    </div>
  );
}
