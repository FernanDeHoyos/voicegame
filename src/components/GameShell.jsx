import React from "react";
import { AudioLines, Headphones, HelpCircle, Mic } from "lucide-react";

export function GameHeader({ onHelp }) {
  return (
    <header>
      <a className="brand" href="./">
        <span className="brand-icon">
          <AudioLines size={24} />
        </span>
        voicegame<span className="beta">BETA</span>
      </a>
      <button className="help-link" onClick={onHelp}>
        <HelpCircle size={17} /> Cómo se juega
      </button>
    </header>
  );
}

export function GameIntro() {
  return (
    <div className="intro">
      <div className="eyebrow">
        <span /> UN JUEGO PARA ESCUCHAR DIFERENTE
      </div>
      <h1>
        Dale la vuelta.
        <br />
        Que empiece <span>el juego.</span>
      </h1>
      <p>
        Una película, una voz al revés y una imitación imposible.
        <br className="desktop" /> ¿Podrán adivinar lo que realmente estás
        diciendo?
      </p>
      <div className="intro-meta">
        <span>
          <Headphones size={15} /> 2 o más jugadores
        </span>
        <i />
        <span>
          <Mic size={15} /> Solo necesitas tu voz
        </span>
      </div>
    </div>
  );
}

export function GameFooterNote() {
  return (
    <div className="bottom-note">
      <span>↝</span> Las mejores partidas terminan en risas, no en respuestas
      correctas.
    </div>
  );
}

export function GameFooter() {
  return (
    <footer>
      <span>
        voicegame <span className="footer-dot">·</span> Hecho para sonar
        diferente.
      </span>
      <span>
        Sin descargas. Sin cuentas. Solo diversión. <AudioLines size={16} />
      </span>
    </footer>
  );
}
