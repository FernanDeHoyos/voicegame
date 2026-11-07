import { Pause, Play } from "lucide-react";

export default function AudioPlayer({
  buffer,
  audioKey,
  isPlaying,
  onPlay,
  label,
  reverse = false,
}) {
  return (
    <button
      className={"audio-button " + (isPlaying ? "active" : "")}
      onClick={() => onPlay(buffer, audioKey, reverse)}
    >
      {isPlaying ? <Pause size={17} /> : <Play size={17} />}
      <span>{label}</span>
      <span className="duration">{buffer.duration.toFixed(1)} s</span>
    </button>
  );
}
