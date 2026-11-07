import { test, expect } from "@playwright/test";
import {
  installAudioMocks,
  recordAudio,
  startPlayerTwoTurn,
} from "./helpers.js";

test("keeps wrong guesses in play and celebrates a correct guess", async ({
  page,
}) => {
  await installAudioMocks(page);
  await startPlayerTwoTurn(page, "El rey león");
  await recordAudio(page);
  await page.getByRole("button", { name: "Descubrir película" }).click();

  const guessField = page.getByRole("textbox", {
    name: "¿CUÁL ES LA PELÍCULA?",
  });
  await guessField.fill("Jurassic Park");
  await page.getByRole("button", { name: "Comprobar" }).click();

  await expect(page.getByText("¡Casi!", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "¡Lo adivinaron!" }),
  ).toHaveCount(0);
  await expect(page.getByText("El rey león", { exact: true })).toHaveCount(0);

  await guessField.fill("El Rey Leon");
  await page.getByRole("button", { name: "Comprobar" }).click();

  await expect(
    page.getByRole("heading", { name: "¡Lo adivinaron!" }),
  ).toBeVisible();
  await expect(page.getByText("El rey león", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Jugar otra ronda" }).click();
  await expect(
    page.getByRole("heading", { name: "Jugador 1, prepara el reto." }),
  ).toBeVisible();
  await expect(page.locator("#movie")).toHaveValue("");
  await expect(page.getByText("RONDA 02")).toBeVisible();
});
