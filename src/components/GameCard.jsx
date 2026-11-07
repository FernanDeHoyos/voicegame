import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Eye,
  EyeOff,
  Film,
  RotateCcw,
  Shuffle,
  Trophy,
} from "lucide-react";
import { MOVIES } from "../data/game.js";
import { titlesMatch } from "../utils/game.js";
import AudioPlayer from "./AudioPlayer.jsx";
import RecordingPanel from "./RecordingPanel.jsx";

function ResultPanel({
  title,
  original,
  imitation,
  playing,
  onPlay,
  onDownload,
}) {
  const [guess, setGuess] = useState("");
  const [judged, setJudged] = useState(null);
  const [revealed, setRevealed] = useState(false);

  function checkGuess() {
    setJudged(titlesMatch(guess, title));
    setRevealed(true);
  }

  return (
    <>
      <div className="listen-box result">
        <div className="mini-label">TU IMITACIÓN · AHORA EN REVERSA</div>
        <AudioPlayer
          buffer={imitation}
          audioKey="result"
          isPlaying={playing === "result"}
          onPlay={onPlay}
          reverse
          label="Escuchar el resultado"
        />
        <div className="comparison">
          <AudioPlayer
            buffer={original}
            audioKey="original"
            isPlaying={playing === "original"}
            onPlay={onPlay}
            label="Comparar con el original"
          />
        </div>
      </div>
      <div className="guess">
        <label className="field-label" htmlFor="guess">
          ¿CUÁL ES LA PELÍCULA?
        </label>
        <div className="guess-row">
          <input
            id="guess"
            placeholder="Escribe tu respuesta…"
            value={guess}
            onChange={(event) => {
              setGuess(event.target.value);
              setJudged(null);
            }}
          />
          <button disabled={!guess.trim()} onClick={checkGuess}>
            Comprobar <ArrowRight size={17} />
          </button>
        </div>
        {judged !== null && (
          <p className={judged ? "success" : "try"}>
            {judged
              ? "¡Exacto! Tienen un oído de película."
              : "¡Casi! Pueden comparar con la grabación original."}
          </p>
        )}
        <button className="reveal" onClick={() => setRevealed(!revealed)}>
          {revealed ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
          {revealed ? "Ocultar película" : "Revelar película"}
        </button>
        {revealed && (
          <div className="answer">
            <Trophy size={22} />
            <strong>
              {title || "El título está en la grabación original"}
            </strong>
          </div>
        )}
      </div>
      <button className="download" onClick={onDownload}>
        <Download size={16} /> Descargar resultado (.wav)
      </button>
    </>
  );
}

export default function GameCard({
  step,
  title,
  setTitle,
  hidden,
  setHidden,
  round,
  original,
  imitation,
  recording,
  busy,
  seconds,
  playing,
  error,
  onPlay,
  onRecord,
  onNext,
  onBack,
  onReset,
  onDownload,
}) {
  const titleText =
    step === 0
      ? "Todo empieza con una película."
      : step === 1
        ? "¿Puedes imitar esta voz?"
        : "Suena raro. ¿Te suena de algo?";
  const description =
    step === 0
      ? "Piensa en un título. Que tu compañero no lo vea."
      : step === 1
        ? "Pasa el dispositivo. Escucha el reto e imita lo que oyes."
        : "Tu imitación, al revés. Escuchen e intenten adivinar.";
  const currentRecording = step === 0 ? original : imitation;

  return (
    <section className="game-card">
      <div className="card-top">
        <span className="pill">
          <span />
          {step === 0
            ? "EL DIRECTOR"
            : step === 1
              ? "EL IMITADOR"
              : "EL GRAN ESTRENO"}
        </span>
        <span className="round">RONDA {String(round).padStart(2, "0")}</span>
      </div>
      <h2>{titleText}</h2>
      <p className="card-desc">{description}</p>

      {step === 0 ? (
        <>
          <label className="field-label" htmlFor="movie">
            EL TÍTULO SECRETO <span>Solo para tus ojos</span>
          </label>
          <div className="input-wrap">
            <Film size={18} />
            <input
              id="movie"
              type={hidden ? "password" : "text"}
              value={title}
              placeholder="Ej. El rey león"
              maxLength={100}
              onChange={(event) => setTitle(event.target.value)}
            />
            <button
              onClick={() => setHidden(!hidden)}
              aria-label={hidden ? "Mostrar título" : "Ocultar título"}
            >
              {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button
            className="shuffle"
            onClick={() =>
              setTitle(MOVIES[Math.floor(Math.random() * MOVIES.length)])
            }
          >
            <Shuffle size={14} /> Sorpréndeme con una película
          </button>
        </>
      ) : step === 1 ? (
        <div className="listen-box">
          <div className="mini-label">EL RETO · AUDIO ORIGINAL EN REVERSA</div>
          <AudioPlayer
            buffer={original}
            audioKey="reverse"
            isPlaying={playing === "reverse"}
            onPlay={onPlay}
            reverse
            label="Escuchar el audio invertido"
          />
          <p>Puedes escucharlo tantas veces como quieras.</p>
        </div>
      ) : (
        <ResultPanel
          title={title}
          original={original}
          imitation={imitation}
          playing={playing}
          onPlay={onPlay}
          onDownload={onDownload}
        />
      )}

      {step < 2 && (
        <RecordingPanel
          step={step}
          original={original}
          imitation={imitation}
          recording={recording}
          busy={busy}
          seconds={seconds}
          playing={playing}
          onRecord={onRecord}
          onPlay={onPlay}
        />
      )}

      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}

      <div className="card-footer">
        <span>
          <span className="privacy-dot" />{" "}
          {step === 2
            ? "Una buena imitación merece otra ronda."
            : "Tu audio se queda en este dispositivo"}
        </span>
        {step < 2 ? (
          <button
            className="primary"
            disabled={
              recording ||
              busy ||
              !currentRecording ||
              (step === 0 && !title.trim())
            }
            onClick={onNext}
          >
            {step === 0 ? "Preparar el reto" : "Descubrir película"}
            <ArrowRight size={17} />
          </button>
        ) : (
          <button className="primary" onClick={onReset}>
            <RotateCcw size={16} /> Otra ronda
          </button>
        )}
      </div>

      {step === 0 && original && !title.trim() && (
        <p className="hint">Escribe el título secreto para continuar.</p>
      )}
      {step === 1 && (
        <button className="back" disabled={recording || busy} onClick={onBack}>
          <ArrowLeft size={14} /> Volver al título
        </button>
      )}
    </section>
  );
}
