import React from "react";
import { Mic, Square } from "lucide-react";
import AudioPlayer from "./AudioPlayer.jsx";

export default function RecordingPanel({
  step,
  original,
  imitation,
  recording,
  busy,
  seconds,
  playing,
  onRecord,
  onPlay,
}) {
  const currentRecording = step === 0 ? original : imitation;
  const bars = Array.from(
    { length: 65 },
    (_, index) =>
      12 + Math.abs(Math.sin(index * 2.3) * Math.cos(index * 0.38)) * 56,
  );

  return (
    <>
      <div className={"recorder " + (recording ? "is-recording" : "")}>
        <div className="recorder-top">
          <span>{step === 0 ? "GRABA EL TÍTULO" : "GRABA TU IMITACIÓN"}</span>
          <span>
            {recording ? (
              <>
                <b className="red-dot" /> GRABANDO
              </>
            ) : (
              "MÁX. 20 SEGUNDOS"
            )}
          </span>
        </div>
        <div className={"waveform " + (recording ? "moving" : "")}>
          {bars.map((height, index) => (
            <span
              key={index}
              style={{
                height,
                animationDelay: `${index * 0.035}s`,
              }}
            />
          ))}
        </div>
        <div className="time">
          00:{String(seconds).padStart(2, "0")} <span>/ 00:20</span>
        </div>
        <button
          className={"record-button " + (recording ? "stop" : "")}
          disabled={busy}
          onClick={onRecord}
        >
          {recording ? (
            <Square size={18} fill="currentColor" />
          ) : (
            <Mic size={20} />
          )}{" "}
          {busy
            ? "Preparando audio…"
            : recording
              ? "Detener grabación"
              : currentRecording
                ? "Volver a grabar"
                : "Empezar a grabar"}
        </button>
        <p>
          {recording
            ? "Habla cerca del micrófono. ¡Hazlo tuyo!"
            : step === 0
              ? "Di el nombre con claridad y un poco de drama."
              : "Imita los sonidos, aunque no tengan ningún sentido."}
        </p>
      </div>
      {currentRecording && (
        <AudioPlayer
          buffer={currentRecording}
          audioKey="preview"
          isPlaying={playing === "preview"}
          onPlay={onPlay}
          label="Escuchar mi grabación"
        />
      )}
    </>
  );
}
