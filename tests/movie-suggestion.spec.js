import { test, expect } from "@playwright/test";

test("suggests only movie titles with Spanish labels", async ({ page }) => {
  let sparqlQuery = "";
  await page.route("https://query.wikidata.org/sparql**", async (route) => {
    const requestUrl = new URL(route.request().url());
    sparqlQuery = requestUrl.searchParams.get("query") ?? "";

    await route.fulfill({
      json: {
        results: {
          bindings: [
            { filmLabel: { value: "La película de prueba" } },
            { filmLabel: { value: "Una película en español" } },
          ],
        },
      },
    });
  });

  await page.goto("/");
  await page
    .getByRole("button", { name: "Sugiere una película al azar" })
    .click();

  await expect
    .poll(() => page.locator("#movie").inputValue())
    .toMatch(/^(La película de prueba|Una película en español)$/);
  expect(sparqlQuery).toContain("rdfs:label ?filmLabel");
  expect(sparqlQuery).toContain('FILTER(LANG(?filmLabel) = "es")');
  expect(sparqlQuery).not.toContain("SERVICE wikibase:label");
});
