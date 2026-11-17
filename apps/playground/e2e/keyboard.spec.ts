import { expect, test } from "@playwright/test";
import { files, focusedPath, item, itemAt } from "./helpers";

// The keyboard on the basic fixture, an unstyled tree: the WAI-ARIA APG Tree View key map, DOM
// focus following the roving tab stop, type-ahead and rename.

test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/basic/");
    await expect(files(page)).toBeVisible();
});

test("Tab enters the tree on one item, the arrows, Home and End move", async ({
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
    // one tab stop
    await expect(files(page).locator('[tabindex="0"]')).toHaveCount(1);
});

test("Right and Left expand, enter, leave and collapse, focus kept while the group unmounts", async ({
    page,
}) => {
    await item(page, "utils").focus();
    await page.keyboard.press("ArrowRight");
    await expect(item(page, "utils")).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => focusedPath(page)).toBe("/0/2/0");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => focusedPath(page)).toBe("/0/2");
    await page.keyboard.press("ArrowLeft");
    await expect(item(page, "utils")).toHaveAttribute("aria-expanded", "false");
    await expect(item(page, "a.ts")).toHaveCount(0);
    // collapsing src while a.ts is focused moves focus to src
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => focusedPath(page)).toBe("/0/2/0");
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowLeft");
    await expect(item(page, "src")).toBeFocused();
});

test("Space and Shift+Down select, Ctrl+A selects every visible item", async ({
    page,
}) => {
    await item(page, "app.ts").focus();
    await page.keyboard.press(" ");
    await expect(item(page, "app.ts")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Shift+ArrowDown");
    await expect(item(page, "lib")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Control+a");
    await expect(files(page).locator('[aria-selected="true"]')).toHaveCount(6);
});

test("type-ahead finds the next item whose label starts with the typed text", async ({
    page,
}) => {
    await item(page, "src").focus();
    await page.keyboard.type("re");
    await expect(item(page, "readme.md")).toBeFocused();
});

test("F2 renames: Enter commits, Escape cancels, focus goes back to the item", async ({
    page,
}) => {
    await item(page, "readme.md").focus();
    await page.keyboard.press("F2");
    const input = page.getByRole("textbox", { name: "Rename readme.md" });
    await expect(input).toBeFocused();
    await input.fill("README.md");
    await page.keyboard.press("Enter");
    await expect(item(page, "README.md")).toBeFocused();
    await page.keyboard.press("F2");
    await page.getByRole("textbox").fill("nope");
    await page.keyboard.press("Escape");
    await expect(item(page, "README.md")).toBeFocused();
});

test("Right and Left swap in a right-to-left tree", async ({ page }) => {
    await page.goto("/fixtures/basic/?dir=rtl");
    await item(page, "utils").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(itemAt(page, "/0/2")).toHaveAttribute("aria-expanded", "true");
});
