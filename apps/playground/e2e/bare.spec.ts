import { expect, test } from "@playwright/test";
import { files, focusedPath, item, row } from "./helpers";

// The bare fixture: a tree with no feature installed (the minimal core).

test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/bare/");
    await expect(files(page)).toBeVisible();
});

test("renders the items with their ARIA, and nothing about a selection", async ({
    page,
}) => {
    const tree = files(page);
    await expect(tree).not.toHaveAttribute("aria-multiselectable");
    await expect(item(page, "src")).toHaveAttribute("aria-level", "1");
    await expect(item(page, "src")).toHaveAttribute("aria-expanded", "true");
    await expect(item(page, "app.ts")).toHaveAttribute("aria-level", "2");
    await expect(tree.locator("[aria-selected]")).toHaveCount(0);
    await expect(tree.locator("[data-selected]")).toHaveCount(0);
});

test("a click focuses an item and selects nothing; Enter and Space select nothing", async ({
    page,
}) => {
    await row(item(page, "readme.md")).click();
    await expect.poll(() => focusedPath(page)).toBe("/2");
    await page.keyboard.press("Enter");
    await page.keyboard.press(" ");
    await page.keyboard.press("ControlOrMeta+a");
    await expect(files(page).locator("[aria-selected]")).toHaveCount(0);
});

test("the arrows, Home and End move one roving tab stop; Right and Left expand and collapse", async ({
    page,
}) => {
    await page.keyboard.press("Tab");
    await expect.poll(() => focusedPath(page)).toBe("/0");
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => focusedPath(page)).toBe("/0/0");
    await page.keyboard.press("End");
    await expect.poll(() => focusedPath(page)).toBe("/2");
    await page.keyboard.press("Home");
    await expect.poll(() => focusedPath(page)).toBe("/0");
    await expect(files(page).locator('[tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press("ArrowLeft");
    await expect(item(page, "src")).toHaveAttribute("aria-expanded", "false");
    await expect(item(page, "app.ts")).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await expect(item(page, "src")).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => focusedPath(page)).toBe("/0/0");
});
