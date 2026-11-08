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


test("host can select the guest to prepare the challenge", async ({ page }) => {
  let state = {
    roomId: "starter-room", role: 1, status: "active", step: 0,
    round: 1, version: 0, challengeRole: 1, title: null,
    participantsOnline: { player1: true, player2: true },
  };
  await page.route("http://localhost:8787/api/rooms**", async (route) => {
    const request = route.request();
    if (request.url().endsWith("/rooms") && request.method() === "POST") {
      return route.fulfill({ status: 201, json: {
        roomId: state.roomId, role: 1, invitationCode,
        participantToken: "starter-token", room: state,
      } });
    }
    if (request.url().endsWith("/actions")) {
      expect(request.postDataJSON()).toEqual({ type: "choose-starter", role: 2, expectedVersion: 0 });
      state = { ...state, challengeRole: 2, version: 1 };
    }
    return route.fulfill({ json: state });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Jugar en línea desde dos dispositivos" }).click();
  await page.getByRole("button", { name: "Crear sala en línea" }).click();
  await expect(page.getByRole("heading", { name: "Prepara el reto" })).toBeVisible();
  await page.getByLabel("¿QUIÉN EMPIEZA ESTA RONDA?").selectOption("2");
  await expect(page.getByRole("heading", { name: "Esperando el reto" })).toBeVisible();
  await expect(page.getByLabel("TÍTULO SECRETO")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("¿QUIÉN EMPIEZA ESTA RONDA?")).toHaveValue("2");
});
