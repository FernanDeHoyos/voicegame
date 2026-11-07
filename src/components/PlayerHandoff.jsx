import React from "react";
import { ArrowRight, Smartphone } from "lucide-react";

export default function PlayerHandoff({ onContinue }) {
  return (
    <section className="game-card handoff-card">
      <div className="handoff-icon">
        <Smartphone size={24} />
      </div>
      <span className="pill">
        <span />
        CAMBIO DE TURNO
      </span>
      <h2>Pasa el teléfono al Jugador 2</h2>
      <p className="card-desc">
        Jugador 1: no muestres el título ni mires el siguiente reto. Entrega el
        teléfono para que Jugador 2 escuche e imite la voz.
      </p>
      <button className="primary handoff-button" onClick={onContinue}>
        Jugador 2, ya tengo el teléfono <ArrowRight size={17} />
      </button>
    </section>
  );
}
