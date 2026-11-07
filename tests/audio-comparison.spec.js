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

  await page.getByRole("button", { name: /Escuchar el resultado/ }).click();
  await expect
    .poll(() => page.evaluate(() => window.__playbackDirections))
    .toEqual(["reversed"]);

  await page
    .getByRole("button", { name: /Escuchar la imitación sin invertir/ })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__playbackDirections))
    .toEqual(["reversed", "normal"]);

  await page.getByRole("button", { name: /Comparar con el original/ }).click();
  await expect
    .poll(() => page.evaluate(() => window.__playbackDirections))
    .toEqual(["reversed", "normal", "normal"]);
});
