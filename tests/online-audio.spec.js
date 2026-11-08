import { test, expect } from "@playwright/test";

test("online WAVs are mono and resampled while local WAV defaults stay unchanged", async ({
  page,
}) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const { createWavBlob } = await import("/src/utils/audio.js");
    const channels = [
      new Float32Array(48000).fill(0.25),
      new Float32Array(48000).fill(-0.25),
    ];
    const buffer = {
      length: 48000,
      numberOfChannels: 2,
      sampleRate: 48000,
      getChannelData: (index) => channels[index],
    };
    const local = createWavBlob(buffer);
    const online = createWavBlob(buffer, { mono: true, sampleRate: 24000 });
    const readFormat = async (blob) => {
      const view = new DataView(await blob.arrayBuffer());
      return {
        channels: view.getUint16(22, true),
        sampleRate: view.getUint32(24, true),
        firstSample: view.getInt16(44, true),
      };
    };

    return {
      localSize: local.size,
      local: await readFormat(local),
      onlineSize: online.size,
      online: await readFormat(online),
    };
  });

  expect(result.local).toMatchObject({ channels: 2, sampleRate: 48000 });
  expect(result.online).toMatchObject({ channels: 1, sampleRate: 24000 });
  expect(result.online.firstSample).toBe(0);
  expect(result.onlineSize).toBeLessThan(result.localSize / 3);
});

test("online audio uploads show byte progress and send the reduced WAV", async ({
  page,
}) => {
  await page.route("http://localhost:8787/api/rooms/room-id/uploads", (route) =>
    route.fulfill({
      json: {
        uploadUrl: "https://storage.test/audio",
        contentType: "audio/wav",
        audioKey: "rooms/room-id/challenge.wav",
      },
    }),
  );
  await page.goto("/");

  const result = await page.evaluate(async () => {
    let uploadedSize;
    window.XMLHttpRequest = class {
      constructor() {
        this.upload = {};
        this.status = 200;
      }

      open(method, url) {
        this.method = method;
        this.url = url;
      }

      setRequestHeader() {}

      send(blob) {
        uploadedSize = blob.size;
        this.upload.onprogress({
          lengthComputable: true,
          loaded: blob.size / 2,
          total: blob.size,
        });
        this.upload.onprogress({
          lengthComputable: true,
          loaded: blob.size,
          total: blob.size,
        });
        this.onload();
      }
    };

    const { uploadRoomAudio } = await import("/src/services/onlineRooms.js");
    const channels = [
      new Float32Array(48000).fill(0.2),
      new Float32Array(48000).fill(0.1),
    ];
    const buffer = {
      length: 48000,
      numberOfChannels: 2,
      sampleRate: 48000,
      getChannelData: (index) => channels[index],
    };
    const progress = [];
    const audioKey = await uploadRoomAudio(
      { roomId: "room-id", participantToken: "test-token" },
      "challenge",
      buffer,
      (value) => progress.push(value),
    );
    return { audioKey, progress, uploadedSize };
  });

  expect(result.audioKey).toBe("rooms/room-id/challenge.wav");
  expect(result.uploadedSize).toBe(24000 * 2 + 44);
  expect(result.progress).toContainEqual({ phase: "preparing", percent: null });
  expect(result.progress).toContainEqual({ phase: "uploading", percent: 0 });
  expect(result.progress).toContainEqual({ phase: "uploading", percent: 50 });
  expect(result.progress).toContainEqual({ phase: "uploading", percent: 100 });
});
