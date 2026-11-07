import { test, expect } from "@playwright/test";

const invitationCode = "QWERTY_1234";

test("creates an online room and displays a shareable invitation", async ({
  page,
}) => {
  await page.route("http://localhost:8787/api/rooms**", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.url().endsWith("/rooms")) {
      await route.fulfill({
        status: 201,
        json: {
          roomId: "room-id-1",
          role: 1,
          invitationCode,
          participantToken: "host-token",
          room: {
            roomId: "room-id-1",
            role: 1,
            status: "waiting",
            inviteCode: invitationCode,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            step: 0,
            round: 1,
            title: null,
            revealed: false,
            guess: null,
            hasChallenge: false,
            hasImitation: false,
            version: 0,
          },
        },
      });
      return;
    }

    await route.fulfill({
      json: {
        roomId: "room-id-1",
        role: 1,
        status: "waiting",
        inviteCode: invitationCode,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        step: 0,
        round: 1,
        title: null,
        revealed: false,
        guess: null,
        hasChallenge: false,
        hasImitation: false,
        version: 0,
      },
    });
  });

  await page.goto("/");
  await page
    .getByRole("button", { name: "Jugar en línea desde dos dispositivos" })
    .click();
  await page.getByRole("button", { name: "Crear sala en línea" }).click();

  await expect(page.getByText("INVITACIÓN PRIVADA")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Enlace de invitación" }),
  ).toHaveValue(new RegExp(`#room=${invitationCode}`));
  await expect(page.getByText("Esperando a Jugador 2")).toBeVisible();
});

test("joins an online room from its invitation link", async ({ page }) => {
  await page.route("http://localhost:8787/api/rooms**", async (route) => {
    if (route.request().url().endsWith("/rooms/join")) {
      await route.fulfill({
        json: {
          roomId: "room-id-2",
          role: 2,
          participantToken: "guest-token",
          room: {
            roomId: "room-id-2",
            role: 2,
            status: "active",
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            step: 0,
            round: 1,
            title: null,
            revealed: false,
            guess: null,
            hasChallenge: false,
            hasImitation: false,
            version: 0,
          },
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        roomId: "room-id-2",
        role: 2,
        status: "active",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        step: 0,
        round: 1,
        title: null,
        revealed: false,
        guess: null,
        hasChallenge: false,
        hasImitation: false,
        version: 0,
      },
    });
  });

  await page.goto(`/#room=${invitationCode}`);
  await expect(
    page.getByRole("heading", { name: "Esperando el reto" }),
  ).toBeVisible();
  await expect(
    page.getByText("Jugador 2 · Invitado", { exact: false }),
  ).toBeVisible();
});
