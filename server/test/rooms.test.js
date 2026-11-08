import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { newDb, DataType } from "pg-mem";
import { createApp } from "../app.js";
import { createAudioKey } from "../domain.js";

let pool;
let server;
let baseUrl;
const uploadedAudio = new Set();
const deletedRooms = [];

const storage = {
  async createUploadUrl(key) {
    uploadedAudio.add(key);
    return `https://storage.example/${encodeURIComponent(key)}?upload=1`;
  },
  async createDownloadUrl(key) {
    return `https://storage.example/${encodeURIComponent(key)}?download=1`;
  },
  async verifyAudio(key) {
    assert.ok(
      uploadedAudio.has(key),
      "submitted audio must have an upload URL",
    );
  },
  async deleteAudio(key) {
    uploadedAudio.delete(key);
  },
  async deleteRoomAudio(roomId) {
    deletedRooms.push(roomId);
    for (const key of uploadedAudio) {
      if (key.startsWith(`${roomId}/`)) uploadedAudio.delete(key);
    }
  },
};

async function request(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body) headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

async function createJoinedRoom() {
  const createResponse = await request("/api/rooms", { method: "POST" });
  assert.equal(createResponse.status, 201);
  const host = await createResponse.json();
  const joinResponse = await request("/api/rooms/join", {
    method: "POST",
    body: JSON.stringify({ invitationCode: host.invitationCode }),
  });
  assert.equal(joinResponse.status, 200);
  return { host, guest: await joinResponse.json() };
}

async function submitAction(room, role, action) {
  return request(`/api/rooms/${room.roomId}/actions`, {
    method: "POST",
    token: role.participantToken,
    body: JSON.stringify(action),
  });
}

beforeEach(async () => {
  uploadedAudio.clear();
  deletedRooms.length = 0;
  const database = newDb();
  database.public.registerFunction({
    name: "now",
    returns: DataType.timestamptz,
    implementation: () => new Date(),
  });
  const adapter = database.adapters.createPg();
  pool = new adapter.Pool();
  await pool.query(
    await readFile(new URL("../schema.sql", import.meta.url), "utf8"),
  );

  const app = createApp({ pool, storage });
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await pool.end();
});

test("creates private two-player rooms and runs an online round", async () => {
  const { host, guest } = await createJoinedRoom();
  assert.equal(host.room.role, 1);
  assert.equal(guest.role, 2);

  const thirdJoin = await request("/api/rooms/join", {
    method: "POST",
    body: JSON.stringify({ invitationCode: host.invitationCode }),
  });
  assert.equal(thirdJoin.status, 409);

  const guestStateResponse = await request(`/api/rooms/${host.roomId}`, {
    token: guest.participantToken,
  });
  const guestState = await guestStateResponse.json();
  assert.equal(guestState.title, null);
  assert.equal(guestState.inviteCode, undefined);

  const challengeKey = createAudioKey(host.roomId, "player-1", "challenge.wav");
  const uploadResponse = await request(`/api/rooms/${host.roomId}/uploads`, {
    method: "POST",
    token: host.participantToken,
    body: JSON.stringify({ audioType: "challenge", contentLength: 1024 }),
  });
  assert.equal(uploadResponse.status, 200);
  uploadedAudio.add(challengeKey);

  const challengeResponse = await submitAction(host, host, {
    type: "submit-challenge",
    title: "El rey león",
    audioKey: challengeKey,
    expectedVersion: 0,
  });
  assert.equal(challengeResponse.status, 200);
  assert.equal((await challengeResponse.json()).step, 1);

  const hiddenOriginal = await request(
    `/api/rooms/${host.roomId}/audio/original`,
    {
      token: guest.participantToken,
    },
  );
  assert.equal(hiddenOriginal.status, 403);
  const challengeAudio = await request(
    `/api/rooms/${host.roomId}/audio/challenge`,
    { token: guest.participantToken },
  );
  assert.equal(challengeAudio.status, 200);

  const imitationKey = createAudioKey(host.roomId, "player-2", "imitation.wav");
  uploadedAudio.add(imitationKey);
  const imitationResponse = await submitAction(guest, guest, {
    type: "submit-imitation",
    audioKey: imitationKey,
    expectedVersion: 1,
  });
  assert.equal(imitationResponse.status, 200);

  const wrongGuess = await submitAction(host, host, {
    type: "guess",
    value: "Titanic",
    expectedVersion: 2,
  });
  assert.equal(wrongGuess.status, 200);
  assert.equal((await wrongGuess.json()).step, 2);

  const winningGuess = await submitAction(guest, guest, {
    type: "guess",
    value: "EL REY LEON",
    expectedVersion: 3,
  });
  assert.equal(winningGuess.status, 200);
  const finalState = await winningGuess.json();
  assert.equal(finalState.step, 3);
  assert.equal(finalState.title, "El rey león");
});

test("rejects unauthorized actions and deletes room audio on close", async () => {
  const { host, guest } = await createJoinedRoom();
  const forbidden = await submitAction(guest, guest, {
    type: "submit-challenge",
    title: "Secreto",
    audioKey: createAudioKey(host.roomId, "player-1", "challenge.wav"),
    expectedVersion: 0,
  });
  assert.equal(forbidden.status, 409);

  const closeResponse = await request(`/api/rooms/${host.roomId}/close`, {
    method: "POST",
    token: host.participantToken,
  });
  assert.equal(closeResponse.status, 200);
  assert.ok(deletedRooms.includes(host.roomId));

  const afterClose = await request(`/api/rooms/${host.roomId}`, {
    token: host.participantToken,
  });
  assert.equal(afterClose.status, 410);
});


test("guest can start while host imitates, with permissions preserved", async () => {
  const { host, guest } = await createJoinedRoom();
  const choose = (actor, role, version) => submitAction(host, actor, {
    type: "choose-starter", role, expectedVersion: version,
  });
  assert.equal((await choose(guest, 2, 0)).status, 409);
  const chosen = await choose(host, 2, 0);
  assert.equal(chosen.status, 200);
  assert.equal((await chosen.json()).challengeRole, 2);
  assert.equal((await choose(host, 1, 0)).status, 409);
  const upload = async (actor, audioType) => request(`/api/rooms/${host.roomId}/uploads`, {
    method: "POST", token: actor.participantToken,
    body: JSON.stringify({ audioType, contentLength: 1024 }),
  });
  assert.equal((await upload(host, "challenge")).status, 409);
  const challenge = await upload(guest, "challenge");
  assert.equal(challenge.status, 200);
  const { audioKey } = await challenge.json();
  const submitted = await submitAction(host, guest, {
    type: "submit-challenge", title: "Titanic", audioKey, expectedVersion: 1,
  });
  assert.equal(submitted.status, 200);
  const recovered = await request(`/api/rooms/${host.roomId}`, { token: host.participantToken });
  const state = await recovered.json();
  assert.equal(state.challengeRole, 2);
  assert.equal(state.title, null);
  assert.equal((await request(`/api/rooms/${host.roomId}/audio/original`, { token: host.participantToken })).status, 403);
  assert.equal((await choose(host, 1, 2)).status, 409);
  assert.equal((await upload(guest, "imitation")).status, 409);
  const imitation = await upload(host, "imitation");
  assert.equal(imitation.status, 200);
  const imitated = await submitAction(host, host, {
    type: "submit-imitation", audioKey: (await imitation.json()).audioKey, expectedVersion: 2,
  });
  assert.equal(imitated.status, 200);
  assert.equal((await submitAction(host, host, {
    type: "guess", value: "Titanic", expectedVersion: 3,
  })).status, 200);
  const next = await submitAction(host, host, { type: "new-round", expectedVersion: 4 });
  assert.equal(next.status, 200);
  assert.equal((await next.json()).round, 2);
  assert.equal((await choose(host, 2, 0)).status, 200);
});
