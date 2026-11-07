import { Check } from "lucide-react";
import { GAME_STEPS } from "../data/game.js";

export default function GameProgress({ step }) {
  return (
    <aside className="journey">
      <div className="journey-label">TU PRÓXIMO GRAN RETO</div>
      {GAME_STEPS.map(([title, description], index) => (
        <div
          className={
            "step " +
            (step === index ? "current" : step > index ? "complete" : "")
          }
          key={title}
        >
          <div className="step-number">
            {step > index ? (
              <Check size={18} />
            ) : (
              String(index + 1).padStart(2, "0")
            )}
          </div>
          <div>
            <strong>{title}</strong>
            <p>{description}</p>
          </div>
        </div>
      ))}
      <div className="tip">
        <span>✦</span>
        <p>
          Cuanto peor imites,
          <br />
          <strong>mejor se pone.</strong>
        </p>
      </div>
    </aside>
  );
}
