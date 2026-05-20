// =============================================================================
// Allure 3 Configuration
// =============================================================================
//
// Dynamic config that sets historyPath per browser/device project.
// In CI: ALLURE_BROWSER env var is set by the workflow (matrix.project).
// Locally: defaults to 'local' so history doesn't mix with CI runs.
//
// History is stored per browser/device to enable meaningful trend analysis:
//   chromium      → history/chromium.jsonl
//   firefox       → history/firefox.jsonl
//   mobile-chrome → history/mobile-chrome.jsonl
//   mobile-safari → history/mobile-safari.jsonl

import { defineConfig } from "allure";

const browser = process.env.ALLURE_BROWSER || "local";

export default defineConfig({
  name: "RealWorld Playwright Demo",
  output: "./allure-report",
  historyPath: `./allure-history/${browser}.jsonl`,
  appendHistory: true,
  categories: {
    rules: [
      {
        name: "Known bugs — FK constraint",
        matchers: {
          statuses: ["failed"],
          message: ".*delete article with comment.*"
        }
      },
      {
        name: "Product defects",
        matchers: {
          statuses: ["failed"]
        }
      },
      {
        name: "Test defects",
        matchers: {
          statuses: ["broken"]
        }
      }
    ]
  },
  plugins: {
    awesome: {
      options: {
        singleFile: false,
        reportLanguage: "en"
      }
    }
  }
});