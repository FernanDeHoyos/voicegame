import { useState } from "react";
import "./style.css";
import GameCard from "./components/GameCard.jsx";
import GameProgress from "./components/GameProgress.jsx";
import HelpModal from "./components/HelpModal.jsx";
import {
  GameFooter,
  GameFooterNote,
  GameHeader,
  GameIntro,
} from "./components/GameShell.jsx";
import { useGameAudio } from "./hooks/useGameAudio.js";
import { createRoot } from "react-dom/client";

function App() {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [hidden, setHidden] = useState(false);
  const [help, setHelp] = useState(false);
  const [round, setRound] = useState(1);
  const audio = useGameAudio(step);

  function next() {
    audio.stopAudio();
    audio.setError("");
    setStep((current) => current + 1);
    setHidden(true);
  }

  function back() {
    audio.stopAudio();
    setStep(0);
    setHidden(false);
    audio.resetTimer();
  }

  function reset() {
    audio.resetAudio();
    setStep(0);
    setTitle("");
    setHidden(false);
    setRound((current) => current + 1);
  }

  return (
    <>
      <GameHeader onHelp={() => setHelp(true)} />
      <main>
        <GameIntro />
        <div className="game-layout">
          <GameProgress step={step} />
          <GameCard
            step={step}
            title={title}
            setTitle={setTitle}
            hidden={hidden}
            setHidden={setHidden}
            round={round}
            original={audio.original}
            imitation={audio.imitation}
            recording={audio.recording}
            busy={audio.busy}
            seconds={audio.seconds}
            playing={audio.playing}
            error={audio.error}
            onPlay={audio.play}
            onRecord={audio.record}
            onDownload={audio.downloadResult}
            onNext={next}
            onBack={back}
            onReset={reset}
          />
        </div>
        <GameFooterNote />
      </main>
      <GameFooter />
      {help && <HelpModal onClose={() => setHelp(false)} />}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
