import { expect } from "@playwright/test";

export async function installAudioMocks(page) {
  await page.addInitScript(() => {
    const createBuffer = () => ({
      numberOfChannels: 1,
      length: 44100,
      sampleRate: 44100,
      duration: 1,
      getChannelData: () => new Float32Array(44100),
      copyToChannel: () => {},
    });

    window.__playbackRates = [];

    class FakeAudioContext {
      constructor() {
        this.state = "running";
        this.destination = {};
      }

      async resume() {}
      async close() {}
      async decodeAudioData() {
        return createBuffer();
      }
      createBuffer() {
        return createBuffer();
      }
      createBufferSource() {
        const source = {
          buffer: null,
          playbackRate: { value: 1 },
          connect() {},
          start() {
            window.__playbackRates.push(this.playbackRate.value);
          },
          stop() {},
        };

        return source;
      }
    }

    class FakeMediaRecorder {
      constructor() {
        this.state = "inactive";
        this.mimeType = "audio/webm";
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob([new Uint8Array([0])], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({ getTracks: () => [] }),
      },
    });

    window.AudioContext = FakeAudioContext;
    window.MediaRecorder = FakeMediaRecorder;
  });
}

export async function recordAudio(page) {
  await page.getByRole("button", { name: "Empezar a grabar" }).click();
  await page.getByRole("button", { name: "Detener grabación" }).click();
}

export async function startPlayerTwoTurn(page, title = "El rey león") {
  await page.goto("/");
  await page.locator("#movie").fill(title);
  await recordAudio(page);

  const prepareButton = page.getByRole("button", {
    name: "Preparar el reto",
  });
  await expect(prepareButton).toBeEnabled();
  await prepareButton.click();

  await expect(
    page.getByRole("heading", { name: "Pasa el teléfono al Jugador 2" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Jugador 2, ya tengo el teléfono" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Jugador 2, escucha e imita." }),
  ).toBeVisible();
}
