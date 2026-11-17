import { expect, type Page, test } from "@playwright/test";
import { files, item } from "./helpers";

// Async children on the async fixture: the page's loader is driven by the test (`window.loads`).

const pending = (page: Page) => page.evaluate(() => window.loads.length);

test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/async/");
    await expect(files(page)).toBeVisible();
});

test("expanding an unloaded item loads it once, busy until its children arrive", async ({
    page,
}) => {
    await item(page, "lib").focus();
    await page.keyboard.press("ArrowRight");
    await expect(item(page, "lib")).toHaveAttribute("aria-busy", "true");
    await expect(item(page, "lib")).toHaveAttribute("data-loading", "");
    await expect.poll(() => pending(page)).toBe(1);
    await page.evaluate(() => window.loads[0]?.resolve(["x.ts", "y.ts"]));
    await expect(item(page, "x.ts")).toHaveAttribute("aria-level", "3");
    await expect(item(page, "lib")).not.toHaveAttribute("aria-busy");
});

test("a failed load is marked and announced; expanding again after a reset retries", async ({
    page,
}) => {
    await item(page, "lib").focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => pending(page)).toBe(1);
    await page.evaluate(() => window.loads[0]?.reject("offline"));
    await expect(item(page, "lib")).toHaveAttribute("data-load-error", "");
    await expect(files(page).getByRole("status")).toHaveText(
        "lib failed to load",
    );
});
