// Run against a test deployment, never against a device with real training data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, webkit } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const url = process.env.BASE_URL;
if (!url) throw new Error("Set BASE_URL to an isolated test deployment.");
for (const [engine, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
])
  test(`${engine}: iPhone catalog → plans → workout → recovery → history → backup → offline`, async () => {
    const browser = await type.launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
    });
    const page = await context.newPage();
    try {
      await page.goto(url);
      await page
        .getByRole("button", { name: "Exercises", exact: true })
        .click();
      await page.getByRole("button", { name: "+ Add exercise" }).click();
      await page.locator("#exercise-name").fill("Test press");
      await page.locator("#exercise-number").fill("12");
      await page.locator("#exercise-settings").fill("Seat 4");
      await page.getByRole("button", { name: "Save machine" }).click();
      await page.getByRole("button", { name: "Plans", exact: true }).click();
      await page.getByRole("button", { name: "+ New plan" }).click();
      await page.locator("#plan-name").fill("A");
      await page.locator("#plan-name").blur();
      await page
        .locator("#plan-add")
        .selectOption({ label: "Test press · #12" });
      await page
        .getByRole("button", { name: "Save plan", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Duplicate", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Start ↗", exact: true })
        .first()
        .click();
      await page
        .getByLabel("Test press set 1 weight", { exact: true })
        .fill("40.5");
      await page
        .getByLabel("Test press set 1 repetitions", { exact: true })
        .fill("9");
      await page
        .getByLabel("Test press set 1 repetitions", { exact: true })
        .blur();
      await page
        .getByRole("button", { name: "○", exact: true })
        .first()
        .click();
      await page.reload();
      await page.getByRole("button", { name: "Resume workout ↗" }).click();
      assert.equal(
        await page
          .getByLabel("Test press set 1 weight", { exact: true })
          .inputValue(),
        "40.5",
      );
      await page.getByRole("button", { name: "✓", exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Edit targets", exact: true })
        .click();
      await page.getByLabel("Target weight 1", { exact: true }).fill("35");
      await page.getByLabel("Target weight 1", { exact: true }).blur();
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await page.getByRole("button", { name: "Finish", exact: true }).click();
      await page.locator('[name="plan-change"]').check();
      await page.getByRole("button", { name: "Save finished workout" }).click();
      await page.getByRole("button", { name: "Plans", exact: true }).click();
      await page
        .getByRole("button", { name: "Start ↗", exact: true })
        .last()
        .click();
      assert.equal(
        await page
          .getByLabel("Test press set 1 weight", { exact: true })
          .inputValue(),
        "40.5",
      );
      assert.equal(
        await page
          .getByLabel("Test press set 1 repetitions", { exact: true })
          .inputValue(),
        "9",
      );
      await page.getByRole("button", { name: "Backup", exact: true }).click();
      const downloaded = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download JSON backup ↗" })
        .click();
      const file = await downloaded;
      const path = await file.path();
      await page.locator("#import-file").setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from("{bad"),
      });
      await page.getByRole("alert").waitFor();
      await page.locator("#import-file").setInputFiles(path);
      await page.getByRole("button", { name: "Replace all data" }).click();
      await page.getByText("Backup restored successfully.").waitFor();
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(
        () => navigator.serviceWorker.controller !== null,
      );
      await context.setOffline(true);
      if (engine === "webkit") {
        // Playwright WebKit's offline new-page navigation can fail internally.
        // Keep the browser genuinely offline and verify cache plus UI writes.
        assert(
          await page.evaluate(async () => {
            const cache = await caches.open("form-shell-v3");
            return Boolean(await cache.match("./main.js"));
          }),
        );
        await page
          .getByRole("button", { name: "Workout", exact: true })
          .click();
        assert.equal(
          await page
            .getByLabel("Test press set 1 weight", { exact: true })
            .inputValue(),
          "40.5",
        );
        await page
          .getByLabel("Test press set 1 weight", { exact: true })
          .fill("41.5");
        await page
          .getByLabel("Test press set 1 weight", { exact: true })
          .blur();
        assert.equal(
          await page.evaluate(() => {
            const data = JSON.parse(
              localStorage.getItem("form.fitness.v1"),
            ).data;
            return data.active.items[0].sets[0].weight;
          }),
          41.5,
        );
      } else {
        // Chromium exercises actual offline startup from the precached shell.
        const offlinePage = await context.newPage();
        await offlinePage.goto(url);
        await offlinePage
          .getByRole("button", { name: "Resume workout ↗" })
          .click();
        assert.equal(
          await offlinePage
            .getByLabel("Test press set 1 weight", { exact: true })
            .inputValue(),
          "40.5",
        );
        assert(
          await offlinePage.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        );
      }
    } finally {
      await browser.close();
    }
  });

const cleverFixture = {
  schema_version: "1.0",
  workout_sessions: [
    {
      date: "2026-04-27",
      name: "Einheit A",
      exercises: [
        {
          name: "Butterfly machine",
          type: "strength",
          sets: [
            { set_number: 1, reps: 10, weight_kg: 20, duration_seconds: null },
          ],
        },
        {
          name: "Butterfly machine",
          type: "strength",
          sets: [
            { set_number: 1, reps: 8, weight_kg: 35, duration_seconds: null },
          ],
        },
      ],
    },
    {
      date: "2026-11-09",
      name: "Ganzkörper",
      exercises: [
        {
          name: "Crosstrainer",
          type: "cardio",
          sets: [
            {
              set_number: 1,
              reps: null,
              weight_kg: null,
              duration_seconds: 600,
            },
          ],
        },
        {
          name: "Low plank",
          type: "isometric",
          sets: [
            {
              set_number: 1,
              reps: null,
              weight_kg: null,
              duration_seconds: 45,
            },
          ],
        },
        {
          name: "Back extension 45 degrees",
          type: "strength",
          sets: [
            {
              set_number: 1,
              reps: 10,
              weight_kg: null,
              duration_seconds: null,
            },
          ],
        },
      ],
    },
  ],
};
for (const [engine, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
])
  test(`${engine}: Clever Fit file → mappings → 2 editable plans → history → reimport → offline`, async () => {
    const browser = await type.launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
    });
    const page = await context.newPage();
    try {
      await page.goto(url);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(
        () => navigator.serviceWorker.controller !== null,
      );
      await page.getByRole("button", { name: "Backup", exact: true }).click();
      // Prevent network access throughout the migration. Playwright's WebKit
      // context.setOffline() breaks file-picker processing even with a cached
      // application; request interception instead rejects all outgoing traffic.
      // Chromium additionally verifies the browser's true offline mode.
      if (engine === "webkit")
        await page.route("**/*", (route) =>
          route.abort("internetdisconnected"),
        );
      else await context.setOffline(true);
      const file = {
        name: "clever-fit.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(cleverFixture)),
      };
      await page.locator("#clever-file").setInputFiles(file);
      await page
        .getByText("2 workouts · 5 exercise occurrences · 5 sets")
        .waitFor();
      await page
        .getByRole("button", { name: "Import exercises, 2 plans and history" })
        .click();
      await page
        .getByText(
          /Clever Fit imported: 5 machines, 2 plans, 2 workouts and 5 sets/,
        )
        .waitFor();
      await page
        .getByRole("button", { name: "Edit plan", exact: true })
        .first()
        .click();
      await page
        .getByRole("dialog")
        .getByText("Butterfly machine")
        .first()
        .waitFor();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("button", { name: "History", exact: true }).click();
      await page.getByText("09.11.2026").waitFor();
      await page.locator("summary").first().click();
      await page.getByText("10:00 min").waitFor();
      await page.getByText("— kg × 10").waitFor();
      await page.getByRole("button", { name: "Backup", exact: true }).click();
      const downloaded = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download JSON backup ↗" })
        .click();
      const fileDownload = await downloaded;
      const backupFile = await fileDownload.path();
      await page.locator("#import-file").setInputFiles(backupFile);
      await page.getByRole("button", { name: "Replace all data" }).click();
      await page.getByText("Backup restored successfully.").waitFor();
      await page.getByRole("button", { name: "Backup", exact: true }).click();
      await page.locator("#clever-file").setInputFiles(file);
      await page.getByText("2 already imported").waitFor();
      await page
        .getByRole("button", { name: "Import exercises, 2 plans and history" })
        .click();
      await page
        .getByText(/0 machines, 0 plans, 0 workouts and 0 sets/)
        .waitFor();
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(
        () => navigator.serviceWorker.controller !== null,
      );
      await context.setOffline(true);
      if (engine === "webkit") {
        assert(
          await page.evaluate(async () => {
            const cache = await caches.open("form-shell-v3");
            return Boolean(await cache.match("./main.js"));
          }),
        );
        await page
          .getByRole("button", { name: "History", exact: true })
          .click();
        await page.getByText("09.11.2026").waitFor();
        await page.getByRole("button", { name: "Plans", exact: true }).click();
        await page.getByText("Ganzkörper", { exact: true }).first().waitFor();
      } else {
        const offlinePage = await context.newPage();
        await offlinePage.goto(url);
        await offlinePage
          .getByRole("button", { name: "History", exact: true })
          .click();
        await offlinePage.getByText("09.11.2026").waitFor();
        assert(
          await offlinePage.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        );
      }
    } finally {
      await browser.close();
    }
  });
