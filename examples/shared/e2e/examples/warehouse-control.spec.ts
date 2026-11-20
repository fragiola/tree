import { expect, type Page, test } from "@playwright/test";
import { dragRow, itemAt, openExample, row, tree } from "../helpers";

// warehouse-control: a live control room. The tree (a narrow column) holds sites, zones, aisles
// and bins; an item's accessible name is its label, its stock its description. Beside it, the
// panels read the selected location (the scope). A seeded feed moves stock while it plays.
//
// Every test but the autoplay one opens the example under reduced motion, so the feed starts
// paused and the figures are the seeded ones: Bin LD1-1 holds 84 Rice, Bin LD1-2 holds 9 Olive
// oil (under its minimum of 15), Bin LD1-3 holds 112 Pasta.

const DRY = "/0/0";
const AISLE_1 = "/0/0/0";
const AISLE_2 = "/0/0/1";
const COLD = "/0/1";
const BIN_1 = "/0/0/0/0";
const BIN_2 = "/0/0/0/1";
const BIN_3 = "/0/0/0/2";

const open = async (page: Page, { reducedMotion = true } = {}) => {
    if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
    const stage = await openExample(page, "warehouse-control");
    return { stage, network: tree(page, "Warehouse network") };
};

/** The units of a location, read from its accessible description ("1,234 units, …"). */
const unitsOf = (description: string | null) =>
    /^([\d,]+) units/.exec(description ?? "")?.[1];

test("the tree is a narrow column beside the scene", async ({ page }) => {
    const { stage, network } = await open(page);
    const column = await network.boundingBox();
    const figures = await stage.getByRole("definition").first().boundingBox();
    expect(column).not.toBeNull();
    expect(figures).not.toBeNull();
    if (!column || !figures) return;
    expect(column.width).toBeLessThanOrEqual(20 * 16);
    expect(figures.x).toBeGreaterThanOrEqual(column.x + column.width);
});

test("rows carry their stock, and low stock is flagged up the tree", async ({
    page,
}) => {
    const { network } = await open(page);
    await expect(itemAt(network, BIN_1)).toHaveAccessibleName("Bin LD1-1");
    await expect(itemAt(network, BIN_1)).toHaveAccessibleDescription(
        "84 of 120 units, Rice 5 kg",
    );
    await expect(itemAt(network, BIN_2)).toHaveAccessibleDescription(
        "9 of 120 units, low stock (minimum 15), Olive oil 1 L",
    );
    await expect(itemAt(network, BIN_2)).toHaveAttribute("data-low", "");
    await expect(itemAt(network, BIN_3)).not.toHaveAttribute("data-low");
    await expect(itemAt(network, AISLE_1)).toHaveAttribute("data-low", "");
    await expect(itemAt(network, AISLE_1)).toHaveAccessibleDescription(
        /^[\d,]+ units, \d+% full, \d+ bins? low on stock$/,
    );
});

test("under reduced motion the feed starts paused; Play moves stock, Pause freezes it", async ({
    page,
}) => {
    const { stage } = await open(page);
    const status = stage.getByTestId("feed-status");
    const units = stage.getByTestId("kpi-units");
    await expect(stage.getByRole("button", { name: "Play" })).toBeVisible();
    await expect(status).toHaveText("Paused · 08:00:00");
    const seeded = await units.textContent();
    await page.waitForTimeout(1500);
    await expect(units).toHaveText(seeded ?? "");
    await expect(stage.getByText("No movement yet.")).toBeVisible();

    await stage.getByRole("button", { name: "Play" }).click();
    await expect(status).toHaveText(/^Live · /);
    await expect
        .poll(() => units.textContent(), { timeout: 10_000 })
        .not.toBe(seeded);
    const movements = stage.getByRole("list", { name: "Stock movements" });
    await expect(movements.getByRole("listitem").first()).toBeVisible();

    await stage.getByRole("button", { name: "Pause" }).click();
    await expect(status).toHaveText(/^Paused · /);
    const frozen = await units.textContent();
    const clock = await status.textContent();
    await page.waitForTimeout(2000);
    await expect(units).toHaveText(frozen ?? "");
    await expect(status).toHaveText(clock ?? "");
});

test("without reduced motion the feed plays from the start", async ({
    page,
}) => {
    const { stage } = await open(page, { reducedMotion: false });
    await expect(stage.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect
        .poll(() => stage.getByTestId("feed-status").textContent(), {
            timeout: 10_000,
        })
        .not.toContain("08:00:00");
    await stage.getByRole("button", { name: "Pause" }).click();
    await expect(stage.getByTestId("feed-status")).toHaveText(/^Paused · /);
});

test("selecting a zone scopes the figures, the chart and the table", async ({
    page,
}) => {
    const { stage, network } = await open(page);
    await expect(stage.getByTestId("scope")).toHaveText("All sites");
    await expect(
        stage.getByRole("heading", { name: "Fill by zone" }),
    ).toBeVisible();

    await row(itemAt(network, DRY)).click();
    await expect(stage.getByTestId("scope")).toHaveText(
        "Lisbon DC › Dry goods",
    );
    const zoneUnits = unitsOf(
        await itemAt(network, DRY).evaluate(
            (element) =>
                document.getElementById(
                    element.getAttribute("aria-describedby") ?? "",
                )?.textContent ?? null,
        ),
    );
    await expect(stage.getByTestId("kpi-units")).toHaveText(zoneUnits ?? "");
    await expect(
        stage.getByRole("heading", { name: "Fill by aisle" }),
    ).toBeVisible();
    await expect(stage.getByTestId("fill-chart")).toHaveAccessibleName(
        /^Aisle LD1 \d+%, Aisle LD2 \d+%, Aisle LD3 \d+%$/,
    );
    const table = stage.getByRole("table", {
        name: "Bins, lowest stock first",
    });
    const bins = await table.getByRole("rowheader").allTextContents();
    expect(bins.length).toBeGreaterThan(0);
    for (const bin of bins) expect(bin).toMatch(/^Bin LD/);
    // the low bin of the first aisle is among the lowest
    expect(bins).toContain("Bin LD1-2");

    await stage.getByRole("button", { name: "All sites" }).click();
    await expect(stage.getByTestId("scope")).toHaveText("All sites");
    await expect(
        stage.getByRole("heading", { name: "Fill by zone" }),
    ).toBeVisible();
});

test("a bin moves to another aisle of its climate, never to another zone", async ({
    page,
}) => {
    const { network } = await open(page);
    // a zone takes no bin: only aisles do, so the drop is refused
    await dragRow(
        page,
        row(itemAt(network, BIN_1)),
        row(itemAt(network, COLD)),
    );
    await expect(itemAt(network, BIN_1)).toHaveAccessibleName("Bin LD1-1");
    // another aisle of dry goods takes it
    await dragRow(
        page,
        row(itemAt(network, BIN_1)),
        row(itemAt(network, AISLE_2)),
    );
    await expect(itemAt(network, BIN_1)).toHaveAccessibleName("Bin LD1-2");
});
