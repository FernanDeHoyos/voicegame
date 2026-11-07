import { useEffect, useRef, useState } from "react";
import { downloadReversedAudio, reverseAudioBuffer } from "../utils/audio.js";

export function useGameAudio(step) {
  const [original, setOriginal] = useState(null);
  const [imitation, setImitation] = useState(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState("");
  const [error, setError] = useState("");

  const audioContextRef = useRef();
  const recorderRef = useRef();
  const streamRef = useRef();
  const sourceRef = useRef();
  const timerRef = useRef();
  const limitRef = useRef();
  const mountedRef = useRef(true);
  const pendingRef = useRef(false);

  useEffect(
    () => () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
      clearTimeout(limitRef.current);
      if (recorderRef.current?.state === "recording")
        recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      sourceRef.current?.stop();
      audioContextRef.current?.close();
    },
    [],
  );

  async function getAudioContext() {
    audioContextRef.current ??= new (
      window.AudioContext || window.webkitAudioContext
    )();

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }

  function stopAudio() {
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try {
        sourceRef.current.stop();
      } catch {}
      sourceRef.current = null;
    }

    setPlaying("");
  }

  async function play(buffer, key, reverse = false) {
    if (playing === key) {
      stopAudio();
      return;
    }

    stopAudio();

    try {
      const context = await getAudioContext();
      const source = context.createBufferSource();

      source.buffer = reverse ? reverseAudioBuffer(context, buffer) : buffer;
      source.connect(context.destination);
      sourceRef.current = source;
      source.onended = () => {
        setPlaying("");
        sourceRef.current = null;
      };
      source.start();
      setPlaying(key);
    } catch {
      setError("No pudimos reproducir el audio. Inténtalo de nuevo.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      clearInterval(timerRef.current);
      clearTimeout(limitRef.current);
      setRecording(false);
      setBusy(true);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    }
  }

  async function record() {
    if (recording) {
      stopRecording();
      return;
    }

    if (pendingRef.current) return;

    pendingRef.current = true;
    setError("");
    stopAudio();
    setBusy(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error("unsupported");
      }

      await getAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorderRef.current = recorder;
      const targetStep = step;

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        try {
          const context = await getAudioContext();
          const buffer = await context.decodeAudioData(
            await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer(),
          );

          if (mountedRef.current) {
            if (targetStep === 0) setOriginal(buffer);
            else setImitation(buffer);
          }
        } catch {
          if (mountedRef.current) {
            setError(
              "La grabación quedó vacía o no se pudo leer. Vuelve a grabar.",
            );
          }
        } finally {
          if (mountedRef.current) setBusy(false);
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start();
      setSeconds(0);
      setRecording(true);
      setBusy(false);
      timerRef.current = setInterval(
        () => setSeconds((current) => current + 1),
        1000,
      );
      limitRef.current = setTimeout(stopRecording, 20000);
    } catch (cause) {
      const error = cause;
      setError(
        error.name === "NotAllowedError"
          ? "Necesitamos permiso para usar el micrófono. Actívalo en la barra de direcciones y vuelve a intentarlo."
          : error.name === "NotFoundError"
            ? "No se encontró un micrófono. Conecta uno y vuelve a intentarlo."
            : error.message === "unsupported"
              ? "Este navegador no permite grabar. Abre el juego en Chrome, Edge, Firefox o Safari mediante HTTPS."
              : "No pudimos acceder al micrófono. Comprueba que esté disponible.",
      );
      setBusy(false);
    } finally {
      pendingRef.current = false;
    }
  }

  function resetAudio() {
    stopAudio();
    setOriginal(null);
    setImitation(null);
    setSeconds(0);
    setError("");
  }

  function resetTimer() {
    setSeconds(0);
  }

  function downloadResult() {
    downloadReversedAudio(audioContextRef.current, imitation);
  }

  return {
    original,
    imitation,
    recording,
    busy,
    seconds,
    playing,
    error,
    setError,
    stopAudio,
    play,
    record,
    resetAudio,
    resetTimer,
    downloadResult,
  };
}
