import { expect, test } from "@playwright/test";
import {
    dragRow,
    item,
    openExample,
    row,
    tree,
    visibleNames,
} from "../helpers";

// two-trees: two lists in one drag group, "Available" and "Selected", over two models (a transfer)
// or one shared model (a move). Each list has its own live region; the source list announces.

test("drags an item and a group with its children into the other list", async ({
    page,
}) => {
    await openExample(page, "two-trees");
    const available = tree(page, "Available");
    const selected = tree(page, "Selected");
    await expect(selected).toHaveAttribute("data-empty", "");
    // into the empty list
    await dragRow(page, row(item(available, "Apple")), selected, 0.3);
    await expect.poll(() => visibleNames(selected)).toEqual(["Apple"]);
    await expect(item(available, "Apple")).toHaveCount(0);
    await expect(available.getByRole("status")).toHaveText(
        "Moved Apple into Selected.",
    );
    // a group and its subtree, after Apple
    await dragRow(
        page,
        row(item(available, "Herbs")),
        row(item(selected, "Apple")),
        0.9,
    );
    await expect
        .poll(() => visibleNames(selected))
        .toEqual(["Apple", "Herbs", "Basil", "Mint"]);
    await expect(item(available, "Herbs")).toHaveCount(0);
    // and back
    await dragRow(
        page,
        row(item(selected, "Apple")),
        row(item(available, "Banana")),
        0.1,
    );
    await expect(item(available, "Apple")).toHaveAttribute("aria-level", "2");
    await expect
        .poll(() => visibleNames(selected))
        .toEqual(["Herbs", "Basil", "Mint"]);
});

test("shows the target in the list under the pointer while dragging", async ({
    page,
}) => {
    await openExample(page, "two-trees");
    const available = tree(page, "Available");
    const selected = tree(page, "Selected");
    const start = await row(item(available, "Carrot")).boundingBox();
    const end = await selected.boundingBox();
    if (!start || !end) throw new Error("no boxes");
    await page.mouse.move(start.x + 40, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + 40, start.y + start.height / 2 + 8, {
        steps: 4,
    });
    await expect(selected).toHaveAttribute("data-dragging-from-other-tree", "");
    await page.mouse.move(end.x + 40, end.y + 20, { steps: 8 });
    await expect(
        selected.locator('[data-tree-part="drop-indicator"]'),
    ).toHaveAttribute("data-drop-position", "inside");
    await expect(item(available, "Carrot")).toHaveAttribute(
        "data-dragging",
        "",
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(selected).not.toHaveAttribute("data-dragging-from-other-tree");
    await expect(selected).toHaveAttribute("data-empty", "");
});

test("a keyboard drag goes on into the other list and drops there", async ({
    page,
}) => {
    await openExample(page, "two-trees");
    const available = tree(page, "Available");
    const selected = tree(page, "Selected");
    await row(item(available, "Mint")).click();
    await page.keyboard.press("Control+Shift+D");
    await expect(available).toHaveAttribute("data-keyboard-dragging", "");
    const indicator = selected.locator(
        '[data-tree-part="drop-indicator"][data-drop-position]',
    );
    // Down past the last place of Available reaches Selected (an empty list: one place)
    for (let i = 0; i < 10 && (await indicator.count()) === 0; i++)
        await page.keyboard.press("ArrowDown");
    await expect(indicator).toHaveAttribute("data-drop-position", "inside");
    await expect(available.getByRole("status")).toHaveText(
        "Drop into Selected.",
    );
    await page.keyboard.press("Enter");
    await expect.poll(() => visibleNames(selected)).toEqual(["Mint"]);
    await expect(item(available, "Mint")).toHaveCount(0);
});

test("over one shared model, both lists show the move", async ({ page }) => {
    await openExample(page, "two-trees");
    await page.getByRole("switch", { name: "One shared model" }).click();
    const available = tree(page, "Available");
    const selected = tree(page, "Selected");
    await expect
        .poll(async () => {
            const [a, b] = await Promise.all([
                visibleNames(selected),
                visibleNames(available),
            ]);
            return a.length > 0 && a.join() === b.join();
        })
        .toBe(true);
    await dragRow(
        page,
        row(item(available, "Apple")),
        row(item(selected, "Carrot")),
        0.1,
    );
    await expect(item(selected, "Apple")).toHaveAttribute(
        "data-tree-path",
        "/1/0",
    );
    await expect(item(available, "Apple")).toHaveAttribute(
        "data-tree-path",
        "/1/0",
    );
    await expect
        .poll(async () => {
            const [a, b] = await Promise.all([
                visibleNames(selected),
                visibleNames(available),
            ]);
            return a.length > 0 && a.join() === b.join();
        })
        .toBe(true);
});
