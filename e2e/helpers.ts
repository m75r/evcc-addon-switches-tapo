// Hilfen der E2E-Tests: Seed-Zustand (consumers per CLI) und Installation von switches-tapo per API
import { expect, request } from "@playwright/test";
import { ADMIN_PASSWORD, PROXY_URL } from "@evcc-addons/sdk/testing/playwright";
import { resetAddons as resetTestAddons } from "@evcc-addons/sdk/testing/server";
import { chmodSync, copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..");
const { version } = JSON.parse(readFileSync(path.join(ROOT, "addon.json"), "utf8")) as {
  version: string;
};
/** Veröffentlichte consumers-ZIP, von e2e/prepare.mjs geladen und geprüft */
export const CONSUMERS_ZIP = (
  JSON.parse(readFileSync(path.join(ROOT, "e2e/fixtures/consumers.json"), "utf8")) as {
    file: string;
  }
).file;
export const SWITCHES_TAPO_ZIP = path.join(ROOT, `dist/switches-tapo-${version}.zip`);

export function repoPath(relative: string): string {
  return path.resolve(ROOT, relative);
}

/** Nur consumers installiert, addon-data/ leer */
export function resetAddons(): void {
  resetTestAddons({ root: ROOT, zips: [CONSUMERS_ZIP] });
}

/** Datei aus e2e/fixtures als switches.json des Addons, Rechte wie im Betrieb */
function seedSwitches(fixture: string): void {
  const dir = repoPath("e2e/.data/addon-data/switches-tapo");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const target = `${dir}/switches.json`;
  copyFileSync(repoPath(`e2e/fixtures/${fixture}`), target);
  chmodSync(target, 0o600);
}

/** Legt switches.json ab und lädt die ZIP angemeldet über die API hoch (der Server-Teil startet dabei) */
export async function installSwitchesTapo(fixture = "switches-v2.json"): Promise<void> {
  seedSwitches(fixture);
  const api = await request.newContext({ baseURL: PROXY_URL });
  try {
    const login = await api.post("/api/auth/login", { data: { password: ADMIN_PASSWORD } });
    expect(login.ok()).toBe(true);
    const res = await api.put("/addons-api/addons", {
      headers: { "content-type": "application/zip" },
      data: readFileSync(SWITCHES_TAPO_ZIP),
    });
    expect(res.status()).toBe(201);
  } finally {
    await api.dispose();
  }
}
