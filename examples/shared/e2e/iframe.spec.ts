import { expect, type Page, test } from "@playwright/test";
import {
    collectErrors,
    dragRow,
    EXAMPLES,
    item,
    itemAt,
    openHosted,
    rootItemCount,
    row,
    tree,
} from "./helpers";

// The examples as fragiola.com shows them: in an iframe of a same-origin page (e2e/serve.ts,
// /host.html), talking to it with the site export's messages (contract v1.2, §5.2).

interface Message {
    type: string;
    id?: string;
    height?: number;
}

const messages = (page: Page) =>
    page.evaluate(
        () => (window as unknown as { messages: Message[] }).messages,
    );

test("the embed says ready once, with no resize for a fill layout", async ({
    page,
}) => {
    await openHosted(page, { id: "hello-tree", theme: "dark" });
    await expect
        .poll(() => messages(page))
        .toContainEqual({ type: "fragiola:example:ready", id: "hello-tree" });
    await expect(page.getByTestId("frame")).toHaveCSS("opacity", "1");
    await page.waitForTimeout(300);
    expect(await messages(page)).toEqual([
        { type: "fragiola:example:ready", id: "hello-tree" },
    ]);
});

test("the theme is applied before the first paint, and follows the site's message", async ({
    page,
}) => {
    const frame = await openHosted(page, { id: "hello-tree", theme: "light" });
    const body = frame.locator("body");
    const html = frame.locator("html");
    await expect(body).toHaveAttribute("data-example-theme", "light");
    await expect(html).toHaveAttribute("data-theme", "light");
    const floor = () =>
        tree(frame).evaluate((el) => getComputedStyle(el).color);
    const before = await floor();

    const send = (theme: string) =>
        page.evaluate((theme) => {
            document
                .querySelector("iframe")
                ?.contentWindow?.postMessage(
                    { type: "fragiola:example:theme", theme },
                    location.origin,
                );
        }, theme);
    await send("dark");
    await expect(body).toHaveAttribute("data-example-theme", "dark");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(html).toHaveClass(/\bdark\b/);
    await expect.poll(floor).not.toBe(before);

    // an unknown theme is ignored
    await send("nope");
    await page.waitForTimeout(100);
    await expect(body).toHaveAttribute("data-example-theme", "dark");
});

test("a missing or unknown theme falls back to light", async ({ page }) => {
    for (const query of [
        { id: "hello-tree" },
        { id: "hello-tree", theme: "nope" },
    ]) {
        const frame = await openHosted(page, query);
        await expect(frame.locator("body")).toHaveAttribute(
            "data-example-theme",
            "light",
        );
    }
});

test("an unknown example says so, and is still ready", async ({ page }) => {
    await page.goto("/host.html?id=nope");
    const frame = page.frameLocator('[data-testid="frame"]');
    await expect(frame.getByRole("alert")).toHaveText('Unknown example "nope"');
    await expect
        .poll(() => messages(page))
        .toContainEqual({ type: "fragiola:example:ready", id: "nope" });
});

for (const { slug } of EXAMPLES) {
    test(`${slug} runs in a frame`, async ({ page }) => {
        const errors = collectErrors(page);
        await openHosted(page, { id: slug, theme: "dark" });
        await expect
            .poll(() => messages(page))
            .toContainEqual({ type: "fragiola:example:ready", id: slug });
        expect(errors).toEqual([]);
    });
}

test("the keyboard and a pointer drag work inside the frame", async ({
    page,
}) => {
    const frame = await openHosted(page, { id: "drag-and-drop" });
    const files = tree(frame);
    const first = files.getByRole("treeitem").first();
    await first.focus();
    await page.keyboard.press("ArrowDown");
    await expect(files.locator(":focus")).toHaveAttribute(
        "data-tree-path",
        "/0/0",
    );
    // the last root item, dropped before the first one
    const last = await rootItemCount(files);
    const moved = itemAt(files, `/${last - 1}`);
    const name = (await row(moved).innerText()).trim();
    await dragRow(page, row(moved), row(itemAt(files, "/0")), 0.1);
    await expect(item(files, name)).toHaveAttribute("data-tree-path", "/0");
});
