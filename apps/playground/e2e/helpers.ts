import type { Locator, Page } from "@playwright/test";

// What the playground specs share. Like the examples' specs, they reach the tree only through
// `data-tree-part`, `data-tree-path`, roles and accessible names.

/** The fixtures' tree (each fixture page renders one, named "Files"). */
export const files = (page: Page) => page.getByRole("tree", { name: "Files" });

/** An item by its path (`/0/2`). */
export const itemAt = (scope: Page | Locator, path: string) =>
    scope.locator(`[data-tree-part="item"][data-tree-path="${path}"]`);

/** An item by its label (its accessible name). */
export const item = (scope: Page | Locator, name: string) =>
    scope.getByRole("treeitem", { name, exact: true });

/** An item's row: what a press and a drag start from. */
export const row = (itemLocator: Locator) =>
    itemLocator.locator(':scope > [data-tree-part="content"]');

/** The path of the element that has DOM focus. */
export const focusedPath = (page: Page) =>
    page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.dataset.treePath,
    );

/** A point in a locator's box: `x` 40px in, `y` at a fraction of its height. */
export async function pointIn(locator: Locator, fraction = 0.5) {
    const box = await locator.boundingBox();
    if (!box) throw new Error("no bounding box");
    return {
        x: box.x + Math.min(40, box.width / 2),
        y: box.y + box.height * fraction,
    };
}

/**
 * Presses `from` and moves past the threshold to a point at `fraction` of `to`'s height, without
 * releasing; returns the release.
 */
export async function dragOver(
    page: Page,
    from: Locator,
    to: Locator,
    fraction = 0.5,
): Promise<() => Promise<void>> {
    const start = await pointIn(from);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y + 8, { steps: 4 });
    const end = await pointIn(to, fraction);
    await page.mouse.move(end.x, end.y, { steps: 8 });
    return () => page.mouse.up();
}
