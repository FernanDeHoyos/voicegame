import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import {
  assertActionAllowed,
  createAudioKey,
  createInitialGameState,
  createInvitationCode,
  createParticipantToken,
  GameActionError,
  hashParticipantToken,
  isAudioKeyForRole,
  MAX_AUDIO_BYTES,
  MAX_TITLE_LENGTH,
  ROOM_TTL_MS,
  tokenMatches,
  toRoomView,
} from "./domain.js";

const joinSchema = z.object({
  invitationCode: z.string().trim().min(8).max(32),
});

const uploadSchema = z.object({
  audioType: z.enum(["challenge", "imitation"]),
  contentLength: z.number().int().positive().max(MAX_AUDIO_BYTES),
});

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("submit-challenge"),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    audioKey: z.string().min(1).max(200),
    expectedVersion: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("submit-imitation"),
    audioKey: z.string().min(1).max(200),
    expectedVersion: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("guess"),
    value: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    expectedVersion: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("reveal-original"),
    expectedVersion: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("new-round"),
    expectedVersion: z.number().int().nonnegative(),
  }),
]);

function unauthorizedResponse(res) {
  return res.status(401).json({ error: "No tienes acceso a esta sala." });
}

async function findActiveRoom(pool, roomId) {
  const result = await pool.query(
    `SELECT id, invite_code, player1_token_hash, player2_token_hash,
            state, status, player1_last_seen, player2_last_seen, expires_at
       FROM rooms
      WHERE id = $1 AND status = 'active' AND expires_at > NOW()`,
    [roomId],
  );
  return result.rows[0] ?? null;
}

function getRole(room, token) {
  if (tokenMatches(token, room.player1_token_hash)) return 1;
  if (tokenMatches(token, room.player2_token_hash)) return 2;
  return null;
}

export function createApp({
  pool,
  storage,
  allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"],
  roomTtlMs = ROOM_TTL_MS,
}) {
  if (!pool || !storage) {
    throw new Error("createApp requiere una base de datos y almacenamiento.");
  }

  const app = express();
  const originSet = new Set(allowedOrigins);
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || originSet.has(origin));
      },
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"],
    }),
  );
  app.use(express.json({ limit: "32kb" }));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 900,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  const joinLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(503).json({ status: "unavailable" });
    }
  });

  const api = express.Router();
  api.use(apiLimiter);

  api.post("/rooms", async (_req, res) => {
    const now = new Date();
    const roomId = randomUUID();
    const invitationCode = createInvitationCode();
    const participantToken = createParticipantToken();
    const expiresAt = new Date(now.getTime() + roomTtlMs);
    const state = createInitialGameState();

    try {
      await pool.query(
        `INSERT INTO rooms
           (id, invite_code, player1_token_hash, state, status,
            player1_last_seen, created_at, last_activity, expires_at)
         VALUES ($1, $2, $3, $4::jsonb, 'active', $5, $5, $5, $6)`,
        [
          roomId,
          invitationCode,
          hashParticipantToken(participantToken),
          JSON.stringify(state),
          now,
          expiresAt,
        ],
      );
      res.status(201).json({
        roomId,
        role: 1,
        invitationCode,
        participantToken,
        room: {
          roomId,
          role: 1,
          status: "waiting",
          inviteCode: invitationCode,
          expiresAt,
          participantsOnline: { player1: true, player2: false },
          ...state,
        },
      });
    } catch (error) {
      console.error("Room creation failed:", error);
      res
        .status(503)
        .json({ error: "No se pudo crear la sala. Inténtalo de nuevo." });
    }
  });

  api.post("/rooms/join", joinLimiter, async (req, res) => {
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "El código de invitación no es válido." });
    }

    const code = parsed.data.invitationCode.toUpperCase();
    const token = createParticipantToken();
    const expiresAt = new Date(Date.now() + roomTtlMs);

    try {
      const result = await pool.query(
        `UPDATE rooms
            SET player2_token_hash = $2,
                last_activity = NOW(),
                player2_last_seen = NOW(),
                expires_at = $3
          WHERE invite_code = $1
            AND player2_token_hash IS NULL
            AND status = 'active'
            AND expires_at > NOW()
        RETURNING id, invite_code, player1_token_hash, player2_token_hash,
                  state, status, player1_last_seen, player2_last_seen, expires_at`,
        [code, hashParticipantToken(token), expiresAt],
      );
      const room = result.rows[0];
      if (!room) {
        const existing = await pool.query(
          "SELECT status, expires_at, player2_token_hash FROM rooms WHERE invite_code = $1",
          [code],
        );
        if (
          !existing.rows[0] ||
          new Date(existing.rows[0].expires_at) <= new Date()
        ) {
          return res
            .status(404)
            .json({ error: "La invitación no existe o caducó." });
        }
        return res
          .status(409)
          .json({ error: "La sala ya tiene dos jugadores o está cerrada." });
      }

      res.status(200).json({
        roomId: room.id,
        role: 2,
        participantToken: token,
        room: toRoomView(room, 2),
      });
    } catch (error) {
      console.error("Joining room failed:", error);
      res
        .status(503)
        .json({ error: "No se pudo entrar a la sala. Inténtalo de nuevo." });
    }
  });

  api.use("/rooms/:roomId", async (req, res, next) => {
    const authorization = req.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";

    try {
      const room = await findActiveRoom(pool, req.params.roomId);
      if (!room) {
        return res
          .status(410)
          .json({ error: "La sala ya no está disponible." });
      }
      const role = getRole(room, token);
      if (!role) return unauthorizedResponse(res);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + roomTtlMs);
      await pool.query(
        `UPDATE rooms
            SET last_activity = $2, expires_at = $3,
                player1_last_seen = CASE WHEN $4 = 1 THEN $2 ELSE player1_last_seen END,
                player2_last_seen = CASE WHEN $4 = 2 THEN $2 ELSE player2_last_seen END
          WHERE id = $1 AND status = 'active'`,
        [room.id, now, expiresAt, role],
      );
      room.expires_at = expiresAt;
      if (role === 1) room.player1_last_seen = now;
      else room.player2_last_seen = now;
      req.room = room;
      req.role = role;
      next();
    } catch (error) {
      next(error);
    }
  });

  api.get("/rooms/:roomId", (req, res) => {
    res.json(toRoomView(req.room, req.role));
  });

  api.post("/rooms/:roomId/uploads", async (req, res) => {
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: `El audio debe ser WAV y pesar como máximo ${MAX_AUDIO_BYTES / 1024 / 1024} MB.`,
      });
    }

    const { audioType } = parsed.data;
    const { state } = req.room;
    const canUpload =
      (audioType === "challenge" && req.role === 1 && state.step === 0) ||
      (audioType === "imitation" && req.role === 2 && state.step === 1);
    if (!canUpload) {
      return res
        .status(409)
        .json({ error: "No puedes subir un audio en esta etapa." });
    }

    const owner = audioType === "challenge" ? "player-1" : "player-2";
    const audioKey = createAudioKey(req.room.id, owner);
    try {
      const uploadUrl = await storage.createUploadUrl(audioKey);
      res.json({ audioKey, uploadUrl, contentType: "audio/wav" });
    } catch (error) {
      console.error("Creating audio upload URL failed:", error);
      res
        .status(503)
        .json({ error: "No se pudo preparar la subida del audio." });
    }
  });

  api.get("/rooms/:roomId/audio/:audioType", async (req, res) => {
    const { state } = req.room;
    let audioKey;
    let allowed = false;

    if (req.params.audioType === "challenge") {
      audioKey = state.challengeKey;
      allowed = Boolean(audioKey) && (req.role === 1 || state.step >= 1);
    } else if (req.params.audioType === "original") {
      audioKey = state.challengeKey;
      allowed =
        Boolean(audioKey) &&
        (req.role === 1 || state.revealed || state.step === 3);
    } else if (req.params.audioType === "imitation") {
      audioKey = state.imitationKey;
      allowed = Boolean(audioKey) && state.step >= 2;
    } else {
      return res.status(404).json({ error: "Ese audio no existe." });
    }

    if (!allowed) {
      return res
        .status(403)
        .json({ error: "Ese audio todavía no está disponible." });
    }

    try {
      const downloadUrl = await storage.createDownloadUrl(audioKey);
      res.json({ downloadUrl, expiresIn: 120 });
    } catch (error) {
      console.error("Creating audio download URL failed:", error);
      res
        .status(503)
        .json({ error: "No se pudo preparar la reproducción del audio." });
    }
  });

  api.post("/rooms/:roomId/actions", async (req, res, next) => {
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "La acción enviada no es válida." });
    }

    const action = parsed.data;
    try {
      if (action.expectedVersion !== req.room.state.version) {
        return res.status(409).json({
          error:
            "La partida cambió en el otro dispositivo. Se actualizó el estado; inténtalo de nuevo.",
        });
      }
      if (action.type === "submit-challenge" && !req.room.player2_token_hash) {
        return res.status(409).json({
          error:
            "Espera a que Jugador 2 se una a la sala antes de enviar el reto.",
        });
      }
      assertActionAllowed(
        { ...req.room.state, roomId: req.room.id },
        req.role,
        { ...action, roomId: req.room.id },
      );
    } catch (error) {
      if (error instanceof GameActionError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }

    const keysToVerify = {
      "submit-challenge":
        action.type === "submit-challenge" ? action.audioKey : null,
      "submit-imitation":
        action.type === "submit-imitation" ? action.audioKey : null,
    };
    const keyToVerify = keysToVerify[action.type];
    if (keyToVerify) {
      const expectedRole =
        action.type === "submit-challenge" ? "player-1" : "player-2";
      if (!isAudioKeyForRole(keyToVerify, req.room.id, expectedRole)) {
        return res
          .status(400)
          .json({ error: "La referencia de audio no es válida." });
      }
      try {
        await storage.verifyAudio(keyToVerify);
      } catch (error) {
        console.error("Uploaded audio validation failed:", error);
        return res
          .status(400)
          .json({ error: "La subida del audio no se completó correctamente." });
      }
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT id, invite_code, player1_token_hash, player2_token_hash,
                state, status, player1_last_seen, player2_last_seen, expires_at
           FROM rooms
          WHERE id = $1 AND status = 'active' AND expires_at > NOW()
          FOR UPDATE`,
        [req.room.id],
      );
      const room = result.rows[0];
      if (!room)
        throw new GameActionError("La sala ya no está disponible.", 410);
      const token = (req.get("authorization") ?? "").slice("Bearer ".length);
      const role = getRole(room, token);
      if (!role)
        throw new GameActionError("No tienes acceso a esta sala.", 401);
      if (action.expectedVersion !== room.state.version) {
        throw new GameActionError(
          "La partida cambió en el otro dispositivo. Se actualizó el estado; inténtalo de nuevo.",
          409,
        );
      }

      const nextState = assertActionAllowed(
        { ...room.state, roomId: room.id },
        role,
        { ...action, roomId: room.id },
      );
      if (action.type === "submit-challenge" && !room.player2_token_hash) {
        throw new GameActionError(
          "Espera a que Jugador 2 se una a la sala antes de enviar el reto.",
          409,
        );
      }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + roomTtlMs);
      await client.query(
        "UPDATE rooms SET state = $2::jsonb, last_activity = $3, expires_at = $4 WHERE id = $1",
        [room.id, JSON.stringify(nextState), now, expiresAt],
      );
      await client.query("COMMIT");

      res.json(
        toRoomView({ ...room, state: nextState, expires_at: expiresAt }, role),
      );
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      if (error instanceof GameActionError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      next(error);
    } finally {
      client?.release();
    }
  });

  api.post("/rooms/:roomId/close", async (req, res) => {
    try {
      await pool.query(
        "UPDATE rooms SET status = 'closing' WHERE id = $1 AND status = 'active'",
        [req.room.id],
      );
      await storage.deleteRoomAudio(req.room.id);
      await pool.query("DELETE FROM rooms WHERE id = $1", [req.room.id]);
      res.json({ closed: true });
    } catch (error) {
      console.error("Closing room failed:", error);
      res.status(503).json({
        error:
          "La sala se cerró, pero la limpieza sigue pendiente. Inténtalo más tarde.",
      });
    }
  });

  app.use("/api", api);
  app.use((error, _req, res, _next) => {
    console.error("Unhandled API error:", error);
    res
      .status(500)
      .json({ error: "Ocurrió un error inesperado. Inténtalo de nuevo." });
  });

  return app;
}

export async function cleanupExpiredRooms(pool, storage) {
  const { rows } = await pool.query(
    `SELECT id FROM rooms
      WHERE status = 'closing' OR expires_at <= NOW()
      ORDER BY expires_at
      LIMIT 100`,
  );
  let cleaned = 0;
  for (const { id } of rows) {
    try {
      await storage.deleteRoomAudio(id);
      await pool.query("DELETE FROM rooms WHERE id = $1", [id]);
      cleaned += 1;
    } catch (error) {
      console.error(`Room cleanup failed for ${id}:`, error);
    }
  }
  return cleaned;
}
