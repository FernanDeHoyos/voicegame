import { test, expect } from "@playwright/test";
import {
  installAudioMocks,
  recordAudio,
  startPlayerTwoTurn,
} from "./helpers.js";

test("plays the imitation reversed and as recorded for comparison", async ({
  page,
}) => {
  await installAudioMocks(page);
  await startPlayerTwoTurn(page);
  await recordAudio(page);
  await page.getByRole("button", { name: "Descubrir película" }).click();

  await page
    .getByRole("button", { name: /Reproducir imitación invertida/ })
    .click();
  await expect(page.getByText("1 · IMITACIÓN INVERTIDA")).toBeVisible();
  await expect(page.getByText("2 · IMITACIÓN SIN INVERTIR")).toBeVisible();
  await expect(
    page.getByText("3 · SPOILER · AUDIO ORIGINAL DE JUGADOR 1"),
  ).toBeVisible();
  await expect(
    page.getByText(/Este audio dice el título de la película/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Reproducir original/ }),
  ).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.__playbackDirections))
    .toEqual(["reversed"]);

  await page
    .getByRole("button", { name: /Reproducir imitación sin invertir/ })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__playbackDirections))
    .toEqual(["reversed", "normal"]);

  await page
    .getByRole("button", {
      name: "Revelar audio original (dice el título)",
    })
    .click();
  await expect(
    page.getByRole("button", { name: /Reproducir original/ }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__playbackDirections))
    .toEqual(["reversed", "normal"]);

  await page
    .getByRole("button", {
      name: /Reproducir original \(contiene la respuesta\)/,
    })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__playbackDirections))
    .toEqual(["reversed", "normal", "normal"]);
});
