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
      await page.reload();
      await context.setOffline(true);
      await page.reload();
      await page.getByRole("button", { name: "Resume workout ↗" }).click();
      assert.equal(
        await page
          .getByLabel("Test press set 1 weight", { exact: true })
          .inputValue(),
        "40.5",
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
    } finally {
      await browser.close();
    }
  });
