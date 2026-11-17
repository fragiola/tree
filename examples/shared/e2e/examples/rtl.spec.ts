import { expect, test } from "@playwright/test";
import { itemAt, openExample, row, tree } from "../helpers";

// rtl: the tree sits in a right-to-left document (Arabic labels). Items are reached by their
// path; the arrows swap and the indentation grows from the right.

test("Left expands and Right collapses in a right-to-left tree", async ({
    page,
}) => {
    await openExample(page, "rtl");
    const files = tree(page, "الملفات");
    await expect(files).toHaveCSS("direction", "rtl");
    const photos = itemAt(files, "/1");
    await expect(photos).toHaveAttribute("aria-expanded", "false");
    await photos.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(photos).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(itemAt(files, "/1/0")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(photos).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(photos).toHaveAttribute("aria-expanded", "false");
});

test("a child row is indented from the right", async ({ page }) => {
    await openExample(page, "rtl");
    const files = tree(page, "الملفات");
    const toggleOf = (path: string) =>
        row(itemAt(files, path)).locator('[data-tree-part="toggle"]');
    const parent = await toggleOf("/0").boundingBox();
    const child = await toggleOf("/0/0").boundingBox();
    if (!parent || !child) throw new Error("no toggles");
    // the child's toggle is further from the right edge, by one level
    expect(child.x + child.width).toBeLessThan(parent.x + parent.width);
});
