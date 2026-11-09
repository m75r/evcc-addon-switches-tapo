// Zusammenspiel mit der veröffentlichten consumers-ZIP: ⏻ ☀ an Ladepunkten, ⏻ an Verbrauchern
import { expect, test, type Page } from "@playwright/test";
import { login, openEvcc } from "@evcc-addons/sdk/testing/playwright";
import { installSwitchesTapo, resetAddons } from "../helpers.js";

/** Ladepunkt „Lampe“ (Index 2) ist an die Tapo-Steckdose `lampe` von switches-tapo gebunden */
const LAMP = 2;
/** Fake-Tapo der Steckdose „kaffee“ (Verbraucher-Bindung in switches-v2.json) */
const COFFEE_TAPO = "http://127.0.0.1:17091";
const COFFEE_STATE =
  "/addons-api/ext/switches-tapo/kaffee/c0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ff/state";

async function mode(page: Page, index: number): Promise<unknown> {
  const res = await page.request.get(`/api/state?jq=.loadpoints[${index}].mode`);
  return res.json();
}

test.describe("Kartenaktionen in consumers", () => {
  // consumers ist per CLI installiert (Seed), switches-tapo kommt per API dazu
  test.beforeEach(async ({ page }) => {
    resetAddons();
    await installSwitchesTapo();
    await login(page);
  });

  test("„Lampe“ steht unter „Schaltbar“ mit ⏻ ☀, „Waschmaschine“ ohne Buttons", async ({
    page,
  }) => {
    await openEvcc(page, "#/addons/consumers");
    const switchable = page.getByTestId("consumers-switchable");
    const lamp = switchable.getByTestId(`consumer-switch-${LAMP}`);
    await expect(lamp.getByTestId(`consumer-mode-${LAMP}`)).toBeVisible();
    await expect(lamp.getByTestId("consumer-mode-power")).toBeVisible();
    await expect(lamp.getByTestId("consumer-mode-smart")).toBeVisible();
    const washer = page.getByTestId("consumers-measured").getByTestId("consumer-switch-1");
    await expect(washer).toBeVisible();
    await expect(washer.locator('[data-testid^="consumer-mode-"]')).toHaveCount(0);
  });

  test("der Modus lässt sich umschalten", async ({ page }) => {
    await openEvcc(page, "#/addons/consumers");
    const modes = page.getByTestId(`consumer-mode-${LAMP}`);
    const power = modes.getByTestId("consumer-mode-power");
    const smart = modes.getByTestId("consumer-mode-smart");
    await expect(power).toHaveAttribute("aria-pressed", "false");

    // ⏻: off → now → off
    await power.click();
    await expect(power).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => mode(page, LAMP)).toBe("now");
    await power.click();
    await expect(power).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => mode(page, LAMP)).toBe("off");

    // ☀: off → smart → off
    await smart.click();
    await expect(smart).toHaveAttribute("aria-pressed", "true");
    await expect(power).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => mode(page, LAMP)).toBe("smart");
    await smart.click();
    await expect(smart).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => mode(page, LAMP)).toBe("off");
  });

  test("die Modus-Gruppe steht im Kartenkopf rechts vom Titel", async ({ page }) => {
    await openEvcc(page, "#/addons/consumers");
    const card = page.getByTestId(`consumer-switch-${LAMP}`);
    const title = await card.getByTestId("consumer-title").boundingBox();
    const group = await card.getByTestId(`consumer-mode-${LAMP}`).boundingBox();
    expect(title).not.toBeNull();
    expect(group).not.toBeNull();
    if (!title || !group) return;
    expect(group.x).toBeGreaterThan(title.x + title.width - 1);
    // gleiche Zeile: die vertikalen Mitten liegen nah beieinander
    expect(Math.abs(group.y + group.height / 2 - (title.y + title.height / 2))).toBeLessThan(8);
  });

  test("⏻ am Verbraucher „kaffee“ schaltet die Tapo direkt, auch ohne Login", async ({ page }) => {
    const coffee = page.getByTestId("consumers-switchable").getByTestId("consumer-meter-kaffee");
    const tapoOn = async () =>
      ((await (await page.request.get(`${COFFEE_TAPO}/_test/state`)).json()) as { on: boolean }).on;
    for (const loggedIn of [true, false]) {
      if (!loggedIn) {
        await page.context().clearCookies();
        await page.reload();
      }
      await openEvcc(page, "#/addons/consumers");
      const power = coffee.getByTestId("consumer-switch-power");
      await expect(coffee.locator("button")).toHaveCount(1);
      await expect(power).toHaveAttribute("aria-pressed", "false");
      await power.click();
      await expect(power).toHaveAttribute("aria-pressed", "true");
      await expect.poll(tapoOn).toBe(true);
      const state = await page.request.get(COFFEE_STATE);
      expect(((await state.json()) as { on: boolean }).on).toBe(true);
      await power.click();
      await expect(power).toHaveAttribute("aria-pressed", "false");
      await expect.poll(tapoOn).toBe(false);
    }
    await expect(
      page.getByTestId("consumers-measured").getByTestId("consumer-meter-kuehlschrank"),
    ).toBeVisible();
  });

  test("ein abgelehnter Modus erscheint als Fehler auf der Karte", async ({ page }) => {
    await page.route(`**/api/loadpoints/${LAMP + 1}/mode/*`, (route) =>
      route.fulfill({ status: 500, body: "abgelehnt" }),
    );
    await openEvcc(page, "#/addons/consumers");
    const card = page.getByTestId(`consumer-switch-${LAMP}`);
    await card.getByTestId("consumer-mode-smart").click();
    await expect(card.getByTestId("consumer-error")).toHaveText(
      "Modus konnte nicht gesetzt werden: HTTP 500",
    );
  });
});
