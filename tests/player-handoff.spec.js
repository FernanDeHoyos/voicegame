import { test, expect } from "@playwright/test";
import { installAudioMocks, recordAudio } from "./helpers.js";

test("hides the secret title until player two accepts the phone", async ({
  page,
}) => {
  await installAudioMocks(page);
  await page.goto("/");
  await page.locator("#movie").fill("Título secreto");
  await recordAudio(page);

  const prepareButton = page.getByRole("button", {
    name: "Preparar el reto",
  });
  await expect(prepareButton).toBeEnabled();
  await prepareButton.click();

  await expect(
    page.getByRole("heading", { name: "Pasa el teléfono al Jugador 2" }),
  ).toBeVisible();
  await expect(page.locator("#movie")).toHaveCount(0);
  await expect(page.getByText("Título secreto", { exact: true })).toHaveCount(
    0,
  );

  await page
    .getByRole("button", { name: "Jugador 2, ya tengo el teléfono" })
    .click();
  await expect(
    page.getByRole("button", { name: /Escuchar el audio invertido/ }),
  ).toBeVisible();
});
