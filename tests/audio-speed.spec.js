import { test, expect } from "@playwright/test";
import { installAudioMocks, startPlayerTwoTurn } from "./helpers.js";

test("plays reversed audio at normal or modestly reduced speed", async ({
  page,
}) => {
  await installAudioMocks(page);
  await startPlayerTwoTurn(page);

  await page
    .getByRole("button", { name: "Activar velocidad reducida" })
    .click();
  await expect(
    page.getByRole("button", { name: "Restablecer velocidad normal" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: /Escuchar el audio invertido/ })
    .click();

  await expect
    .poll(() => page.evaluate(() => window.__playbackRates))
    .toEqual([0.85]);

  await page
    .getByRole("button", { name: "Restablecer velocidad normal" })
    .click();
  await page
    .getByRole("button", { name: /Escuchar el audio invertido/ })
    .click();
  await page
    .getByRole("button", { name: /Escuchar el audio invertido/ })
    .click();

  await expect
    .poll(() => page.evaluate(() => window.__playbackRates))
    .toEqual([0.85, 1]);
});
