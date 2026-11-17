import {
    expect,
    type FrameLocator,
    type Locator,
    type Page,
    test,
} from "@playwright/test";
import { examplesApp, listExampleSlugs } from "../scripts/examples-lib.ts";
import { THEMES, type ThemeName } from "../src/themes/themes.ts";
import { embedBase, frameworkOf, skipOrFail } from "./available.ts";

// The examples run in a framework's embed app, addressed by its directory URL (`…/?id=`, §5.1 of
// the site export contract), alone on the page: the stage is the page's own `data-testid="stage"`,
// and the site's Reset (which reloads the iframe) is a reload.
//
// Every framework runs these specs (config.ts). They reach the examples only through what every
// adapter reproduces: `data-tree-part`, `data-tree-path`, roles and accessible names, `data-*`
// state and test ids the example sets itself; never a class name or a framework detail.

/** The framework under test, set by the app's playwright.config.ts. */
export const FRAMEWORK = frameworkOf(process.env.EXAMPLES_FRAMEWORK);
/** Where the e2e server mounts its embed (serve.ts). */
export const EMBED_BASE = embedBase(FRAMEWORK);
const AVAILABLE = listExampleSlugs(examplesApp(FRAMEWORK));
/** The framework's examples: a spec loops over these, never over a fixed list. */
export const EXAMPLES = AVAILABLE.map((slug) => ({ slug }));
export { THEMES };

/** The root of a tree: `data-tree-part="root"`. */
export const ROOT = '[data-tree-part="root"]';

/**
 * Skips the running test (or, at the top of a spec file, the whole file) when the framework has
 * not every one of these examples: a framework may ship a subset of them. A complete framework
 * fails instead.
 */
export function requireExamples(...slugs: string[]) {
    const reason = skipOrFail(FRAMEWORK, AVAILABLE, slugs);
    test.skip(reason !== undefined, reason);
}

/**
 * Opens an example in a theme and waits for its tree to mount. Skips the test when the framework
 * has no such example.
 */
export async function openExample(
    page: Page,
    slug: string,
    options: { theme?: ThemeName } = {},
) {
    requireExamples(slug);
    const params = new URLSearchParams({ id: slug });
    if (options.theme) params.set("theme", options.theme);
    await page.goto(`./?${params}`);
    const stage = page.getByTestId("stage");
    if (options.theme) {
        await expect(page.locator("body")).toHaveAttribute(
            "data-example-theme",
            options.theme,
        );
    }
    await expect(stage.locator(ROOT).first()).toBeVisible();
    return stage;
}

/**
 * Opens an example as fragiola.com shows it: in an iframe of a same-origin page (serve.ts,
 * /host.html). Skips the test when the framework has no such example.
 */
export async function openHosted(
    page: Page,
    query: { id: string; theme?: string },
): Promise<FrameLocator> {
    requireExamples(query.id);
    await page.goto(`/host.html?${new URLSearchParams(query)}`);
    const frame = page.frameLocator('[data-testid="frame"]');
    await expect(frame.locator(ROOT).first()).toBeVisible();
    return frame;
}

/** The site's Reset: it reloads the example's frame. */
export async function reset(page: Page) {
    await page.reload();
    await expect(page.getByTestId("stage").locator(ROOT).first()).toBeVisible();
}

/** Collects console errors and uncaught exceptions for the page's lifetime. */
export function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    return errors;
}

/** The tree of the stage (the first, or the one with this accessible name). */
export function tree(scope: Page | FrameLocator, name?: string): Locator {
    const stage =
        "getByTestId" in scope && "goto" in scope
            ? scope.getByTestId("stage")
            : scope.locator("body");
    return name === undefined
        ? stage.getByRole("tree").first()
        : stage.getByRole("tree", { name });
}

/** An item by its path (`/0/2`), inside `scope` (a tree, the stage). */
export function itemAt(scope: Locator, path: string): Locator {
    return scope.locator(`[data-tree-part="item"][data-tree-path="${path}"]`);
}

/** How many root items a tree has (paths `/0`, `/1`, …). */
export async function rootItemCount(scope: Locator): Promise<number> {
    return scope
        .locator('[data-tree-part="item"]')
        .evaluateAll(
            (items) =>
                items.filter((element) =>
                    /^\/\d+$/.test(
                        element.getAttribute("data-tree-path") ?? "",
                    ),
                ).length,
        );
}

/** An item by its accessible name (its label), inside a tree. */
export function item(scope: Locator, name: string): Locator {
    return scope.getByRole("treeitem", { name, exact: true });
}

/** An item's row (`data-tree-part="content"`), the element a press and a drag start from. */
export function row(itemLocator: Locator): Locator {
    return itemLocator.locator(':scope > [data-tree-part="content"]');
}

/** The accessible names of the visible items, in order. */
export async function visibleNames(scope: Locator): Promise<string[]> {
    return scope
        .getByRole("treeitem")
        .evaluateAll((items) =>
            items
                .filter(
                    (element) => (element as HTMLElement).offsetParent !== null,
                )
                .map(
                    (element) =>
                        element
                            .querySelector(
                                ':scope > [data-tree-part="content"]',
                            )
                            ?.textContent?.trim() ?? "",
                ),
        );
}

/** The path of the element that has DOM focus. */
export async function focusedPath(page: Page): Promise<string | undefined> {
    return page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.dataset.treePath,
    );
}

/** The centre of a locator's box, or a point at a fraction of its height. */
export async function pointIn(locator: Locator, fraction = 0.5) {
    const box = await locator.boundingBox();
    if (!box) throw new Error("no bounding box");
    return {
        x: box.x + Math.min(40, box.width / 2),
        y: box.y + box.height * fraction,
    };
}

/**
 * Drags `from` (an item's row) with the mouse to a point at `fraction` of `to`'s height (0.1: just
 * before it, 0.5: inside it, 0.9: just after it), and drops it. Pointer Events: press, move past
 * the threshold, then steps.
 */
export async function dragRow(
    page: Page,
    from: Locator,
    to: Locator,
    fraction = 0.5,
) {
    const start = await pointIn(from);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y + 8, { steps: 4 });
    const end = await pointIn(to, fraction);
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
}
