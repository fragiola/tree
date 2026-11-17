import { expect, test } from "@playwright/test";
import { focusedPath, item, itemAt, openExample, tree } from "../helpers";

// large-tree: 1 000 folders of 100 files (101 000 items, all expanded), virtualized. The DOM holds
// only a window of the rows; every item still carries its level, position and set size. An item's
// accessible name is its label.

const ITEMS = 101_000;

test("renders only a window of the 101 000 rows, each with its place in the tree", async ({
    page,
}) => {
    const stage = await openExample(page, "large-tree");
    const files = tree(page, "Large project");
    await expect(itemAt(files, "/0")).toBeVisible();
    const rendered = await files.getByRole("treeitem").count();
    expect(rendered).toBeGreaterThan(5);
    expect(rendered).toBeLessThan(120);
    await expect(itemAt(files, "/0")).toHaveAttribute("aria-setsize", "1000");
    await expect(itemAt(files, "/0/0")).toHaveAttribute("aria-level", "2");
    await expect(itemAt(files, "/0/0")).toHaveAttribute("aria-setsize", "100");
    await expect(stage.getByTestId("rendered")).toContainText(
        `of ${ITEMS.toLocaleString("en")} rows`,
    );
    // the scroll renders other rows, still a window
    await files.evaluate((element) => {
        element.scrollTop = element.scrollHeight / 2;
    });
    await expect(
        files.locator('[data-tree-path^="/49"]').first(),
    ).toBeVisible();
    expect(await files.getByRole("treeitem").count()).toBeLessThan(120);
});

test("End focuses the last item, Home the first, PageDown a page down", async ({
    page,
}) => {
    await openExample(page, "large-tree");
    const files = tree(page, "Large project");
    await itemAt(files, "/0").focus();
    await page.keyboard.press("End");
    await expect(itemAt(files, "/999/99")).toBeFocused();
    await expect(itemAt(files, "/999/99")).toBeInViewport();
    await page.keyboard.press("Home");
    await expect(itemAt(files, "/0")).toBeFocused();
    await page.keyboard.press("PageDown");
    const path = await focusedPath(page);
    expect(path).toMatch(/^\/0\/\d+$/);
    expect(Number(path?.split("/")[2])).toBeGreaterThan(2);
    // type-ahead reaches a row outside the window: the next module, 80 files below
    await page.keyboard.press("m");
    await expect(itemAt(files, "/1")).toBeFocused();
    await expect(item(files, "module 2")).toBeInViewport();
});

test("collapse all and expand all change the rows, and a keyboard drag moves a row", async ({
    page,
}) => {
    const stage = await openExample(page, "large-tree");
    const files = tree(page, "Large project");
    await stage.getByRole("button", { name: "Collapse all" }).click();
    await expect(stage.getByTestId("rendered")).toContainText("of 1,000 rows");
    await expect(itemAt(files, "/0")).toHaveAttribute("aria-expanded", "false");
    // a keyboard drag: module 1 leaves its place (into module 2, or after it), module 2 is first
    await itemAt(files, "/0").focus();
    await page.keyboard.press("ControlOrMeta+Shift+D");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(itemAt(files, "/0")).toHaveAccessibleName("module 2");
    await expect(stage.getByRole("status")).toContainText("Moved");
    await stage.getByRole("button", { name: "Expand all" }).click();
    await expect(stage.getByTestId("rendered")).toContainText(
        `of ${ITEMS.toLocaleString("en")} rows`,
    );
});
