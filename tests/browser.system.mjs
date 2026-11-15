// Run against a test deployment, never against a device with real training data.
import { test } from "node:test";
import { APP_VERSION, SHELL_CACHE } from "../dist/domain/app-version.js";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, webkit } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
async function openMoreDestination(page, name) {
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("navigation", { name: "More navigation", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
}
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
      assert.equal(await page.title(), "Fitty — Training notebook");
      await page.getByLabel("App version", { exact: true }).waitFor();
      assert.equal(
        await page.getByLabel("App version", { exact: true }).innerText(),
        `Fitty · Version ${APP_VERSION}`,
      );
      await page
        .locator(".brand")
        .getByText("Fitty", { exact: false })
        .waitFor();
      assert.equal(
        await page
          .locator('meta[name="apple-mobile-web-app-title"]')
          .getAttribute("content"),
        "Fitty",
      );
      const manifest = await page.evaluate(async () =>
        (
          await fetch(document.querySelector('link[rel="manifest"]').href)
        ).json(),
      );
      assert.equal(manifest.name, "Fitty");
      assert.equal(manifest.short_name, "Fitty");
      await openMoreDestination(page, "Exercises");
      await page.getByRole("button", { name: "+ Add exercise" }).click();
      await page.locator("#exercise-name").fill("Test press");
      await page.locator("#exercise-number").fill("12");
      assert.equal(await page.getByRole("dialog").locator("input").count(), 2);
      assert.equal(
        await page.getByRole("dialog").locator("textarea").count(),
        0,
      );
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
      await openMoreDestination(page, "Exercises");
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await page.locator("#exercise-number").fill("27");
      await page.getByRole("button", { name: "Save machine" }).click();
      await page.reload();
      await page.getByRole("button", { name: "Plans", exact: true }).click();
      await page
        .getByRole("button", { name: "Start ↗", exact: true })
        .first()
        .click();
      await page.getByText("Machine 27", { exact: true }).waitFor();
      const card = page.locator("details.workout-exercise").first();
      const summary = card.locator("summary");
      assert.equal(await card.locator("input").count(), 6);
      assert.deepEqual(
        await card.locator(".exercise-body > .row button").allTextContents(),
        ["Skip", "+ Set", "Remove"],
      );
      const weight = page.getByLabel("Test press set 1 weight", {
        exact: true,
      });
      assert(!(await weight.isVisible()));
      assert.equal(await page.getByLabel("Jump to a machine").count(), 0);
      assert.equal(
        await page.locator("details.workout-exercise[open]").count(),
        0,
      );
      assert.equal(
        await page.locator('main input[data-field="actual"]').count(),
        6,
      );
      assert.equal(
        await page.locator('main input[inputmode="decimal"]').count(),
        3,
      );
      assert.equal(await page.locator("main .timer").count(), 1);
      assert(await summary.getByText("0 of 3 sets completed").isVisible());
      await page.getByRole("button", { name: "Restart", exact: true }).click();
      assert(!(await weight.isVisible()));
      await page.getByRole("button", { name: "Home", exact: true }).click();
      await page.getByRole("button", { name: "Resume workout ↗" }).click();
      assert(!(await weight.isVisible()));
      await summary.focus();
      await page.keyboard.press("Enter");
      await weight.waitFor({ state: "visible" });
      await page.keyboard.press("Space");
      await weight.waitFor({ state: "hidden" });
      await summary.click();
      await weight.waitFor({ state: "visible" });
      await openMoreDestination(page, "Exercises");
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await page.locator("#exercise-number").fill("28");
      await page.getByRole("button", { name: "Save machine" }).click();
      await page.getByRole("button", { name: "Workout", exact: true }).click();
      await page.getByText("Machine 27", { exact: true }).waitFor();
      await page
        .getByLabel("Test press set 1 weight", { exact: true })
        .fill("40,5");
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
      await summary.getByText("1 of 3 sets completed").waitFor();
      const badgeColor = () =>
        summary
          .locator(".num")
          .evaluate((element) => getComputedStyle(element).backgroundColor);
      const incompleteColor = await badgeColor();
      const doneColor = await card
        .getByRole("button", { name: "✓", exact: true })
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      assert.notEqual(incompleteColor, doneColor);
      await card
        .getByRole("button", { name: "○", exact: true })
        .first()
        .click();
      assert.equal(await badgeColor(), incompleteColor);
      await card.getByRole("button", { name: "○", exact: true }).click();
      await summary.getByText("3 of 3 sets completed").waitFor();
      assert.equal(await badgeColor(), doneColor);
      await summary.click();
      assert.equal(await badgeColor(), doneColor);
      await page.reload();
      await page.getByRole("button", { name: "Resume workout ↗" }).click();
      assert.equal(await badgeColor(), doneColor);
      await summary.click();
      await card
        .locator(".set-grid:not(.header)")
        .nth(1)
        .getByRole("button", { name: "✓", exact: true })
        .click();
      assert.equal(await badgeColor(), incompleteColor);
      await card
        .locator(".set-grid:not(.header)")
        .nth(2)
        .getByRole("button", { name: "✓", exact: true })
        .click();
      await summary.click();
      await weight.waitFor({ state: "hidden" });
      assert(
        await summary.getByText("Machine 27", { exact: true }).isVisible(),
      );
      await page.reload();
      await page.getByRole("button", { name: "Resume workout ↗" }).click();
      assert.equal(
        await page.locator("details.workout-exercise[open]").count(),
        0,
      );
      await page.locator("details.workout-exercise summary").first().click();
      assert.equal(
        await page
          .getByLabel("Test press set 1 weight", { exact: true })
          .inputValue(),
        "40,5",
      );
      await page.getByRole("button", { name: "✓", exact: true }).waitFor();
      await card.getByRole("button", { name: "+ Set", exact: true }).click();
      await page.getByRole("button", { name: "Finish", exact: true }).click();
      await page.locator('[name="plan-change"]').check();
      await page.getByRole("button", { name: "Save finished workout" }).click();
      await page.locator("summary").first().click();
      await page
        .getByRole("heading", { name: "Test press · #27", exact: true })
        .waitFor();
      const resultsTable = page.getByRole("table", {
        name: "Test press set results",
      });
      assert.deepEqual(
        await resultsTable.locator("thead th").allTextContents(),
        ["Set", "Weight", "Reps", "Status"],
      );
      assert.equal(await resultsTable.locator("tbody tr").count(), 4);
      assert.equal(
        await resultsTable.locator("tbody tr").first().innerText(),
        "1\t40,5 kg\t9\t✓ Completed",
      );
      assert.match(
        await resultsTable.locator("tbody tr").nth(1).innerText(),
        /Unfinished/,
      );
      const rows = await resultsTable.locator("tbody tr").evaluateAll((rows) =>
        rows.map((row) => ({
          top: row.getBoundingClientRect().top,
          bottom: row.getBoundingClientRect().bottom,
        })),
      );
      assert(rows[1].top >= rows[0].bottom);
      assert(rows[2].top >= rows[1].bottom);
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        );
      }
      await page.getByRole("button", { name: "Plans", exact: true }).click();
      await page
        .getByRole("button", { name: "Start ↗", exact: true })
        .last()
        .click();
      await page.getByText("Machine 28", { exact: true }).waitFor();
      assert.equal(
        await page.locator("details.workout-exercise[open]").count(),
        0,
      );
      await summary.click();
      assert.equal(
        await page
          .getByLabel("Test press set 1 weight", { exact: true })
          .inputValue(),
        "40,5",
      );
      assert.equal(
        await page
          .getByLabel("Test press set 1 repetitions", { exact: true })
          .inputValue(),
        "9",
      );
      await openMoreDestination(page, "Backup & restore");
      const downloaded = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download JSON backup ↗" })
        .click();
      const file = await downloaded;
      assert.match(
        file.suggestedFilename(),
        /^fitty-backup-\d{4}-\d{2}-\d{2}\.json$/,
      );
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
          await page.evaluate(async (cacheName) => {
            const cache = await caches.open(cacheName);
            return Boolean(await cache.match("./main.js"));
          }, SHELL_CACHE),
        );
        await page
          .getByRole("button", { name: "Workout", exact: true })
          .click();
        const restoredCard = page.locator("details.workout-exercise").first();
        if (!(await restoredCard.evaluate((card) => card.open)))
          await restoredCard.locator("summary").click();
        await page
          .getByLabel("Test press set 1 weight", { exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByLabel("Test press set 1 weight", { exact: true })
            .inputValue(),
          "40,5",
        );
        await page
          .getByLabel("Test press set 1 weight", { exact: true })
          .fill("41,5");
        await page
          .getByLabel("Test press set 1 weight", { exact: true })
          .blur();
        assert.equal(
          await page.evaluate(() => {
            const data = JSON.parse(
              localStorage.getItem("fitty.fitness.v1"),
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
          await offlinePage.locator("details.workout-exercise[open]").count(),
          0,
        );
        await offlinePage
          .locator("details.workout-exercise summary")
          .first()
          .click();
        assert.equal(
          await offlinePage
            .getByLabel("Test press set 1 weight", { exact: true })
            .inputValue(),
          "40,5",
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
      await openMoreDestination(page, "Backup & restore");
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
      await page
        .getByRole("button", { name: "Start ↗", exact: true })
        .last()
        .click();
      const cardio = page.locator("details.workout-exercise").filter({
        has: page.getByRole("heading", { name: "Crosstrainer", exact: true }),
      });
      assert.equal(await cardio.getAttribute("open"), null);
      await cardio.locator("summary").click();
      const duration = cardio.getByLabel(
        "Crosstrainer set 1 duration seconds",
        { exact: true },
      );
      assert.equal(await duration.inputValue(), "600");
      await duration.fill("660");
      await duration.blur();
      await cardio.getByRole("button", { name: "○", exact: true }).click();
      await page.getByRole("button", { name: "Home", exact: true }).click();
      await page.getByRole("button", { name: "Resume workout ↗" }).click();
      assert.equal(await duration.inputValue(), "660");
      await cardio.getByRole("button", { name: "✓", exact: true }).waitFor();
      await page.getByRole("button", { name: "History", exact: true }).click();
      await page.getByText("09.11.2026").waitFor();
      await page.locator("summary").first().click();
      await page.getByText("10:00 min").waitFor();
      await assertHistoryActionPlacement(
        page,
        page.locator("details[open][data-session-id]"),
      );
      const bodyweight = page.getByRole("table", {
        name: "Back extension 45 degrees set results",
      });
      assert.equal(
        await bodyweight.locator("tbody tr").innerText(),
        "1\t—\t10\t✓ Completed",
      );
      await openMoreDestination(page, "Backup & restore");
      const downloaded = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download JSON backup ↗" })
        .click();
      const fileDownload = await downloaded;
      const backupFile = await fileDownload.path();
      await page.locator("#import-file").setInputFiles(backupFile);
      await page.getByRole("button", { name: "Replace all data" }).click();
      await page.getByText("Backup restored successfully.").waitFor();
      await openMoreDestination(page, "Backup & restore");
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
          await page.evaluate(async (cacheName) => {
            const cache = await caches.open(cacheName);
            return Boolean(await cache.match("./main.js"));
          }, SHELL_CACHE),
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

// Serve successive releases on one isolated origin so the real service-worker
// lifecycle, cache installation and multi-window handover are exercised.
async function updateServer() {
  const { createServer } = await import("node:http");
  const { readFile } = await import("node:fs/promises");
  let version = 1;
  let broken = false;
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = pathname === "/" ? "index.html" : pathname.slice(1);
    if (broken && file === "icon-512.png") {
      response.writeHead(503).end();
      return;
    }
    try {
      const source = new URL("../dist/" + file, import.meta.url);
      if (!source.href.startsWith(new URL("../dist/", import.meta.url).href)) {
        response.writeHead(404).end();
        return;
      }
      let content = await readFile(source);
      if (file.endsWith(".js"))
        content = Buffer.from(
          content
            .toString()
            .replaceAll(SHELL_CACHE, `fitty-shell-update-test-${version}`),
        );
      if (file === "index.html")
        content = Buffer.from(
          content
            .toString()
            .replace(
              '<html lang="en">',
              `<html lang="en" data-test-version="${version}">`,
            ),
        );
      const mime = file.endsWith(".js")
        ? "text/javascript"
        : file.endsWith(".css")
          ? "text/css"
          : file.endsWith(".png")
            ? "image/png"
            : file.endsWith(".webmanifest")
              ? "application/manifest+json"
              : "text/html";
      response
        .writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" })
        .end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    release: (next, fail = false) => {
      version = next;
      broken = fail;
    },
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}

for (const [engine, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
])
  test(`${engine}: real update → explicit reload → active data preserved → other window consent → failed download`, async () => {
    const server = await updateServer();
    const browser = await type.launch();
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      await page.goto(server.url);
      await page.waitForFunction(() =>
        Boolean(navigator.serviceWorker.controller),
      );
      await page.getByText("Offline ready", { exact: true }).waitFor();
      assert.equal(
        await page.getByText("Update available", { exact: true }).count(),
        0,
      );
      const { setup, seed } = await import("./fixtures.js");
      const { encodeBackup } = await import(
        "../dist/infrastructure/storage.js"
      );
      const { app, clock } = setup();
      const { a, b } = seed(app);
      app.start(a);
      app.complete(app.data.active.items[0].id, 0);
      app.finish([]);
      app.start(b);
      app.set(app.data.active.items[0].id, 0, { weight: 42.5, reps: 8 });
      app.complete(app.data.active.items[0].id, 0);
      await openMoreDestination(page, "Backup & restore");
      await page.locator("#import-file").setInputFiles({
        name: "workout.json",
        mimeType: "application/json",
        buffer: Buffer.from(encodeBackup(app.data, clock.iso())),
      });
      await page
        .getByRole("button", { name: "Replace all data", exact: true })
        .click();
      await page.getByRole("button", { name: "Resume workout ↗" }).click();
      const stored = await page.evaluate(() =>
        localStorage.getItem("fitty.fitness.v1"),
      );
      const other = await context.newPage();
      await other.goto(server.url);
      await other.waitForFunction(() =>
        Boolean(navigator.serviceWorker.controller),
      );
      await page.locator("details.workout-exercise summary").first().click();
      // An update arriving must not replace the whole form or erase a draft.
      await openMoreDestination(page, "Exercises");
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await page.locator("#exercise-name").fill("Draft machine name");
      server.release(2);
      await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
      await page.getByText("Update available", { exact: true }).waitFor();
      assert.equal(
        await page.locator("#exercise-name").inputValue(),
        "Draft machine name",
      );
      assert.equal(
        await page.locator("html").getAttribute("data-test-version"),
        "1",
      );
      // Applying is blocked while an editor or a save error is present.
      await page
        .getByRole("button", { name: "Reload", exact: true })
        .dispatchEvent("click");
      await page.getByText(/Finish or cancel the open editor/).waitFor();
      assert.equal(
        await page.locator("html").getAttribute("data-test-version"),
        "1",
      );
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      assert.equal(
        await page.evaluate(() => localStorage.getItem("fitty.fitness.v1")),
        stored,
      );
      await page.getByRole("button", { name: "Reload", exact: true }).click();
      await page.waitForFunction(
        () => document.documentElement.dataset.testVersion === "2",
      );
      assert.equal(
        await page.evaluate(() => localStorage.getItem("fitty.fitness.v1")),
        stored,
      );
      await page.getByRole("button", { name: "Resume workout ↗" }).click();
      assert.equal(
        await page.locator("details.workout-exercise[open]").count(),
        0,
      );
      await page.locator("details.workout-exercise summary").first().click();
      assert.equal(
        await page
          .getByLabel("Chest press set 1 weight", { exact: true })
          .inputValue(),
        "42,5",
      );
      await page.getByRole("button", { name: "✓", exact: true }).waitFor();
      await other.getByText("Update available", { exact: true }).waitFor();
      assert.equal(
        await other.locator("html").getAttribute("data-test-version"),
        "1",
      );
      await other.getByRole("button", { name: "Reload", exact: true }).click();
      await other.waitForFunction(
        () => document.documentElement.dataset.testVersion === "2",
      );
      assert.equal(
        await other.evaluate(() => localStorage.getItem("fitty.fitness.v1")),
        stored,
      );
      await other.close();
      server.release(3, true);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page.getByText(/The update could not be downloaded/).waitFor();
      assert.equal(
        await page.locator("html").getAttribute("data-test-version"),
        "2",
      );
      assert.equal(
        await page.evaluate(() => localStorage.getItem("fitty.fitness.v1")),
        stored,
      );
      assert.equal(
        await page.getByRole("button", { name: "Reload", exact: true }).count(),
        0,
      );
      await context.setOffline(true);
      await openMoreDestination(page, "Backup & restore");
      assert(
        await page
          .getByRole("button", { name: "Download JSON backup ↗" })
          .isVisible(),
      );
      assert(
        await page.evaluate(async () =>
          Boolean(
            await (
              await caches.open("fitty-shell-update-test-2")
            ).match("./main.js"),
          ),
        ),
      );
    } finally {
      await browser.close();
      await server.close();
    }
  });

async function answerConfirmation(page, button, message, accept) {
  const pending = page.waitForEvent("dialog");
  const click = button.click();
  const dialog = await pending;
  assert.equal(dialog.type(), "confirm");
  assert.equal(dialog.message(), message);
  if (accept) await dialog.accept();
  else await dialog.dismiss();
  await click;
}
for (const [engine, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
])
  test(`${engine}: exercise and set deletion requires consent and preserves recorded results`, async () => {
    const browser = await type.launch();
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      const { setup, seed } = await import("./fixtures.js");
      const { encodeBackup } = await import(
        "../dist/infrastructure/storage.js"
      );
      const { app, clock } = setup();
      const { a, b, exercise } = seed(app);
      app.start(b);
      app.complete(app.data.active.items[0].id, 0);
      app.finish([]);
      app.start(a);
      app.complete(app.data.active.items[0].id, 0);
      app.addExercise(exercise);
      await page.goto(url);
      await openMoreDestination(page, "Backup & restore");
      await page.locator("#import-file").setInputFiles({
        name: "workout.json",
        mimeType: "application/json",
        buffer: Buffer.from(encodeBackup(app.data, clock.iso())),
      });
      await page
        .getByRole("button", { name: "Replace all data", exact: true })
        .click();
      await page.getByRole("button", { name: "Resume workout ↗" }).click();
      const stored = () =>
        page.evaluate(() => localStorage.getItem("fitty.fitness.v1"));
      const before = await stored();
      const cards = page.locator("details.workout-exercise");
      await cards.nth(1).locator("summary").click();
      const deleteSet = cards
        .nth(1)
        .locator('[data-action="remove-set"]')
        .nth(2);
      const setMessage = "Delete set 3 from “Chest press” for this workout?";
      await answerConfirmation(page, deleteSet, setMessage, false);
      assert.equal(await stored(), before);
      assert.equal(
        await cards.nth(1).locator(".set-grid:not(.header)").count(),
        3,
      );
      await answerConfirmation(page, deleteSet, setMessage, true);
      assert.equal(
        await cards.nth(1).locator(".set-grid:not(.header)").count(),
        2,
      );
      let data = JSON.parse(await stored()).data;
      assert.equal(data.active.items[1].sets.length, 2);
      assert.deepEqual(data.active.items[0], app.data.active.items[0]);
      const afterSet = await stored();
      const remove = cards
        .nth(1)
        .getByRole("button", { name: "Remove", exact: true });
      const exerciseMessage =
        "Remove “Chest press” and its sets from this workout?";
      await answerConfirmation(page, remove, exerciseMessage, false);
      assert.equal(await stored(), afterSet);
      await answerConfirmation(page, remove, exerciseMessage, true);
      assert.equal(await cards.count(), 1);
      const afterRemoval = await stored();
      await cards.first().locator("summary").click();
      await answerConfirmation(
        page,
        cards.first().locator('[data-action="remove-set"]').first(),
        "Delete set 1 from “Chest press” for this workout?",
        true,
      );
      await page
        .getByRole("alert")
        .getByText(/Undo completion/)
        .waitFor();
      assert.equal(await stored(), afterRemoval);
      await answerConfirmation(
        page,
        cards.first().getByRole("button", { name: "Remove", exact: true }),
        exerciseMessage,
        true,
      );
      await page
        .getByRole("alert")
        .getByText(/Recorded results/)
        .waitFor();
      assert.equal(await stored(), afterRemoval);
      data = JSON.parse(afterRemoval).data;
      assert.deepEqual(data.plans, app.data.plans);
      assert.deepEqual(data.sessions, app.data.sessions);
      await page.reload();
      await page.getByRole("button", { name: "Resume workout ↗" }).click();
      assert.equal(await cards.count(), 1);
      assert.equal(await stored(), afterRemoval);
      await page.getByRole("button", { name: "Plans", exact: true }).click();
      await page
        .getByRole("button", { name: "Edit plan", exact: true })
        .first()
        .click();
      const editor = page.getByRole("dialog");
      const planDeleteSet = editor
        .locator('[data-action="plan-remove-set"]')
        .nth(2);
      const planSetMessage =
        "Delete set 3 from “Chest press” in this plan? Changes apply when you save the plan.";
      await answerConfirmation(page, planDeleteSet, planSetMessage, false);
      assert.equal(
        await editor.locator('[data-action="plan-remove-set"]').count(),
        3,
      );
      await answerConfirmation(page, planDeleteSet, planSetMessage, true);
      assert.equal(
        await editor.locator('[data-action="plan-remove-set"]').count(),
        2,
      );
      const planRemove = editor.locator('[data-action="plan-remove"]');
      const planMessage =
        "Remove “Chest press” from this plan? Changes apply when you save the plan.";
      await answerConfirmation(page, planRemove, planMessage, false);
      assert.equal(await planRemove.count(), 1);
      await answerConfirmation(page, planRemove, planMessage, true);
      assert.equal(await planRemove.count(), 0);
      assert.equal(await stored(), afterRemoval);
      await editor.getByRole("button", { name: "Cancel", exact: true }).click();
      assert.equal(await stored(), afterRemoval);
    } finally {
      await browser.close();
    }
  });

for (const [engine, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
])
  test(`${engine}: hold and drag exercises, touch scrolling, cancellation and keyboard reordering`, async () => {
    const browser = await type.launch();
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      const { setup } = await import("./fixtures.js");
      const { encodeBackup } = await import(
        "../dist/infrastructure/storage.js"
      );
      const { app, clock } = setup();
      for (const name of ["Press", "Row", "Curl"])
        app.exercise({ name, number: "" });
      app.plan({
        name: "A",
        rest: 0,
        items: app.data.exercises.map((e) => app.makeItem(e.id)),
      });
      app.start(app.data.plans[0].id);
      app.complete(app.data.active.items[0].id, 0);
      app.finish([]);
      app.start(app.data.plans[0].id);
      app.complete(app.data.active.items[0].id, 0);
      app.skip(app.data.active.items[1].id);
      const initial = structuredClone(app.data);
      const ids = initial.active.items.map((i) => i.id);
      await page.goto(url);
      await openMoreDestination(page, "Backup & restore");
      await page.locator("#import-file").setInputFiles({
        name: "drag.json",
        mimeType: "application/json",
        buffer: Buffer.from(encodeBackup(initial, clock.iso())),
      });
      await page
        .getByRole("button", { name: "Replace all data", exact: true })
        .click();
      await page.getByRole("button", { name: "Resume workout ↗" }).click();
      await page.clock.install();
      const cards = page.locator("details.workout-exercise");
      const order = () =>
        cards.evaluateAll((elements) =>
          elements.map((e) => e.dataset.exerciseId),
        );
      const stored = () =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("fitty.fitness.v1")).data,
        );
      const point = async (index) => {
        const box = await cards.nth(index).locator("summary").boundingBox();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      };
      const first = await point(0);
      await page.mouse.move(first.x, first.y);
      await page.mouse.down();
      await page.mouse.move(first.x, first.y + 25);
      await page.clock.runFor(500);
      assert.equal(await page.locator(".exercise-drag-preview").count(), 0);
      await page.mouse.up();
      assert.deepEqual(await stored(), initial);
      const start = await point(0),
        end = await point(2);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.clock.runFor(450);
      assert.equal(await page.locator(".exercise-drag-preview").count(), 1);
      await page.mouse.move(end.x, end.y + 20);
      await page.mouse.up();
      assert.deepEqual(await order(), [ids[1], ids[2], ids[0]]);
      let data = await stored();
      assert.deepEqual(data.active.items, [
        initial.active.items[1],
        initial.active.items[2],
        initial.active.items[0],
      ]);
      assert.deepEqual(data.plans, initial.plans);
      assert.deepEqual(data.sessions, initial.sessions);
      assert.equal(await page.locator(".exercise-drag-preview").count(), 0);
      const snapshot = await stored();
      const origin = await point(0),
        destination = await point(1);
      await page.mouse.move(origin.x, origin.y);
      await page.mouse.down();
      await page.clock.runFor(450);
      await page.mouse.move(destination.x, destination.y + 20);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      assert.deepEqual(await order(), [ids[1], ids[2], ids[0]]);
      assert.deepEqual(await stored(), snapshot);
      // Real DOM touch events exercise prevention only after a successful hold.
      const touch = async (type, index, yOffset = 0) =>
        page.evaluate(
          ({ type, index, yOffset }) => {
            const card = document.querySelectorAll("details.workout-exercise")[
              index
            ];
            const rect = (
              type === "touchmove" ? card : card.querySelector("summary")
            ).getBoundingClientRect();
            const event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(event, "touches", {
              value:
                type === "touchend" || type === "touchcancel"
                  ? []
                  : [
                      {
                        clientX: rect.left + 30,
                        clientY: rect.top + rect.height / 2 + yOffset,
                      },
                    ],
            });
            card.querySelector("summary").dispatchEvent(event);
            return event.defaultPrevented;
          },
          { type, index, yOffset },
        );
      await touch("touchstart", 0);
      assert.equal(await touch("touchmove", 0, 30), false);
      await page.clock.runFor(450);
      assert.equal(await page.locator(".exercise-drag-preview").count(), 0);
      await touch("touchend", 0);
      await touch("touchstart", 0);
      await page.clock.runFor(450);
      assert.equal(await touch("touchmove", 2, 60), true);
      await touch("touchend", 2);
      assert.deepEqual(await order(), [ids[2], ids[0], ids[1]]);
      const touchSaved = await stored();
      await touch("touchstart", 0);
      await page.clock.runFor(450);
      await touch("touchmove", 2, 60);
      await touch("touchcancel", 2);
      assert.deepEqual(await order(), [ids[2], ids[0], ids[1]]);
      assert.deepEqual(await stored(), touchSaved);
      if (engine === "chromium") {
        for (const summary of await page
          .locator("details.workout-exercise[open] > summary")
          .all())
          await summary.click();
        const cdp = await context.newCDPSession(page);
        const nativeDrag = async (from, to) => {
          const start = await point(from),
            end = await point(to);
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: start.x, y: start.y, id: 1 }],
          });
          await page.clock.runFor(450);
          assert.equal(await page.locator(".exercise-drag-preview").count(), 1);
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [
              { x: end.x, y: end.y + (to > from ? 30 : -30), id: 1 },
            ],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
        };
        await nativeDrag(0, 1);
        assert.deepEqual(await order(), [ids[0], ids[2], ids[1]]);
        await nativeDrag(1, 0);
        assert.deepEqual(await order(), [ids[2], ids[0], ids[1]]);
      }
      await cards.nth(2).locator("summary").focus();
      await page.keyboard.press("Alt+ArrowUp");
      assert.deepEqual(await order(), [ids[2], ids[1], ids[0]]);
      assert.equal(
        await cards
          .nth(1)
          .locator("summary")
          .evaluate((e) => e === document.activeElement),
        true,
      );
      const beforeScroll = await stored();
      await cards.last().scrollIntoViewIfNeeded();
      const scrollStart = await page.evaluate(() => window.scrollY);
      const edgeStart = await point(2);
      await page.mouse.move(edgeStart.x, edgeStart.y);
      await page.mouse.down();
      await page.clock.runFor(450);
      await page.mouse.move(edgeStart.x, 839);
      await page.clock.runFor(160);
      assert((await page.evaluate(() => window.scrollY)) > scrollStart);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      assert.deepEqual(await stored(), beforeScroll);
      assert.deepEqual(await order(), [ids[2], ids[1], ids[0]]);
      await page.reload();
      await page.getByRole("button", { name: "Resume workout ↗" }).click();
      assert.deepEqual(await order(), [ids[2], ids[1], ids[0]]);
      data = await stored();
      assert.deepEqual(data.plans, initial.plans);
      assert.deepEqual(data.sessions, initial.sessions);
      for (const item of data.active.items)
        assert.deepEqual(
          item,
          initial.active.items.find((i) => i.id === item.id),
        );
    } finally {
      await browser.close();
    }
  });

for (const [engine, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
])
  test(`${engine}: delete history with consent, persistence, empty state and failure recovery`, async () => {
    const browser = await type.launch();
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      const { setup, seed } = await import("./fixtures.js");
      const { encodeBackup } = await import(
        "../dist/infrastructure/storage.js"
      );
      const { app, clock, tick } = setup(),
        { a, b } = seed(app);
      app.start(a);
      app.complete(app.data.active.items[0].id, 0);
      app.finish([]);
      tick(86400000);
      app.start(b);
      app.complete(app.data.active.items[0].id, 0);
      app.finish([]);
      app.start(a);
      const before = structuredClone(app.data);
      await page.goto(url);
      await openMoreDestination(page, "Backup & restore");
      await page.locator("#import-file").setInputFiles({
        name: "history.json",
        mimeType: "application/json",
        buffer: Buffer.from(encodeBackup(before, clock.iso())),
      });
      await page
        .getByRole("button", { name: "Replace all data", exact: true })
        .click();
      await page.getByRole("button", { name: "History", exact: true }).click();
      const stored = () =>
        page.evaluate(() => localStorage.getItem("fitty.fitness.v1"));
      const raw = await stored();
      const entry = page.locator(
        `[data-session-id="${before.sessions[1].id}"]`,
      );
      await entry.locator("summary").click();
      await assertHistoryActionPlacement(page, entry);
      const message =
        "Delete “B” from 12.11.2026? This permanently removes its recorded results.";
      await answerConfirmation(
        page,
        entry.getByRole("button", { name: "Delete workout", exact: true }),
        message,
        false,
      );
      assert.equal(await stored(), raw);
      assert.equal(await page.locator("[data-session-id]").count(), 2);
      await entry.locator("summary").click();
      await page.evaluate(() => {
        window.savedSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = () => {
          throw new Error("Quota");
        };
      });
      await answerConfirmation(
        page,
        entry.getByRole("button", { name: "Delete workout", exact: true }),
        message,
        true,
      );
      await page
        .getByRole("alert")
        .getByText(/Could not save/)
        .waitFor();
      assert.equal(await stored(), raw);
      assert.equal(await page.locator("[data-session-id]").count(), 2);
      await page.evaluate(() => {
        Storage.prototype.setItem = window.savedSetItem;
        delete window.savedSetItem;
      });
      await entry.locator("summary").click();
      await answerConfirmation(
        page,
        entry.getByRole("button", { name: "Delete workout", exact: true }),
        message,
        true,
      );
      await page
        .getByText("Workout deleted from history.", { exact: true })
        .waitFor();
      assert.equal(await entry.count(), 0);
      let data = JSON.parse(await stored()).data;
      assert.deepEqual(data, { ...before, sessions: [before.sessions[0]] });
      await page.reload();
      await page.getByRole("button", { name: "History", exact: true }).click();
      assert.equal(await page.locator("[data-session-id]").count(), 1);
      const remaining = page.locator("[data-session-id]");
      await remaining.locator("summary").click();
      await answerConfirmation(
        page,
        remaining.getByRole("button", { name: "Delete workout", exact: true }),
        "Delete “A” from 11.11.2026? This permanently removes its recorded results.",
        true,
      );
      await page
        .getByText("Your finished workouts will appear here.", { exact: true })
        .waitFor();
      data = JSON.parse(await stored()).data;
      assert.deepEqual(data, { ...before, sessions: [] });
      await page.getByRole("button", { name: "Workout", exact: true }).click();
      assert.equal(
        await page.locator("details.workout-exercise").count(),
        before.active.items.length,
      );
    } finally {
      await browser.close();
    }
  });

async function assertHistoryActionPlacement(page, entry) {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const count = await entry.locator(".history-actions p").boundingBox();
    const button = await entry
      .getByRole("button", { name: "Delete workout", exact: true })
      .boundingBox();
    assert(count.x + count.width <= button.x);
    assert(
      Math.abs(count.y + count.height / 2 - button.y - button.height / 2) < 1,
    );
    assert(button.height >= 44);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
  }
}

for (const [engine, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
])
  test(`${engine}: compact navigation and More menu`, async () => {
    const browser = await type.launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    try {
      await page.goto(url);
      const main = page.getByRole("navigation", {
        name: "Main navigation",
        exact: true,
      });
      const toggle = page.getByRole("button", { name: "More", exact: true });
      const menu = page.getByRole("navigation", {
        name: "More navigation",
        exact: true,
      });
      await toggle.waitFor();
      assert.deepEqual(await main.getByRole("button").allTextContents(), [
        "Home",
        "Plans",
        "Workout",
        "History",
      ]);
      assert(!(await menu.isVisible()));
      const before = await page.evaluate(() =>
        localStorage.getItem("fitty.fitness.v1"),
      );
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await toggle.tap();
        await menu.waitFor();
        assert.deepEqual(await menu.getByRole("button").allTextContents(), [
          "Exercises",
          "Backup & restore",
        ]);
        for (const button of [
          ...(await main.getByRole("button").all()),
          ...(await menu.getByRole("button").all()),
          toggle,
        ]) {
          const box = await button.boundingBox();
          assert(box.width >= 44 && box.height >= 44);
        }
        const box = await menu.boundingBox();
        assert(box.x >= 0 && box.x + box.width <= width);
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.keyboard.press("Escape");
        assert(!(await menu.isVisible()));
        assert(await toggle.evaluate((el) => el === document.activeElement));
        await page.keyboard.press("Enter");
        await menu.waitFor();
        await page.keyboard.press("Tab");
        assert.equal(await page.locator(":focus").textContent(), "Exercises");
        await page.keyboard.press("Enter");
        await page
          .getByRole("button", { name: "+ Add exercise", exact: true })
          .waitFor();
        assert(!(await menu.isVisible()));
        assert(await toggle.evaluate((el) => el.classList.contains("active")));
        await openMoreDestination(page, "Backup & restore");
        await page
          .getByRole("heading", { name: "Export a backup", exact: true })
          .waitFor();
        assert(!(await menu.isVisible()));
        await toggle.tap();
        await page.locator(".brand").tap();
        assert(!(await menu.isVisible()));
        for (const name of ["Home", "Plans", "Workout", "History"]) {
          await main.getByRole("button", { name, exact: true }).tap();
          assert(
            await main
              .getByRole("button", { name, exact: true })
              .evaluate((el) => el.classList.contains("active")),
          );
          assert(
            !(await toggle.evaluate((el) => el.classList.contains("active"))),
          );
        }
      }
      assert.equal(
        await page.evaluate(() => localStorage.getItem("fitty.fitness.v1")),
        before,
      );
    } finally {
      await context.close();
      await browser.close();
    }
  });

for (const [engine, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
])
  for (const locale of ["de-DE", "en-US"])
    test(`${engine}/${locale}: German decimal editing, review, history, backup and prefilling`, async () => {
      const browser = await type.launch();
      const context = await browser.newContext({
        locale,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        acceptDownloads: true,
      });
      const page = await context.newPage();
      try {
        const { setup, seed } = await import("./fixtures.js");
        const { encodeBackup } = await import(
          "../dist/infrastructure/storage.js"
        );
        const { readFile } = await import("node:fs/promises");
        const { app, clock } = setup();
        const { a } = seed(app);
        app.exercise({ name: "Timed hold", number: "H", kind: "isometric" });
        const plan = structuredClone(app.data.plans[0]);
        plan.items[0].sets[0].weight = 12.75;
        const timed = app.makeItem(app.data.exercises.at(-1).id);
        timed.sets[0].durationSeconds = 30.5;
        plan.items.push(timed);
        app.plan(plan, a);
        app.start(a);
        app.set(app.data.active.items[0].id, 0, { weight: 40.5, reps: 9 });
        app.complete(app.data.active.items[0].id, 0);
        app.finish([]);
        await page.goto(url);
        await openMoreDestination(page, "Backup & restore");
        await page.locator("#import-file").setInputFiles({
          name: "decimal.json",
          mimeType: "application/json",
          buffer: Buffer.from(encodeBackup(app.data, clock.iso())),
        });
        await page
          .getByRole("button", { name: "Replace all data", exact: true })
          .click();
        await page
          .getByRole("button", { name: "History", exact: true })
          .click();
        await page.locator("details.card summary").first().click();
        assert(
          (await page.locator(".history-sets").first().innerText()).includes(
            "40,5 kg",
          ),
        );
        await page.getByRole("button", { name: "Plans", exact: true }).click();
        await page
          .getByRole("button", { name: "Edit plan", exact: true })
          .first()
          .click();
        const weight = page.getByLabel("Chest press set 1 weight", {
          exact: true,
        });
        const duration = page.getByLabel("Timed hold set 1 duration seconds", {
          exact: true,
        });
        assert.equal(await weight.inputValue(), "12,75");
        assert.equal(await weight.getAttribute("inputmode"), "decimal");
        assert.equal(await duration.inputValue(), "30,5");
        await weight.fill("15.25");
        await weight.blur();
        assert.equal(await weight.inputValue(), "15,25");
        await duration.fill("30,75");
        await duration.blur();
        await page
          .getByLabel("Chest press set 1 repetitions", { exact: true })
          .fill("8");
        await page
          .getByRole("button", { name: "Save plan", exact: true })
          .click();
        const stored = () =>
          page.evaluate(
            () => JSON.parse(localStorage.getItem("fitty.fitness.v1")).data,
          );
        let data = await stored();
        assert.equal(data.plans[0].items[0].sets[0].weight, 15.25);
        assert.equal(data.plans[0].items[1].sets[0].durationSeconds, 30.75);
        await page
          .getByRole("button", { name: "Start ↗", exact: true })
          .first()
          .click();
        const card = page.locator("details.workout-exercise").first();
        await card.locator("summary").click();
        assert.equal(await weight.inputValue(), "40,5");
        await card.getByText(/Target 15,25 kg × 8/).waitFor();
        await weight.fill("");
        await weight.blur();
        assert.equal((await stored()).active.items[0].sets[0].weight, null);
        await weight.fill("0");
        await weight.blur();
        assert.equal((await stored()).active.items[0].sets[0].weight, 0);
        await weight.fill("42,75");
        await weight.blur();
        const before = await stored();
        for (const invalid of ["1.234,5", "-1", "1e3"]) {
          await weight.fill(invalid);
          await weight.blur();
          await page.getByRole("alert").waitFor();
          assert.deepEqual(await stored(), before);
          assert.equal(await weight.inputValue(), "42,75");
        }
        const reps = page.getByLabel("Chest press set 1 repetitions", {
          exact: true,
        });
        await reps.fill("8.5");
        await reps.blur();
        assert.deepEqual(await stored(), before);
        await weight.fill("43,25");
        await weight.blur();
        await card
          .getByRole("button", { name: "○", exact: true })
          .first()
          .click();
        await card.getByRole("button", { name: "+ Set", exact: true }).click();
        const timedCard = page.locator("details.workout-exercise").nth(1);
        await timedCard.locator("summary").click();
        assert.equal(await duration.inputValue(), "30,75");
        await duration.fill("45,25");
        await duration.blur();
        await page
          .getByRole("button", { name: "Review & finish →", exact: true })
          .click();
        const review = page.getByRole("dialog");
        assert((await review.innerText()).includes("Before: 15,25 kg × 8;"));
        assert((await review.innerText()).includes("After: 15,25 kg × 8;"));
        assert(!(await review.innerText()).includes("15.25 kg"));
        await page
          .getByRole("button", { name: "Save finished workout", exact: true })
          .click();
        await page.locator("details.card summary").first().click();
        assert(
          (await page.locator(".history-sets").first().innerText()).includes(
            "43,25 kg",
          ),
        );
        await page.getByRole("button", { name: "Plans", exact: true }).click();
        await page
          .getByRole("button", { name: "Start ↗", exact: true })
          .nth(1)
          .click();
        await page.locator("details.workout-exercise summary").first().click();
        assert.equal(await weight.inputValue(), "43,25");
        await page.reload();
        await page
          .getByRole("button", { name: "Resume workout ↗", exact: true })
          .click();
        await page.locator("details.workout-exercise summary").first().click();
        assert.equal(await weight.inputValue(), "43,25");
        await openMoreDestination(page, "Backup & restore");
        const downloadEvent = page.waitForEvent("download");
        await page
          .getByRole("button", { name: "Download JSON backup ↗", exact: true })
          .click();
        const download = await downloadEvent;
        const backup = JSON.parse(
          await readFile(await download.path(), "utf8"),
        );
        assert.equal(backup.data.active.items[0].sets[0].weight, 43.25);
        assert.equal(
          typeof backup.data.active.items[0].sets[0].weight,
          "number",
        );
        assert.equal(
          backup.data.plans[0].items[1].sets[0].durationSeconds,
          30.75,
        );
      } finally {
        await context.close();
        await browser.close();
      }
    });

for (const [engine, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
])
  test(`${engine}: unused plan deletion requires confirmation and protects workout links`, async () => {
    const browser = await type.launch();
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      const { setup, seed } = await import("./fixtures.js");
      const { app } = setup();
      const { a, b } = seed(app);
      app.start(a);
      app.complete(app.data.active.items[0].id, 0);
      app.finish([]);
      app.start(b);
      app.duplicate(a);
      const unused = app.data.plans.at(-1).id;
      const before = structuredClone(app.data);
      await page.goto(url);
      await page.evaluate(
        (data) =>
          localStorage.setItem(
            "fitty.fitness.v1",
            JSON.stringify({ schemaVersion: 1, data }),
          ),
        before,
      );
      await page.reload();
      await page.getByRole("button", { name: "Plans", exact: true }).click();
      const deletion = (id) =>
        page.locator(`[data-action="delete-plan"][data-arg="${id}"]`);
      assert(await deletion(a).isDisabled());
      assert(await deletion(b).isDisabled());
      await page
        .getByText(
          "This plan has workout history. Archive it to keep its workouts.",
          { exact: true },
        )
        .waitFor();
      await page
        .getByText(
          "This plan has an active workout. Finish or discard it first.",
          { exact: true },
        )
        .waitFor();
      assert(
        await page
          .locator(`[data-action="archive-plan"][data-arg="${a}"]`)
          .isEnabled(),
      );
      const stored = () =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("fitty.fitness.v1")).data,
        );
      const message =
        "Delete “A copy”? This removes the plan from your rotation. Exercises and workouts will be kept.";
      await answerConfirmation(page, deletion(unused), message, false);
      assert.deepEqual(await stored(), before);
      await answerConfirmation(page, deletion(unused), message, true);
      await deletion(unused).waitFor({ state: "detached" });
      const after = await stored();
      assert.deepEqual(after.sessions, before.sessions);
      assert.deepEqual(after.active, before.active);
      assert.deepEqual(after.exercises, before.exercises);
      assert.equal(after.rotation[after.next], b);
      assert(!after.plans.some((plan) => plan.id === unused));
      await page.reload();
      await page.getByRole("button", { name: "Plans", exact: true }).click();
      assert.equal(await deletion(unused).count(), 0);
      assert(await deletion(a).isDisabled());
      assert(await deletion(b).isDisabled());
      await openMoreDestination(page, "Backup & restore");
      const pending = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download JSON backup ↗" })
        .click();
      const download = await pending;
      const { readFile } = await import("node:fs/promises");
      const backup = await readFile(await download.path());
      assert.deepEqual(JSON.parse(backup).data, after);
      await page.locator("#import-file").setInputFiles({
        name: "backup.json",
        mimeType: "application/json",
        buffer: backup,
      });
      await page
        .getByRole("button", { name: "Replace all data", exact: true })
        .click();
      assert.deepEqual(await stored(), after);
    } finally {
      await browser.close();
    }
  });

for (const [engine, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  test(`${engine}: F12 plan export → preview → update → additive offline import`, async () => {
    const browser = await type.launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
    });
    const page = await context.newPage();
    try {
      const { setup, seed } = await import("./fixtures.js");
      const { app } = setup();
      const { a } = seed(app);
      app.start(a);
      app.complete(app.data.active.items[0].id, 0);
      app.finish([]);
      app.start(a);
      const before = structuredClone(app.data);
      await page.goto(url);
      // Complete initial installation before the fixture reload.
      await page.waitForFunction(
        () => navigator.serviceWorker.controller !== null,
      );
      await page.evaluate(
        (data) =>
          localStorage.setItem(
            "fitty.fitness.v1",
            JSON.stringify({ schemaVersion: 1, data }),
          ),
        before,
      );
      await page.reload();
      await page.waitForFunction(
        () => navigator.serviceWorker.controller !== null,
      );
      await page.getByRole("button", { name: "Plans", exact: true }).click();
      const cardAction = (action) =>
        page.locator(`[data-action="${action}"][data-arg="${a}"]`);
      const stored = () =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("fitty.fitness.v1")).data,
        );
      const pending = page.waitForEvent("download");
      await cardAction("export-plan").click();
      const downloaded = await pending;
      assert.match(downloaded.suggestedFilename(), /^fitty-plan-A-/);
      const { readFile } = await import("node:fs/promises");
      const file = JSON.parse(await readFile(await downloaded.path(), "utf8"));
      assert.equal(file.format, "fitty-plan");
      assert(!("sessions" in file));
      file.plan.name = "Revised A";
      file.plan.rest = 45;
      file.plan.items[0].sets[0].weight = 12.75;
      const upload = () =>
        page.locator("#plan-file").setInputFiles({
          name: "plan.json",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(file)),
        });
      await cardAction("import-plan").click();
      await upload();
      await page
        .getByRole("dialog")
        .getByText("12,75 kg × 10", { exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      assert.deepEqual(await stored(), before);
      await cardAction("import-plan").click();
      await page.locator("#plan-file").setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from("{}"),
      });
      await page.getByRole("dialog").getByRole("alert").waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Update plan", exact: true })
          .count(),
        0,
      );
      assert.deepEqual(await stored(), before);
      await upload();
      await page
        .getByRole("button", { name: "Update plan", exact: true })
        .waitFor();
      await page.evaluate(() => {
        window.savedSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = () => {
          throw new Error("Quota");
        };
      });
      await page
        .getByRole("button", { name: "Update plan", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("alert")
        .getByText(/Could not save/)
        .waitFor();
      assert.deepEqual(await stored(), before);
      await page.evaluate(() => {
        Storage.prototype.setItem = window.savedSetItem;
        delete window.savedSetItem;
      });
      await page
        .getByRole("button", { name: "Update plan", exact: true })
        .click();
      const updated = await stored();
      assert.equal(updated.plans[0].name, "Revised A");
      assert.equal(updated.plans[0].version, 2);
      for (const key of ["sessions", "active", "exercises", "rotation", "next"])
        assert.deepEqual(updated[key], before[key]);
      await page.reload();
      await page.getByRole("button", { name: "Plans", exact: true }).click();
      if (engine === "webkit")
        await page.route("**/*", (route) =>
          route.abort("internetdisconnected"),
        );
      else await context.setOffline(true);
      await page
        .getByRole("button", { name: "Import plan…", exact: true })
        .click();
      file.exercises[0].number = "999";
      await upload();
      const mapping = page
        .getByRole("dialog")
        .locator('[data-field="plan-mapping"]');
      assert.equal(await mapping.inputValue(), "new");
      await mapping.selectOption(before.exercises[0].id);
      await page
        .getByRole("dialog")
        .getByText(/0 new machine records/)
        .waitFor();
      await page
        .getByRole("button", { name: "Add imported plan", exact: true })
        .click();
      const after = await stored();
      assert.equal(after.plans.length, 3);
      assert.equal(after.plans[2].name, "Revised A (2)");
      assert.deepEqual(after.rotation, before.rotation);
      assert.deepEqual(after.exercises, before.exercises);
      assert.equal(after.plans[2].items[0].number, "12");
      assert.deepEqual(after.sessions, before.sessions);
      assert.deepEqual(after.active, before.active);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    } finally {
      await browser.close();
    }
  });
}

for (const [engine, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  test(`${engine}: F13 history exports all sets as a dated plan without targets or completion flags`, async () => {
    const browser = await type.launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
    });
    const page = await context.newPage();
    try {
      const { setup, seed } = await import("./fixtures.js");
      const { app } = setup();
      const { a, b, exercise } = seed(app);
      app.exercise({ name: "Cross trainer", number: "7", kind: "cardio" });
      app.start(a);
      app.set(app.data.active.items[0].id, 0, { weight: 12.75, reps: 8 });
      app.complete(app.data.active.items[0].id, 0);
      app.addExercise(exercise);
      app.addExercise(app.data.exercises[1].id);
      app.set(app.data.active.items[2].id, 0, { durationSeconds: 90 });
      app.finish([]);
      app.start(a);
      app.finish([]); // A fully skipped workout is exportable too.
      const noResultsId = app.data.sessions[1].id;
      app.exercise({ name: "Renamed press", number: "99" }, exercise);
      app.start(b);
      const before = structuredClone(app.data);
      await page.goto(url);
      // Finish initial offline installation before a fixture reload can interrupt it.
      await page.waitForFunction(
        () => navigator.serviceWorker.controller !== null,
      );
      await page.evaluate(
        (data) =>
          localStorage.setItem(
            "fitty.fitness.v1",
            JSON.stringify({ schemaVersion: 1, data }),
          ),
        before,
      );
      await page.reload();
      await page.waitForFunction(
        () => navigator.serviceWorker.controller !== null,
      );
      if (engine === "webkit")
        await page.route("**/*", (route) =>
          route.abort("internetdisconnected"),
        );
      else await context.setOffline(true);
      await page.getByRole("button", { name: "History", exact: true }).click();
      const stored = () =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("fitty.fitness.v1")).data,
        );
      const entry = page.locator(
        `[data-session-id="${before.sessions[0].id}"]`,
      );
      await entry.locator("summary").click();
      await assertHistoryActionPlacement(page, entry);
      const pending = page.waitForEvent("download");
      await entry
        .getByRole("button", { name: "Export as plan", exact: true })
        .click();
      const downloaded = await pending;
      assert.match(
        downloaded.suggestedFilename(),
        /^fitty-workout-2026-11-11-/,
      );
      const { readFile } = await import("node:fs/promises");
      const bytes = await readFile(await downloaded.path());
      const file = JSON.parse(bytes);
      assert.equal(file.format, "fitty-plan");
      assert.equal(file.schemaVersion, 2);
      assert.equal(file.workout.id, before.sessions[0].id);
      assert.equal(file.workout.date, "2026-11-11");
      assert.deepEqual(
        file.plan.items.map((i) => i.sets.length),
        [3, 3, 1],
      );
      assert.deepEqual(
        file.plan.items.map((i) => i.skipped),
        [false, true, true],
      );
      assert.equal(file.plan.items[0].sets[0].weight, 12.75);
      assert.equal(file.plan.items[0].sets[1].weight, 0);
      assert.equal(file.exercises[0].number, "12");
      for (const item of file.plan.items)
        for (const set of item.sets) {
          assert(!("target" in set));
          assert(!("done" in set));
        }
      assert.deepEqual(await stored(), before);
      const skippedEntry = page.locator(`[data-session-id="${noResultsId}"]`);
      await skippedEntry.locator("summary").click();
      const skippedPending = page.waitForEvent("download");
      await skippedEntry
        .getByRole("button", { name: "Export as plan", exact: true })
        .click();
      const skippedFile = JSON.parse(
        await readFile(await (await skippedPending).path(), "utf8"),
      );
      assert.equal(skippedFile.plan.items[0].sets.length, 3);
      assert.equal(skippedFile.plan.items[0].skipped, true);
      assert.deepEqual(await stored(), before);
      await page.getByRole("button", { name: "Plans", exact: true }).click();
      await page
        .getByRole("button", { name: "Import plan…", exact: true })
        .click();
      await page.locator("#plan-file").setInputFiles({
        name: "workout.json",
        mimeType: "application/json",
        buffer: bytes,
      });
      await page
        .getByRole("dialog")
        .getByText(/Source workout: 11.11.2026/)
        .waitFor();
      assert.equal(
        await page
          .getByRole("dialog")
          .getByText("· Skipped in source workout", { exact: true })
          .count(),
        2,
      );
      await page
        .getByRole("dialog")
        .getByText("12,75 kg × 8", { exact: true })
        .waitFor();
      assert(
        await page
          .getByRole("dialog")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      );
      await page
        .getByRole("button", { name: "Add imported plan", exact: true })
        .click();
      const after = await stored();
      assert.deepEqual(after.sessions, before.sessions);
      assert.deepEqual(after.active, before.active);
      assert.deepEqual(after.rotation, before.rotation);
      assert.equal(after.plans.length, before.plans.length + 1);
      assert(after.plans.at(-1).items.every((i) => !("skipped" in i)));
      assert.deepEqual(
        after.plans.at(-1).items.map((i) => i.sets.length),
        [3, 3, 1],
      );
    } finally {
      await browser.close();
    }
  });
}
