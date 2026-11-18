import { expect, type Locator, type Page, test } from "@playwright/test";

// The shell around the examples of examples/react: sidebar, theme, stage, source panel. The
// examples' own behaviour is covered by the shared e2e; this checks they render here.

const sidebar = (page: Page) =>
    page.getByRole("navigation", { name: "Playground" });

const colorOf = (locator: Locator) =>
    locator.evaluate((el) => getComputedStyle(el).color);

async function openExample(page: Page, query: string) {
    await page.goto(`/?${query}`);
    const tree = page.getByTestId("stage").getByRole("tree").first();
    await expect(tree).toBeVisible();
    return tree;
}

test("lists the examples, the scenarios and the fixtures, and opens an example", async ({
    page,
}) => {
    await page.goto("/");
    const nav = sidebar(page);
    await expect(nav.getByRole("heading", { name: "Examples" })).toBeVisible();
    await expect(nav.getByRole("heading", { name: "Scenarios" })).toBeVisible();
    await expect(nav.getByRole("heading", { name: "Fixtures" })).toBeVisible();
    await expect(
        nav.getByRole("link", { name: "Basic fixture" }),
    ).toHaveAttribute("href", "/fixtures/basic/");
    await nav.getByRole("link", { name: "Hello tree" }).click();
    await expect(page).toHaveURL(/\?example=hello-tree$/);
    await expect(page.getByTestId("stage").getByRole("tree")).toBeVisible();
    await expect(page).toHaveTitle("Hello tree · Tree playground");
});

test("every example renders in the stage", async ({ page }) => {
    await page.goto("/");
    const links = sidebar(page).getByRole("link");
    const hrefs = await links.evaluateAll((all) =>
        all
            .map((a) => a.getAttribute("href") ?? "")
            .filter((href) => href.includes("example=")),
    );
    expect(hrefs.length).toBe(20);
    for (const href of hrefs) {
        await page.goto(href);
        await expect(
            page.getByTestId("stage").getByRole("tree").first(),
        ).toBeVisible();
    }
});

test("switches the example theme live", async ({ page }) => {
    const tree = await openExample(page, "example=hello-tree");
    const body = page.locator("body");
    await expect(body).toHaveAttribute("data-example-theme", "light");
    const light = await colorOf(tree);
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(body).toHaveAttribute("data-example-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(() => colorOf(tree)).not.toBe(light);
    await expect(page).toHaveURL(/theme=dark/);
});

test("shows the example's files in the source panel", async ({ page }) => {
    await openExample(page, "example=hello-tree");
    await page.getByRole("button", { name: "Source" }).click();
    const panel = page.getByRole("complementary", { name: "Source" });
    await expect(panel.getByTestId("source-path")).toHaveText(
        "examples/react/src/examples/hello-tree/index.tsx",
    );
    await expect(panel.locator("code")).toContainText(
        "export default function HelloTree",
    );
});

test("names an unknown example instead of rendering nothing", async ({
    page,
}) => {
    await page.goto("/?example=nope");
    await expect(page.getByRole("main")).toContainText(
        "No example with id “nope”.",
    );
});
