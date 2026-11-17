import { expect, test } from "@playwright/test";
import { collectErrors, EXAMPLES, openExample, reset, THEMES } from "./helpers";

// Every example mounts and logs no error, in every theme (there are five), and comes back after
// the site's Reset; a new example folder is covered without touching this file.

for (const example of EXAMPLES) {
    for (const theme of THEMES) {
        test(`${example.slug} renders in ${theme.name}`, async ({ page }) => {
            const errors = collectErrors(page);
            const stage = await openExample(page, example.slug, {
                theme: theme.name,
            });
            // a tree with a name, and at least one item
            const tree = stage.getByRole("tree").first();
            await expect(tree).toHaveAccessibleName(/.+/);
            await expect(tree.getByRole("treeitem").first()).toBeVisible();
            // the site's Reset reloads the frame: the example must come back
            await reset(page);
            expect(errors).toEqual([]);
        });
    }
}
