import React from "react";
import { Pause, Play } from "lucide-react";

export default function AudioPlayer({
  buffer,
  audioKey,
  isPlaying,
  onPlay,
  label,
  reverse = false,
  playbackRate = 1,
  onToggleSpeed,
}) {
  return (
    <div className="audio-controls">
      <button
        className={"audio-button " + (isPlaying ? "active" : "")}
        onClick={() => onPlay(buffer, audioKey, reverse, playbackRate)}
      >
        {isPlaying ? <Pause size={17} /> : <Play size={17} />}
        <span>{label}</span>
        <span className="duration">{buffer.duration.toFixed(1)} s</span>
      </button>
      {reverse && (
        <button
          className={"audio-speed " + (playbackRate < 1 ? "active" : "")}
          type="button"
          aria-pressed={playbackRate < 1}
          aria-label={
            playbackRate < 1
              ? "Restablecer velocidad normal"
              : "Activar velocidad reducida"
          }
          onClick={onToggleSpeed}
        >
          {playbackRate < 1 ? "0,85× · Lento" : "1× · Normal"}
        </button>
      )}
    </div>
  );
}
