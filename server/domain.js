import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
export const MAX_TITLE_LENGTH = 100;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export function createParticipantToken() {
  return randomBytes(32).toString("base64url");
}

export function hashParticipantToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token, tokenHash) {
  if (!token || !tokenHash) return false;
  const actual = Buffer.from(hashParticipantToken(token), "hex");
  const expected = Buffer.from(tokenHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createInvitationCode() {
  return randomBytes(9).toString("base64url").toUpperCase();
}

export function normalizeGuess(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim()
    .replace(/\s+/g, " ");
}

export function createInitialGameState(round = 1) {
  return {
    challengeRole: 1,
    step: 0,
    round,
    title: null,
    challengeKey: null,
    imitationKey: null,
    revealed: false,
    guess: null,
    version: 0,
  };
}

export function createAudioKey(roomId, role, audioId = randomUUID()) {
  return `${roomId}/${role}/${audioId}.wav`;
}

export function isAudioKeyForRole(key, roomId, role) {
  return (
    typeof key === "string" &&
    key.startsWith(`${roomId}/${role}/`) &&
    key.endsWith(".wav") &&
    !key.includes("..")
  );
}

export function toRoomView(room, role) {
  const { state } = room;
  const isHost = role === 1;
  const challengeRole = state.challengeRole ?? 1;
  const canReveal = state.revealed || state.step === 3;
  const presenceCutoff = Date.now() - 12_000;

  return {
    roomId: room.id,
    role,
    status: room.player2_token_hash ? "active" : "waiting",
    participantsOnline: {
      player1:
        room.player1_last_seen &&
        new Date(room.player1_last_seen).getTime() >= presenceCutoff,
      player2:
        room.player2_last_seen &&
        new Date(room.player2_last_seen).getTime() >= presenceCutoff,
    },
    inviteCode: isHost ? room.invite_code : undefined,
    expiresAt: room.expires_at,
    step: state.step,
    round: state.round,
    challengeRole,
    title: role === challengeRole || canReveal ? state.title : null,
    revealed: canReveal,
    guess: state.guess,
    hasChallenge: Boolean(state.challengeKey),
    hasImitation: Boolean(state.imitationKey),
    version: state.version,
  };
}

export function assertActionAllowed(state, role, action) {
  const challengeRole = state.challengeRole ?? 1;
  switch (action.type) {
    case "choose-starter":
      if (role !== 1 || state.step !== 0 || ![1, 2].includes(action.role)) {
        throw new GameActionError("Solo el anfitrión puede elegir quién empieza antes de enviar el reto.", 409);
      }
      return { ...state, challengeRole: action.role, version: state.version + 1 };
    case "submit-challenge":
      if (role !== challengeRole || state.step !== 0) {
        throw new GameActionError(
          "No puedes enviar el reto en este turno.",
          409,
        );
      }
      if (
        typeof action.title !== "string" ||
        !action.title.trim() ||
        action.title.trim().length > MAX_TITLE_LENGTH
      ) {
        throw new GameActionError("Escribe un título válido.", 400);
      }
      if (!isAudioKeyForRole(action.audioKey, action.roomId, `player-${challengeRole}`)) {
        throw new GameActionError("La grabación del reto no es válida.", 400);
      }
      return {
        ...state,
        step: 1,
        title: action.title.trim(),
        challengeKey: action.audioKey,
        guess: null,
        version: state.version + 1,
      };

    case "submit-imitation":
      if (role === challengeRole || state.step !== 1) {
        throw new GameActionError(
          "Solo quien imita puede enviar la grabación en este turno.",
          409,
        );
      }
      if (!isAudioKeyForRole(action.audioKey, action.roomId, `player-${3 - challengeRole}`)) {
        throw new GameActionError(
          "La grabación de la imitación no es válida.",
          400,
        );
      }
      return {
        ...state,
        step: 2,
        imitationKey: action.audioKey,
        guess: null,
        version: state.version + 1,
      };

    case "guess": {
      if (state.step !== 2) {
        throw new GameActionError(
          "La ronda no está en la etapa de adivinanza.",
          409,
        );
      }
      if (
        typeof action.value !== "string" ||
        !action.value.trim() ||
        action.value.trim().length > MAX_TITLE_LENGTH
      ) {
        throw new GameActionError("Escribe una respuesta válida.", 400);
      }
      const correct =
        normalizeGuess(action.value) === normalizeGuess(state.title ?? "");
      return {
        ...state,
        step: correct ? 3 : 2,
        guess: { value: action.value.trim(), correct, role },
        version: state.version + 1,
      };
    }

    case "reveal-original":
      if (state.step < 2) {
        throw new GameActionError(
          "El original se puede revelar después de enviar la imitación.",
          409,
        );
      }
      return { ...state, revealed: true, version: state.version + 1 };

    case "new-round":
      if (role !== 1 || state.step !== 3) {
        throw new GameActionError(
          "Solo Jugador 1 puede iniciar otra ronda después de ganar.",
          409,
        );
      }
      return createInitialGameState(state.round + 1);

    default:
      throw new GameActionError("La acción solicitada no es válida.", 400);
  }
}

export class GameActionError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "GameActionError";
    this.statusCode = statusCode;
  }
}
