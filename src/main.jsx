import React, { useState } from "react";
import "./style.css";
import GameCard from "./components/GameCard.jsx";
import GameProgress from "./components/GameProgress.jsx";
import HelpModal from "./components/HelpModal.jsx";
import PlayerHandoff from "./components/PlayerHandoff.jsx";
import VictoryScreen from "./components/VictoryScreen.jsx";
import OnlineGame from "./components/OnlineGame.jsx";
import {
  GameFooter,
  GameFooterNote,
  GameHeader,
  GameIntro,
} from "./components/GameShell.jsx";
import { useGameAudio } from "./hooks/useGameAudio.js";
import { createRoot } from "react-dom/client";

function App() {
  const [onlineMode, setOnlineMode] = useState(() =>
    window.location.hash.includes("room="),
  );
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [hidden, setHidden] = useState(false);
  const [help, setHelp] = useState(false);
  const [handoffToPlayer2, setHandoffToPlayer2] = useState(false);
  const [round, setRound] = useState(1);
  const audio = useGameAudio(step);

  function next() {
    audio.stopAudio();
    audio.setError("");
    if (step === 0) {
      audio.resetTimer();
      setStep(1);
      setHidden(true);
      setHandoffToPlayer2(true);
      return;
    }
    setStep(2);
  }

  function reset() {
    audio.resetAudio();
    setStep(0);
    setTitle("");
    setHidden(false);
    setHandoffToPlayer2(false);
    setRound((current) => current + 1);
  }

  return (
    <>
      <GameHeader onHelp={() => setHelp(true)} />
      <main>
        <GameIntro />
        <div className={`game-layout${onlineMode ? " online-layout" : ""}`}>
          {onlineMode ? (
            <OnlineGame onExit={() => setOnlineMode(false)} />
          ) : (
            <>
              <button
                className="online-mode-button"
                type="button"
                onClick={() => setOnlineMode(true)}
              >
                Jugar en línea desde dos dispositivos
              </button>
              <GameProgress step={step} />
              {step === 3 ? (
                <VictoryScreen
                  title={title}
                  round={round}
                  onPlayAgain={reset}
                />
              ) : handoffToPlayer2 ? (
                <PlayerHandoff onContinue={() => setHandoffToPlayer2(false)} />
              ) : (
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
                  onReset={reset}
                  onWin={() => {
                    audio.stopAudio();
                    setStep(3);
                  }}
                />
              )}
            </>
          )}
        </div>
        <GameFooterNote />
      </main>
      <GameFooter />
      {help && <HelpModal onClose={() => setHelp(false)} />}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
