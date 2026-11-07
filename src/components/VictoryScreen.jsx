import React from "react";
import { RotateCcw, Sparkles, Trophy } from "lucide-react";

export default function VictoryScreen({ title, round, onPlayAgain }) {
  return (
    <section className="game-card victory-card" aria-live="polite">
      <div className="victory-sparkle sparkle-one">
        <Sparkles size={20} />
      </div>
      <div className="victory-sparkle sparkle-two">
        <Sparkles size={15} />
      </div>
      <div className="victory-icon">
        <Trophy size={36} />
      </div>
      <span className="pill victory-pill">
        <span />
        RONDA {String(round).padStart(2, "0")} · RESPUESTA CORRECTA
      </span>
      <h2>¡Lo adivinaron!</h2>
      <p className="card-desc">Jugador 2 descifró la pista. La película era:</p>
      <div className="victory-answer">
        <Sparkles size={18} />
        <strong>{title || "La película de la grabación original"}</strong>
        <Sparkles size={18} />
      </div>
      <button className="primary victory-button" onClick={onPlayAgain}>
        <RotateCcw size={16} /> Jugar otra ronda
      </button>
    </section>
  );
}
