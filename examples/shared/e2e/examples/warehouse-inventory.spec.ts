import { expect, type Page, test } from "@playwright/test";
import { dragRow, itemAt, openExample, ROOT, row, tree } from "../helpers";

// warehouse-inventory: a virtualized tree of locations. An item's accessible name is its label; its
// stock (units, fill, low stock) is its description. The first bins are written out in the demo
// data: Bin D1-01-1 holds Rice (40) and Olive oil (4, under its minimum of 12), Bin D1-01-2 holds
// Pasta (110 of 120), Bin D1-01-3 is empty.

const RICE = "/0/0/0/0/0/0";
const OLIVE_OIL = "/0/0/0/0/0/1";
const BIN_1 = "/0/0/0/0/0";
const BIN_2 = "/0/0/0/0/1";
const BIN_3 = "/0/0/0/0/2";

const open = async (page: Page) => {
    const stage = await openExample(page, "warehouse-inventory");
    return { stage, locations: tree(page, "Warehouse locations") };
};

test("rows carry their stock, and low stock is flagged up the tree", async ({
    page,
}) => {
    const { stage, locations } = await open(page);
    await expect(itemAt(locations, RICE)).toHaveAccessibleName("Rice 5 kg");
    await expect(itemAt(locations, OLIVE_OIL)).toHaveAccessibleDescription(
        "4 units, low stock (minimum 12), needs dry storage",
    );
    await expect(itemAt(locations, BIN_1)).toHaveAccessibleDescription(
        "37% full, 44 of 120 units",
    );
    await expect(itemAt(locations, "/0/0/0/0")).toHaveAccessibleDescription(
        /units, \d+ low on stock$/,
    );
    await expect(stage.getByTestId("low-stock")).toHaveText(
        /^\s*\d+ low on stock\s*$/,
    );
});

test("the tree is virtualized: only the rows in view are in the DOM", async ({
    page,
}) => {
    const { stage, locations } = await open(page);
    const expanded = locations.locator(
        '[data-tree-part="item"][aria-expanded="true"]',
    );
    const before = await expanded.count();
    await stage.getByRole("button", { name: "Expand to low stock" }).click();
    await expect.poll(() => expanded.count()).toBeGreaterThan(before);
    const rows = await locations.locator('[data-tree-part="item"]').count();
    expect(rows).toBeLessThan(120);
    await expect(
        locations.locator('[data-tree-part="spacer"]').last(),
    ).toBeAttached();
});

test("a drop the storage rules refuse leaves the product in place", async ({
    page,
}) => {
    const { locations } = await open(page);
    // Bin D1-01-2 holds 110 of 120: 40 more do not fit
    await dragRow(
        page,
        row(itemAt(locations, RICE)),
        row(itemAt(locations, BIN_2)),
    );
    await expect(itemAt(locations, RICE)).toHaveAccessibleName("Rice 5 kg");
    await expect(itemAt(locations, BIN_2)).toHaveAccessibleDescription(
        "92% full, 110 of 120 units",
    );
    // the empty bin takes them
    await dragRow(
        page,
        row(itemAt(locations, RICE)),
        row(itemAt(locations, BIN_3)),
    );
    await expect(itemAt(locations, BIN_3)).toHaveAccessibleDescription(
        "33% full, 40 of 120 units",
    );
    await expect(itemAt(locations, BIN_1)).toHaveAccessibleDescription(
        "3% full, 4 of 120 units",
    );
});

test("the details panel edits a quantity under the bin's capacity", async ({
    page,
}) => {
    const { stage, locations } = await open(page);
    await row(itemAt(locations, RICE)).click();
    const details = stage.getByRole("region", { name: "Details" });
    await expect(
        details.getByRole("heading", { name: "Rice 5 kg" }),
    ).toBeVisible();
    const quantity = details.getByRole("spinbutton", { name: "Quantity" });
    await quantity.fill("200");
    await details.getByRole("button", { name: "Update" }).click();
    await expect(stage.getByTestId("details-notice")).toHaveText(
        "Bin D1-01-1 holds 120 units at most.",
    );
    await quantity.fill("50");
    await details.getByRole("button", { name: "Update" }).click();
    await expect(itemAt(locations, RICE)).toHaveAccessibleDescription(
        "50 units, needs dry storage",
    );
});

test("move to lists only the bins the rules accept", async ({ page }) => {
    const { stage, locations } = await open(page);
    await row(itemAt(locations, RICE)).click();
    const details = stage.getByRole("region", { name: "Details" });
    const bins = details.getByRole("combobox", { name: "Move to" });
    const labels = await bins.locator("option").allTextContents();
    expect(labels).toContain("Bin D1-01-3 · Dry goods");
    expect(labels.some((label) => label.includes("Cold storage"))).toBe(false);
    expect(labels).not.toContain("Bin D1-01-2 · Dry goods");
    await bins.selectOption({ label: "Bin D1-01-3 · Dry goods" });
    await details.getByRole("button", { name: "Move" }).click();
    await expect(itemAt(locations, BIN_3)).toHaveAccessibleDescription(
        "33% full, 40 of 120 units",
    );
});

test("highlighting a zone dims the rows outside it", async ({ page }) => {
    const { stage, locations } = await open(page);
    await stage.getByRole("combobox", { name: "Highlight zone" }).selectOption({
        label: "Cold storage",
    });
    await expect(itemAt(locations, "/0/0")).toHaveAttribute("data-dimmed", "");
    await expect(itemAt(locations, "/0/1")).not.toHaveAttribute("data-dimmed");
    await expect(stage.locator(ROOT)).toBeVisible();
});
