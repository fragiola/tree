import { expect, test } from "@playwright/test";
import { openExample, tree } from "./helpers";

// The example themes (examples/shared/src/themes) are values every framework's examples read, so
// their checks run against each framework's embed: checked on computed styles.

test("light and dark paint different trees, and the dark scheme reaches the page", async ({
    page,
}) => {
    const look = async (theme: "light" | "dark") => {
        await openExample(page, "hello-tree", { theme });
        return {
            color: await tree(page).evaluate(
                (el) => getComputedStyle(el).color,
            ),
            scheme: await page.evaluate(
                () => document.documentElement.dataset.theme,
            ),
        };
    };
    const light = await look("light");
    const dark = await look("dark");
    expect(light.scheme).toBe("light");
    expect(dark.scheme).toBe("dark");
    expect(light.color).not.toBe(dark.color);
});

test("a row's height and indentation come from the theme tokens", async ({
    page,
}) => {
    await openExample(page, "file-explorer");
    const rows = tree(page).locator('[data-tree-part="content"]');
    const first = await rows.nth(0).boundingBox();
    const child = tree(page).locator(
        '[data-tree-part="item"][data-tree-path="/0/0"] > [data-tree-part="content"]',
    );
    const second = await child.boundingBox();
    if (!first || !second) throw new Error("no rows");
    expect(first.height).toBeGreaterThanOrEqual(24);
    // a child is indented by one level from its parent's row
    const padding = async (locator: typeof child) =>
        Number.parseFloat(
            await locator.evaluate(
                (el) => getComputedStyle(el).paddingInlineStart,
            ),
        );
    expect(await padding(child)).toBeGreaterThan(await padding(rows.nth(0)));
});
