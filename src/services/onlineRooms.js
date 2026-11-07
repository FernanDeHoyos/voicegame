import { createWavBlob } from "../utils/audio.js";

const API_BASE =
  import.meta.env.VITE_ROOM_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8787/api";
const SESSION_PREFIX = "voicegame:online-room:";
const INVITATION_PREFIX = "voicegame:online-invitation:";

async function request(path, { token, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("No pudimos conectar con la sala. Revisa tu conexión.");
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("El servicio de salas devolvió una respuesta inválida.");
  }

  if (!response.ok) {
    throw new Error(body?.error || "No se pudo completar la acción en línea.");
  }
  return body;
}

export function readInvitation(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const match = url.hash.match(/(?:^#|&)room=([A-Za-z0-9_-]+)/);
    if (match) return match[1].toUpperCase();
    const queryCode = url.searchParams.get("room");
    if (queryCode) return queryCode.trim().toUpperCase();
  } catch {
    return trimmed.replace(/[^A-Za-z0-9_-]/g, "").toUpperCase();
  }
  return trimmed.replace(/[^A-Za-z0-9_-]/g, "").toUpperCase();
}

export function readStoredRoom(invitationCode) {
  try {
    const stored = localStorage.getItem(
      `${INVITATION_PREFIX}${invitationCode}`,
    );
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveRoomSession(invitationCode, session) {
  const serialized = JSON.stringify(session);
  localStorage.setItem(`${SESSION_PREFIX}${session.roomId}`, serialized);
  localStorage.setItem(`${INVITATION_PREFIX}${invitationCode}`, serialized);
}

export function removeRoomSession(session, invitationCode) {
  localStorage.removeItem(`${SESSION_PREFIX}${session.roomId}`);
  localStorage.removeItem(`${INVITATION_PREFIX}${invitationCode}`);
}

export function roomInvitationUrl(invitationCode) {
  return `${window.location.origin}${window.location.pathname}#room=${invitationCode}`;
}

export function createRoom() {
  return request("/rooms", { method: "POST" });
}

export function joinRoom(invitationCode) {
  return request("/rooms/join", {
    method: "POST",
    body: JSON.stringify({ invitationCode }),
  });
}

export function getRoom(session) {
  return request(`/rooms/${encodeURIComponent(session.roomId)}`, {
    token: session.participantToken,
  });
}

export function performRoomAction(session, action) {
  return request(`/rooms/${encodeURIComponent(session.roomId)}/actions`, {
    method: "POST",
    token: session.participantToken,
    body: JSON.stringify(action),
  });
}

export function closeRoom(session) {
  return request(`/rooms/${encodeURIComponent(session.roomId)}/close`, {
    method: "POST",
    token: session.participantToken,
  });
}

export async function uploadRoomAudio(session, audioType, buffer) {
  const blob = createWavBlob(buffer);
  const prepared = await request(
    `/rooms/${encodeURIComponent(session.roomId)}/uploads`,
    {
      method: "POST",
      token: session.participantToken,
      body: JSON.stringify({ audioType, contentLength: blob.size }),
    },
  );

  let response;
  try {
    response = await fetch(prepared.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": prepared.contentType },
      body: blob,
    });
  } catch {
    throw new Error(
      "No se pudo subir el audio. Revisa tu conexión e inténtalo otra vez.",
    );
  }

  if (!response.ok) {
    throw new Error(
      "El almacenamiento rechazó el audio. Puedes intentar enviarlo otra vez.",
    );
  }
  return prepared.audioKey;
}

export async function loadRoomAudio(session, audioType, audioContext) {
  const { downloadUrl } = await request(
    `/rooms/${encodeURIComponent(session.roomId)}/audio/${audioType}`,
    { token: session.participantToken },
  );
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error("No se pudo descargar el audio de la sala.");
  }
  return audioContext.decodeAudioData(await response.arrayBuffer());
}
