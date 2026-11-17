import { expect, test } from "@playwright/test";
import {
    dragRow,
    item,
    itemAt,
    openExample,
    row,
    tree,
    visibleNames,
} from "../helpers";

// drag-and-drop: an item's accessible name is its label (the lock icon is hidden; "Locked" is a
// description). The pointer drags go through the shared `dragRow`.

test("moves a file into a folder, and announces it", async ({ page }) => {
    const stage = await openExample(page, "drag-and-drop");
    const files = tree(page, "Project files");
    await dragRow(
        page,
        row(item(files, "README.md")),
        row(item(files, "docs")),
        0.5,
    );
    await expect(item(files, "README.md")).toHaveAttribute("aria-level", "2");
    expect(
        await item(files, "README.md").getAttribute("data-tree-path"),
    ).toMatch(/^\/1\/\d+$/);
    await expect(stage.getByRole("status")).toHaveText(
        "Moved README.md into docs.",
    );
});

test("reorders siblings, showing a line while dragging", async ({ page }) => {
    await openExample(page, "drag-and-drop");
    const files = tree(page, "Project files");
    const from = row(item(files, "main.tsx"));
    const to = row(item(files, "app.tsx"));
    const start = await from.boundingBox();
    const end = await to.boundingBox();
    if (!start || !end) throw new Error("no rows");
    await page.mouse.move(start.x + 40, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + 40, start.y + start.height / 2 + 8, {
        steps: 4,
    });
    await page.mouse.move(end.x + 40, end.y + end.height * 0.1, { steps: 8 });
    const indicator = files.locator('[data-tree-part="drop-indicator"]');
    await expect(indicator).toHaveAttribute("data-drop-position", "before");
    await expect(item(files, "main.tsx")).toHaveAttribute("data-dragging", "");
    await page.mouse.up();
    await expect(indicator).toHaveCount(0);
    await expect(itemAt(files, "/0/0")).toHaveAccessibleName("main.tsx");
    await expect(itemAt(files, "/0/1")).toHaveAccessibleName("app.tsx");
});

test("a locked item does not move, and the read-only folder takes nothing", async ({
    page,
}) => {
    await openExample(page, "drag-and-drop");
    const files = tree(page, "Project files");
    const before = await visibleNames(files);
    await expect(item(files, "LICENSE")).toHaveAccessibleDescription("Locked");

    await dragRow(
        page,
        row(item(files, "LICENSE")),
        row(item(files, "docs")),
        0.5,
    );
    expect(await visibleNames(files)).toEqual(before);

    await dragRow(
        page,
        row(item(files, "README.md")),
        row(item(files, "vendor")),
        0.5,
    );
    expect(await visibleNames(files)).toEqual(before);
    await expect(item(files, "README.md")).toHaveAttribute("aria-level", "1");
});
