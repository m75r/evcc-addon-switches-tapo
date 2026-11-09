// Vitest: Browser-Teil (happy-dom, CSS als Text) und Server-Teil (Node) als eigene Projekte
import { cssAsText } from "@evcc-addons/sdk/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
        plugins: [cssAsText()],
        test: {
          name: "browser",
          environment: "happy-dom",
          include: ["test/**/*.test.{ts,tsx}"],
          exclude: ["test/server/**"],
        },
      },
      {
        test: { name: "server", environment: "node", include: ["test/server/**/*.test.ts"] },
      },
    ],
  },
});
