import { expect, test } from "@playwright/test";
import { dragOver, files, item, row } from "./helpers";

// Drag and drop on the drag fixture: Pointer Events, the drop indicator, refused targets, the
// auto-expand of a hovered collapsed parent, Escape, and the keyboard drag.

const moves = (page: import("@playwright/test").Page) =>
    page.getByRole("list", { name: "Moves" }).getByRole("listitem");

test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/drag/");
    await expect(files(page)).toBeVisible();
});

test("a row dropped before another moves there: one item.move, announced", async ({
    page,
}) => {
    const drop = await dragOver(
        page,
        row(item(page, "readme.md")),
        row(item(page, "app.ts")),
        0.15,
    );
    await expect(files(page)).toHaveAttribute("data-dragging", "");
    await expect(item(page, "readme.md")).toHaveAttribute("data-dragging", "");
    const indicator = files(page).locator('[data-tree-part="drop-indicator"]');
    await expect(indicator).toHaveAttribute("data-drop-position", "before");
    await drop();
    await expect(item(page, "readme.md")).toHaveAttribute(
        "data-tree-path",
        "/0/0",
    );
    await expect(moves(page)).toHaveCount(1);
    await expect(files(page).getByRole("status")).toHaveText("Dropped readme");
    await expect(indicator).toHaveCount(0);
});

test("a hovered collapsed parent expands, and the drop goes inside it", async ({
    page,
}) => {
    const drop = await dragOver(
        page,
        row(item(page, "readme.md")),
        row(item(page, "utils")),
        0.5,
    );
    await expect(row(item(page, "utils"))).toHaveAttribute(
        "data-drop-position",
        "inside",
    );
    await expect(item(page, "utils")).toHaveAttribute("aria-expanded", "true");
    await drop();
    await expect(item(page, "readme.md")).toHaveAttribute("aria-level", "3");
});

test("a refused target shows no indicator and drops nothing", async ({
    page,
}) => {
    const drop = await dragOver(
        page,
        row(item(page, "readme.md")),
        row(item(page, "docs")),
        0.5,
    );
    await expect(row(item(page, "docs"))).not.toHaveAttribute(
        "data-drop-target",
    );
    await drop();
    await expect(item(page, "readme.md")).toHaveAttribute(
        "data-tree-path",
        "/2",
    );
    await expect(moves(page)).toHaveCount(0);
});

test("Escape cancels a pointer drag", async ({ page }) => {
    const drop = await dragOver(
        page,
        row(item(page, "readme.md")),
        row(item(page, "app.ts")),
        0.15,
    );
    await page.keyboard.press("Escape");
    await expect(files(page)).not.toHaveAttribute("data-dragging");
    await drop();
    await expect(moves(page)).toHaveCount(0);
});

test("the keyboard drag: Ctrl+Shift+D, the arrows, Enter", async ({ page }) => {
    await item(page, "readme.md").focus();
    await page.keyboard.press("Control+Shift+D");
    await expect(files(page)).toHaveAttribute("data-keyboard-dragging", "");
    await expect(
        files(page).locator('[data-tree-part="item"][data-drop-target]'),
    ).toHaveCount(1);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(files(page)).not.toHaveAttribute("data-keyboard-dragging");
    await expect(moves(page)).toHaveCount(1);
});
