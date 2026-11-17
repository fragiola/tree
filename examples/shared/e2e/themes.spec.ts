import { expect, type Page, test } from "@playwright/test";
import { item, itemAt, openExample, THEMES, tree } from "./helpers";

// The example themes (examples/shared/src/themes) are values every framework's examples read, so
// their checks run against each framework's embed: checked on computed styles (verify by
// compiling, not by reading class names).
//
// The themes change shape, not only colour: a row's height and radius, the font, and the tree's
// own shapes (the indentation guides, the selected row's marker, the toggle's look). That is what
// shows a reader the package is headless: every look is the app's.

type ThemeName = (typeof THEMES)[number]["name"];

/** The shapes of file-explorer's first folder (`/0`, expanded) and its first child (`/0/0`). */
async function shapes(page: Page) {
    const folder = itemAt(tree(page), "/0").locator(
        ':scope > [data-tree-part="content"]',
    );
    const child = itemAt(tree(page), "/0/0").locator(
        ':scope > [data-tree-part="content"]',
    );
    const toggle = folder.locator('[data-tree-part="toggle"]');
    return {
        height: (await folder.boundingBox())?.height,
        radius: await folder.evaluate(
            (el) => getComputedStyle(el).borderTopLeftRadius,
        ),
        font: await tree(page).evaluate(
            (el) => getComputedStyle(el).fontFamily,
        ),
        guide: await child.evaluate(
            (el) => getComputedStyle(el).backgroundImage,
        ),
        marker: await folder.evaluate(
            (el) => getComputedStyle(el, "::before").width,
        ),
        toggle: await toggle.evaluate((el) => {
            const icon = el.querySelector("svg");
            const text = getComputedStyle(el, "::before").content;
            return `${icon ? getComputedStyle(icon).display : "-"} ${text}`;
        }),
    };
}

async function look(page: Page, theme: ThemeName) {
    await openExample(page, "file-explorer", { theme });
    return shapes(page);
}

for (const theme of THEMES) {
    test(`${theme.name} loads, and its scheme reaches the page`, async ({
        page,
    }) => {
        await openExample(page, "hello-tree", { theme: theme.name });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            theme.scheme,
        );
        expect(
            await tree(page).evaluate((el) => getComputedStyle(el).colorScheme),
        ).toBe(theme.scheme);
    });
}

test("light and dark paint different trees", async ({ page }) => {
    const color = async (theme: "light" | "dark") => {
        await openExample(page, "hello-tree", { theme });
        return tree(page).evaluate((el) => getComputedStyle(el).color);
    };
    expect(await color("light")).not.toBe(await color("dark"));
});

test("ide: dense square rows, hairline guides, a marker on the selected row", async ({
    page,
}) => {
    const s = await look(page, "ide");
    expect(s.height).toBe(22);
    expect(s.radius).toBe("0px");
    expect(s.guide).toContain("gradient");
    expect(s.marker).toBe("2px");
});

test("paper: tall rounded rows in a serif face", async ({ page }) => {
    const s = await look(page, "paper");
    expect(s.height).toBe(36);
    expect(Number.parseFloat(s.radius)).toBeGreaterThan(6);
    expect(s.font).toMatch(/serif|Georgia|Palatino/i);
    expect(s.marker).toBe("3px");
});

test("terminal: monospace, square rows, + and - instead of a chevron", async ({
    page,
}) => {
    const s = await look(page, "terminal");
    expect(s.radius).toBe("0px");
    expect(s.font).toMatch(/mono|Menlo|Consolas/i);
    expect(s.toggle).toBe('none "-"');
    expect(s.guide).toContain("gradient");
});

test("ide, paper and terminal differ from light in shape, not only colour", async ({
    page,
}) => {
    const light = await look(page, "light");
    expect(light.guide).toBe("none");
    expect(light.toggle.startsWith("block")).toBe(true);
    for (const theme of ["ide", "paper", "terminal"] as const) {
        const s = await look(page, theme);
        expect(s.height, theme).not.toBe(light.height);
        expect(s.radius, theme).not.toBe(light.radius);
        expect(s.font, theme).not.toBe(light.font);
        // and at least one of the tree's own shapes
        expect(
            [s.guide, s.marker, s.toggle].some(
                (value, index) =>
                    value !== [light.guide, light.marker, light.toggle][index],
            ),
            theme,
        ).toBe(true);
    }
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

for (const theme of THEMES) {
    test(`${theme.name}: a keyboard drag's line starts at the icon (indicatorInset)`, async ({
        page,
    }) => {
        await openExample(page, "keyboard", { theme: theme.name });
        const files = tree(page, "Project files");
        await item(files, "main.tsx").focus();
        await page.keyboard.press("Control+Shift+D");
        // after app.tsx: a line at app.tsx's level, from its icon
        const line = await files
            .locator('[data-tree-part="drop-indicator"]')
            .boundingBox();
        const icon = await item(files, "app.tsx")
            .locator(':scope > [data-tree-part="content"] > svg')
            .first()
            .boundingBox();
        if (!line || !icon) throw new Error("no line or icon");
        expect(Math.abs(line.x - icon.x)).toBeLessThanOrEqual(1);
    });
}
