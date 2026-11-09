// Vor dem Proxy-Start (prepare von e2eWebServers): veröffentlichte consumers-ZIP laden und per SHA-256 prüfen
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pin = JSON.parse(readFileSync(resolve(root, "e2e/fixtures/consumers.json"), "utf8"));
const target = resolve(root, pin.file);

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

async function download() {
  const res = await fetch(pin.url);
  if (!res.ok) throw new Error(`${pin.url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

try {
  const data = existsSync(target) ? readFileSync(target) : await download();
  const actual = sha256(data);
  if (actual !== pin.sha256) {
    throw new Error(`SHA-256 von ${pin.url} ist ${actual}, erwartet ${pin.sha256}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
} catch (err) {
  process.stderr.write(
    `consumers-ZIP nicht bereit: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
}
