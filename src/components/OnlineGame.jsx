import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  Clipboard,
  Link as LinkIcon,
  LogOut,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { useGameAudio } from "../hooks/useGameAudio.js";
import { reverseAudioBuffer } from "../utils/audio.js";
import {
  closeRoom,
  createRoom,
  getRoom,
  joinRoom,
  loadRoomAudio,
  performRoomAction,
  readInvitation,
  readStoredRoom,
  removeRoomSession,
  roomInvitationUrl,
  saveRoomSession,
  uploadRoomAudio,
} from "../services/onlineRooms.js";
import AudioPlayer from "./AudioPlayer.jsx";
import RecordingPanel from "./RecordingPanel.jsx";

const INVITATION_PATTERN = /(?:^#|&)room=([A-Za-z0-9_-]+)/;

function inviteCodeFromHash() {
  return (
    window.location.hash.match(INVITATION_PATTERN)?.[1]?.toUpperCase() ?? ""
  );
}

function updateInvitationHash(code) {
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}#room=${code}`,
  );
}

function updateRoomIfCurrent(setRoom, nextRoom) {
  setRoom((current) => {
    if (!current) return nextRoom;
    if (nextRoom.round > current.round) return nextRoom;
    if (nextRoom.round < current.round) return current;
    return nextRoom.version >= current.version ? nextRoom : current;
  });
}

function AudioLoadingStatus({ label, progress }) {
  const percent = progress?.percent;
  return (
    <div className="online-audio-loading" role="status" aria-live="polite">
      <RefreshCw size={15} className="online-loading-icon" />
      <span>{label}</span>
      {Number.isFinite(percent) && (
        <span className="online-loading-percent">{percent}%</span>
      )}
      <progress
        max="100"
        value={Number.isFinite(percent) ? percent : undefined}
        aria-label={label}
      />
    </div>
  );
}

export default function OnlineGame({ onExit }) {
  const [invitationInput, setInvitationInput] = useState("");
  const [invitationCode, setInvitationCode] = useState(inviteCodeFromHash);
  const [session, setSession] = useState(null);
  const [room, setRoom] = useState(null);
  const [screen, setScreen] = useState(
    inviteCodeFromHash() ? "connecting" : "lobby",
  );
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [slowPlayback, setSlowPlayback] = useState(false);
  const [guess, setGuess] = useState("");
  const [challengeAudio, setChallengeAudio] = useState(null);
  const [imitationAudio, setImitationAudio] = useState(null);
  const [originalAudio, setOriginalAudio] = useState(null);
  const [playing, setPlaying] = useState("");
  const [transfer, setTransfer] = useState(null);
  const [audioLoading, setAudioLoading] = useState({});

  const audio = useGameAudio(session?.role === 2 ? 1 : 0);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const loadedAudioRef = useRef({
    challenge: false,
    imitation: false,
    original: false,
  });

  useEffect(() => {
    const code = inviteCodeFromHash();
    if (!code) return;

    const saved = readStoredRoom(code);
    if (saved) {
      setSession(saved);
      setInvitationCode(code);
      setInvitationInput(code);
      getRoom(saved)
        .then((state) => {
          setRoom(state);
          setScreen("room");
        })
        .catch(async (loadError) => {
          if (loadError.message.includes("no está disponible")) {
            setError("Esta sala cerró o caducó. Crea una nueva partida.");
            setScreen("lobby");
            removeRoomSession(saved, code);
            return;
          }
          setError(loadError.message);
          setScreen("lobby");
        });
      return;
    }

    joinWithCode(code);
  }, []);

  useEffect(() => {
    if (!session || screen !== "room") return undefined;
    let active = true;
    let timer;

    async function poll() {
      try {
        const nextRoom = await getRoom(session);
        if (active) {
          updateRoomIfCurrent(setRoom, nextRoom);
          setError("");
        }
      } catch (pollError) {
        if (active) setError(pollError.message);
      } finally {
        if (active) timer = setTimeout(poll, 1200);
      }
    }

    timer = setTimeout(poll, 1200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [session, screen]);

  useEffect(() => {
    if (!session || !room || screen !== "room") return undefined;
    let active = true;

    async function loadAvailableAudio() {
      const context =
        audioContextRef.current ??
        (audioContextRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )());
      const tasks = [];

      const progressFor = (type) => (progress) =>
        setAudioLoading((current) => ({ ...current, [type]: progress }));
      const finishLoading = (type) =>
        setAudioLoading((current) => {
          const next = { ...current };
          delete next[type];
          return next;
        });

      if (room.step >= 1 && !loadedAudioRef.current.challenge) {
        loadedAudioRef.current.challenge = true;
        setAudioLoading((current) => ({
          ...current,
          challenge: { percent: null },
        }));
        tasks.push(
          loadRoomAudio(
            session,
            "challenge",
            context,
            progressFor("challenge"),
          )
            .then((buffer) => {
              if (active) setChallengeAudio(buffer);
            })
            .catch((loadError) => {
              loadedAudioRef.current.challenge = false;
              if (active) setError(loadError.message);
            })
            .finally(() => {
              if (active) finishLoading("challenge");
            }),
        );
      }
      if (room.step >= 2 && !loadedAudioRef.current.imitation) {
        loadedAudioRef.current.imitation = true;
        setAudioLoading((current) => ({
          ...current,
          imitation: { percent: null },
        }));
        tasks.push(
          loadRoomAudio(
            session,
            "imitation",
            context,
            progressFor("imitation"),
          )
            .then((buffer) => {
              if (active) setImitationAudio(buffer);
            })
            .catch((loadError) => {
              loadedAudioRef.current.imitation = false;
              if (active) setError(loadError.message);
            })
            .finally(() => {
              if (active) finishLoading("imitation");
            }),
        );
      }
      if (room.revealed && !loadedAudioRef.current.original) {
        loadedAudioRef.current.original = true;
        setAudioLoading((current) => ({
          ...current,
          original: { percent: null },
        }));
        tasks.push(
          loadRoomAudio(session, "original", context, progressFor("original"))
            .then((buffer) => {
              if (active) setOriginalAudio(buffer);
            })
            .catch((loadError) => {
              loadedAudioRef.current.original = false;
              if (active) setError(loadError.message);
            })
            .finally(() => {
              if (active) finishLoading("original");
            }),
        );
      }
      await Promise.all(tasks);
    }

    loadAvailableAudio().catch((loadError) => {
      if (active) setError(loadError.message);
    });
    return () => {
      active = false;
    };
  }, [session, room?.step, room?.revealed, originalAudio, screen]);

  useEffect(() => {
    loadedAudioRef.current = {
      challenge: false,
      imitation: false,
      original: false,
    };
    setChallengeAudio(null);
    setImitationAudio(null);
    setOriginalAudio(null);
    setAudioLoading({});
  }, [room?.round]);

  useEffect(
    () => () => {
      sourceRef.current?.stop();
      audioContextRef.current?.close();
    },
    [],
  );

  async function connectToRoom(response, code) {
    const saved = {
      roomId: response.roomId,
      role: response.role,
      participantToken: response.participantToken,
    };
    saveRoomSession(code, saved);
    updateInvitationHash(code);
    setInvitationCode(code);
    setSession(saved);
    setRoom(response.room);
    setError("");
    setNotice("");
    setScreen("room");
  }

  async function joinWithCode(code) {
    if (!code) {
      setError(
        "Escribe un código de invitación o abre el enlace que te compartieron.",
      );
      return;
    }
    setWorking(true);
    setError("");
    try {
      const response = await joinRoom(code);
      await connectToRoom(response, code);
    } catch (joinError) {
      setError(joinError.message);
      setScreen("lobby");
    } finally {
      setWorking(false);
    }
  }

  async function createOnlineRoom() {
    setWorking(true);
    setError("");
    try {
      const response = await createRoom();
      await connectToRoom(response, response.invitationCode);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setWorking(false);
    }
  }

  async function sendAction(action) {
    if (!session || !room || working) return null;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const nextRoom = await performRoomAction(session, {
        ...action,
        expectedVersion: room.version,
      });
      updateRoomIfCurrent(setRoom, nextRoom);
      if (action.type === "guess") {
        setGuess("");
        setNotice(
          nextRoom.step === 3
            ? "¡Respuesta correcta! ¡Lo adivinaron!"
            : "No es esa película. Todavía pueden intentar.",
        );
      }
      return nextRoom;
    } catch (actionError) {
      setError(actionError.message);
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function submitRecording() {
    const buffer = session?.role === 1 ? audio.original : audio.imitation;
    if (!buffer || working) return;

    setWorking(true);
    setError("");
    setNotice("");
    setTransfer({ phase: "preparing", percent: null });
    try {
      const audioType = session.role === 1 ? "challenge" : "imitation";
      const audioKey = await uploadRoomAudio(
        session,
        audioType,
        buffer,
        setTransfer,
      );
      setTransfer({ phase: "confirming", percent: null });
      const action =
        session.role === 1
          ? { type: "submit-challenge", title, audioKey }
          : { type: "submit-imitation", audioKey };
      const nextRoom = await performRoomAction(session, {
        ...action,
        expectedVersion: room.version,
      });
      updateRoomIfCurrent(setRoom, nextRoom);
      setNotice("Audio enviado a la sala.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setWorking(false);
      setTransfer(null);
    }
  }

  async function revealOriginal() {
    if (
      !window.confirm(
        "Este audio dice el título de la película. ¿Revelarlo ahora?",
      )
    ) {
      return;
    }
    await sendAction({ type: "reveal-original" });
  }

  async function playBuffer(buffer, key, reverse = false, rate = 1) {
    if (!buffer) {
      setError("El audio todavía no está listo. Espera a que termine de cargar.");
      return;
    }
    if (playing === key) {
      sourceRef.current?.stop();
      sourceRef.current = null;
      setPlaying("");
      return;
    }

    sourceRef.current?.stop();
    try {
      const context =
        audioContextRef.current ??
        (audioContextRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )());
      if (context.state !== "running") await context.resume();
      if (context.state !== "running") {
        throw new Error("El audio del dispositivo está bloqueado.");
      }
      const source = context.createBufferSource();
      source.buffer = reverse ? reverseAudioBuffer(context, buffer) : buffer;
      source.playbackRate.value = rate;
      source.connect(context.destination);
      source.onended = () => {
        sourceRef.current = null;
        setPlaying("");
      };
      source.onerror = () => {
        sourceRef.current = null;
        setPlaying("");
        setError("El dispositivo no pudo reproducir este audio.");
      };
      sourceRef.current = source;
      source.start();
      setPlaying(key);
    } catch (playError) {
      setError(
        playError.message ||
          "No pudimos reproducir este audio. Inténtalo de nuevo.",
      );
    }
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(roomInvitationUrl(invitationCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice("Copia el enlace del campo de invitación.");
    }
  }

  async function endRoom() {
    if (
      !window.confirm(
        "¿Cerrar la sala y borrar sus audios y datos? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    setWorking(true);
    try {
      await closeRoom(session);
      removeRoomSession(session, invitationCode);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      setSession(null);
      setRoom(null);
      setScreen("closed");
      setNotice("La sala y sus audios se eliminaron.");
    } catch (closeError) {
      setError(closeError.message);
    } finally {
      setWorking(false);
    }
  }

  function exitOnlineMode() {
    audio.stopAudio();
    onExit();
  }

  const isMyTurn =
    (room?.step === 0 && session?.role === 1) ||
    (room?.step === 1 && session?.role === 2);
  const challengeCanSubmit =
    session?.role === 1 &&
    room?.status === "active" &&
    room?.step === 0 &&
    title.trim() &&
    audio.original;
  const imitationCanSubmit =
    session?.role === 2 && room?.step === 1 && audio.imitation;

  if (screen === "connecting") {
    return (
      <section className="game-card online-card" aria-live="polite">
        <p>Conectando con la sala…</p>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
      </section>
    );
  }

  if (screen === "closed") {
    return (
      <section className="game-card online-card">
        <h2>Sala cerrada</h2>
        <p>Los datos de la partida ya no están disponibles.</p>
        <button className="primary" onClick={exitOnlineMode}>
          Volver al juego local
        </button>
      </section>
    );
  }

  if (!session || screen === "lobby") {
    return (
      <section className="game-card online-card">
        <div className="card-top">
          <span className="pill">
            <span />
            MODO EN LÍNEA · DESARROLLO
          </span>
          <button
            className="online-back"
            type="button"
            onClick={exitOnlineMode}
          >
            <LogOut size={15} /> Modo local
          </button>
        </div>
        <h2>Jueguen desde dos dispositivos</h2>
        <p className="card-desc">
          Crea una sala y comparte la invitación. No necesitan una cuenta.
        </p>
        <button
          className="primary online-create"
          disabled={working}
          onClick={createOnlineRoom}
        >
          {working ? "Creando sala…" : "Crear sala en línea"}
        </button>
        <div className="online-divider">
          <span>o únete con una invitación</span>
        </div>
        <label className="field-label" htmlFor="room-invitation">
          CÓDIGO O ENLACE DE SALA
        </label>
        <div className="guess-row">
          <input
            id="room-invitation"
            value={invitationInput}
            onChange={(event) => setInvitationInput(event.target.value)}
            placeholder="Pega aquí el código o enlace"
          />
          <button
            disabled={working || !readInvitation(invitationInput)}
            onClick={() => joinWithCode(readInvitation(invitationInput))}
          >
            {working ? "Uniendo…" : "Unirme"}
          </button>
        </div>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="game-card online-card">
      <div className="card-top">
        <span className="pill">
          <span />
          {session.role === 1
            ? "JUGADOR 1 · ANFITRIÓN"
            : "JUGADOR 2 · INVITADO"}
        </span>
        <button className="online-back" type="button" onClick={exitOnlineMode}>
          <LogOut size={15} /> Salir
        </button>
      </div>

      {session.role === 1 && room && (
        <div className="online-invitation">
          <div className="online-invitation-title">
            <LinkIcon size={16} /> INVITACIÓN PRIVADA
          </div>
          <div className="online-share-row">
            <input
              readOnly
              value={roomInvitationUrl(invitationCode)}
              aria-label="Enlace de invitación"
            />
            <button
              type="button"
              onClick={copyInvitation}
              aria-label="Copiar invitación"
            >
              {copied ? <Check size={17} /> : <Clipboard size={17} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p>
            Compártela solo con el otro jugador. La sala caduca tras 24 horas
            sin actividad.
          </p>
        </div>
      )}

      <div className="online-status" aria-live="polite">
        <span
          className={
            room?.participantsOnline?.player1 &&
            room?.participantsOnline?.player2
              ? "online-dot connected"
              : "online-dot"
          }
        />
        {room?.participantsOnline?.player1 && room?.participantsOnline?.player2
          ? "Ambos jugadores conectados"
          : room?.status === "active"
            ? "Jugador 2 ya se unió; esperando conexión"
            : "Esperando a Jugador 2"}
        <button
          type="button"
          aria-label="Actualizar sala"
          onClick={() =>
            getRoom(session)
              .then((nextRoom) => updateRoomIfCurrent(setRoom, nextRoom))
              .catch((e) => setError(e.message))
          }
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {room?.step === 0 && session.role === 1 && (
        <>
          <h2>Prepara el reto</h2>
          <label className="field-label" htmlFor="online-title">
            TÍTULO SECRETO
          </label>
          <input
            id="online-title"
            className="online-title-input"
            value={title}
            maxLength={100}
            disabled={working}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Escribe el nombre de la película"
          />
          <RecordingPanel
            step={0}
            original={audio.original}
            imitation={audio.imitation}
            recording={audio.recording}
            busy={audio.busy}
            seconds={audio.seconds}
            playing={audio.playing}
            onRecord={audio.record}
            onPlay={audio.play}
          />
          <button
            className="primary online-submit"
            disabled={
              !challengeCanSubmit || working || audio.recording || audio.busy
            }
            onClick={submitRecording}
          >
            {working ? "Enviando audio…" : "Enviar reto a Jugador 2"}
          </button>
          {transfer && (
            <AudioLoadingStatus
              label={
                transfer.phase === "preparing"
                  ? "Preparando audio…"
                  : transfer.phase === "uploading"
                    ? "Subiendo audio…"
                    : "Confirmando audio…"
              }
              progress={transfer}
            />
          )}
        </>
      )}

      {room?.step === 0 && session.role === 2 && (
        <div className="online-wait">
          <h2>Esperando el reto</h2>
          <p>Jugador 1 está preparando el título y grabando el audio.</p>
        </div>
      )}

      {room?.step === 1 && session.role === 1 && (
        <div className="online-wait">
          <h2>Turno de Jugador 2</h2>
          <p>
            El reto está enviado. Espera a que Jugador 2 escuche e imite el
            audio.
          </p>
        </div>
      )}

      {room?.step === 1 && session.role === 2 && (
        <>
          <h2>Escucha e imita el reto</h2>
          <p className="card-desc">
            Este audio está invertido y no revela el título al reproducirlo.
          </p>
          {challengeAudio ? (
            <div className="listen-box">
              <AudioPlayer
                buffer={challengeAudio}
                audioKey="online-challenge"
                isPlaying={playing === "online-challenge"}
                onPlay={playBuffer}
                reverse
                playbackRate={slowPlayback ? 0.85 : 1}
                onToggleSpeed={() => setSlowPlayback((value) => !value)}
                label="Reproducir reto invertido"
              />
            </div>
          ) : (
            <AudioLoadingStatus
              label="Cargando audio del reto…"
              progress={audioLoading.challenge}
            />
          )}
          <RecordingPanel
            step={1}
            original={audio.original}
            imitation={audio.imitation}
            recording={audio.recording}
            busy={audio.busy}
            seconds={audio.seconds}
            playing={audio.playing}
            onRecord={audio.record}
            onPlay={audio.play}
          />
          <button
            className="primary online-submit"
            disabled={
              !imitationCanSubmit || working || audio.recording || audio.busy
            }
            onClick={submitRecording}
          >
            {working ? "Enviando audio…" : "Enviar imitación"}
          </button>
          {transfer && (
            <AudioLoadingStatus
              label={
                transfer.phase === "preparing"
                  ? "Preparando audio…"
                  : transfer.phase === "uploading"
                    ? "Subiendo audio…"
                    : "Confirmando audio…"
              }
              progress={transfer}
            />
          )}
        </>
      )}

      {room?.step === 2 && (
        <>
          <h2>Adivinen la película</h2>
          <p className="card-desc">
            Comparen las grabaciones. El original de Jugador 1 contiene la
            respuesta.
          </p>
          {imitationAudio ? (
            <div className="listen-box">
              <h3 className="audio-guide-title">Imitación de Jugador 2</h3>
              <AudioPlayer
                buffer={imitationAudio}
                audioKey="online-imitation-reversed"
                isPlaying={playing === "online-imitation-reversed"}
                onPlay={playBuffer}
                reverse
                playbackRate={slowPlayback ? 0.85 : 1}
                onToggleSpeed={() => setSlowPlayback((value) => !value)}
                label="Reproducir imitación invertida"
              />
              <AudioPlayer
                buffer={imitationAudio}
                audioKey="online-imitation-normal"
                isPlaying={playing === "online-imitation-normal"}
                onPlay={playBuffer}
                label="Reproducir imitación sin invertir"
              />
            </div>
          ) : (
            <AudioLoadingStatus
              label="Cargando imitación…"
              progress={audioLoading.imitation}
            />
          )}
          <div className="guess">
            <label className="field-label" htmlFor="online-guess">
              ¿CUÁL ES LA PELÍCULA?
            </label>
            <div className="guess-row">
              <input
                id="online-guess"
                value={guess}
                maxLength={100}
                onChange={(event) => setGuess(event.target.value)}
                placeholder="Escribe tu respuesta"
              />
              <button
                disabled={!guess.trim() || working}
                onClick={() =>
                  sendAction({ type: "guess", value: guess.trim() })
                }
              >
                Comprobar
              </button>
            </div>
            {room.guess && (
              <p className={room.guess.correct ? "success" : "try"}>
                {room.guess.correct
                  ? "¡Respuesta correcta!"
                  : "Esa respuesta no coincide. Prueben otra vez."}
              </p>
            )}
          </div>
          <div className="online-original-warning">
            <ShieldAlert size={18} />
            <div>
              <strong>Original de Jugador 1 · contiene la respuesta</strong>
              <p>Reprodúzcanlo solo después de intentar adivinar.</p>
            </div>
            {!room.revealed && (
              <button type="button" disabled={working} onClick={revealOriginal}>
                Revelar
              </button>
            )}
          </div>
          {room.revealed && originalAudio && (
            <AudioPlayer
              buffer={originalAudio}
              audioKey="online-original"
              isPlaying={playing === "online-original"}
              onPlay={playBuffer}
              label="Original de Jugador 1 (contiene la respuesta)"
            />
          )}
          {room.revealed && !originalAudio && audioLoading.original && (
            <AudioLoadingStatus
              label="Cargando audio original…"
              progress={audioLoading.original}
            />
          )}
        </>
      )}

      {room?.step === 3 && (
        <div className="online-victory">
          <span aria-hidden="true">🏆</span>
          <h2>¡Lo adivinaron!</h2>
          <p>
            La película era <strong>{room.title}</strong>.
          </p>
          {session.role === 1 && (
            <button
              className="primary"
              disabled={working}
              onClick={() => sendAction({ type: "new-round" })}
            >
              Preparar otra ronda
            </button>
          )}
          {session.role === 2 && (
            <p>Jugador 1 puede iniciar la siguiente ronda.</p>
          )}
        </div>
      )}

      {room?.status === "active" && (
        <button
          className="online-close"
          type="button"
          disabled={working}
          onClick={endRoom}
        >
          <X size={15} /> Cerrar sala y borrar datos
        </button>
      )}
      {!isMyTurn && room?.step < 2 && room?.status === "active" && (
        <p className="online-turn-note" aria-live="polite">
          La partida se sincroniza automáticamente entre dispositivos.
        </p>
      )}
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {notice && (
        <div className="online-notice" role="status">
          {notice}
        </div>
      )}
      {audio.error && (
        <div role="alert" className="error">
          {audio.error}
        </div>
      )}
    </section>
  );
}
