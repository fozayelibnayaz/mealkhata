import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  webServer: [
    {
      command: "npm run db:migrate && npm run dev:api",
      url: "http://127.0.0.1:8787/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "npm run dev -- --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
    },
  ],
  use: { baseURL: "http://127.0.0.1:5173", headless: true },
  reporter: "list",
});
