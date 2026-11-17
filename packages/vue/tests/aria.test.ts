import { describe, expect, it } from "vitest";
import { h } from "vue";
import type { ItemOf } from "../src";
import { selection } from "../src/selection";
import {
    byPath,
    type FileTypes,
    filesModel,
    filesModelWith,
    fileTree,
    itemElement,
    render,
    settle,
    Tree,
} from "./tree";

const tree = () => document.querySelector<HTMLElement>('[role="tree"]');
const items = () => [
    ...document.querySelectorAll<HTMLElement>('[role="treeitem"]'),
];

describe("the WAI-ARIA Tree View roles and states", () => {
    it("renders a tree, its items and their groups", async () => {
        await render(() => fileTree({ model: filesModel() }));
        expect(tree()).toHaveAttribute("aria-label", "Files");
        expect(tree()).toHaveAttribute("data-tree-part", "root");
        expect(tree()).not.toHaveAttribute("aria-multiselectable");
        // src, its 3 children and readme: lib and utils are collapsed
        expect(items()).toHaveLength(5);
        const groups = document.querySelectorAll('[role="group"]');
        expect(groups).toHaveLength(1);
        expect(groups[0]).toHaveAttribute("data-tree-part", "group");
        expect(itemElement("src")).toContainElement(
            (groups[0] as HTMLElement | undefined) ?? null,
        );
    });

    it("gives every item its level, position and set size", async () => {
        await render(() => fileTree({ model: filesModel() }));
        const src = itemElement("src");
        expect(src).toHaveAttribute("aria-level", "1");
        expect(src).toHaveAttribute("aria-posinset", "1");
        expect(src).toHaveAttribute("aria-setsize", "2");
        const utils = itemElement("utils");
        expect(utils).toHaveAttribute("aria-level", "2");
        expect(utils).toHaveAttribute("aria-posinset", "3");
        expect(utils).toHaveAttribute("aria-setsize", "3");
        expect(itemElement("readme.md")).toHaveAttribute("aria-posinset", "2");
    });

    it("sets aria-expanded on parents only", async () => {
        await render(() => fileTree({ model: filesModel() }));
        expect(itemElement("src")).toHaveAttribute("aria-expanded", "true");
        expect(itemElement("utils")).toHaveAttribute("aria-expanded", "false");
        // a parent whose children come from the loader
        expect(itemElement("lib")).toHaveAttribute("aria-expanded", "false");
        expect(itemElement("app.ts")).not.toHaveAttribute("aria-expanded");
    });

    it("sets aria-selected when the tree selects, and aria-multiselectable in multiple mode", async () => {
        const model = filesModel({
            settings: { selectionMode: "multiple" },
            selectedItemIds: ["app"],
        });
        await render(() => fileTree({ model }));
        expect(tree()).toHaveAttribute("aria-multiselectable", "true");
        expect(itemElement("app.ts")).toHaveAttribute("aria-selected", "true");
        expect(itemElement("src")).toHaveAttribute("aria-selected", "false");
    });

    it("sets no aria-selected when the selection mode is none", async () => {
        const model = filesModel({ settings: { selectionMode: "none" } });
        await render(() => fileTree({ model }));
        expect(itemElement("src")).not.toHaveAttribute("aria-selected");
    });

    it("sets aria-checked (mixed included) on the items with checkboxes", async () => {
        const model = filesModel({
            expandedItemIds: ["src", "utils"],
            checkedItemIds: ["a"],
        });
        await render(() => fileTree({ model }));
        expect(itemElement("a.ts")).toHaveAttribute("aria-checked", "true");
        expect(itemElement("b.ts")).toHaveAttribute("aria-checked", "false");
        expect(itemElement("utils")).toHaveAttribute("aria-checked", "mixed");
        expect(itemElement("utils")).toHaveAttribute("data-indeterminate");
    });

    it("sets no aria-checked without checkboxes", async () => {
        await render(() => fileTree({ model: filesModelWith([selection()]) }));
        expect(itemElement("app.ts")).not.toHaveAttribute("aria-checked");
    });

    it("sets aria-disabled on a disabled item", async () => {
        const json = filesModel().get("tree-json");
        const all = { ...json.items };
        const app = all.app;
        if (app) all.app = { ...app, disabled: true };
        await render(() => fileTree({ defaultTree: { ...json, items: all } }));
        expect(itemElement("app.ts")).toHaveAttribute("aria-disabled", "true");
        expect(itemElement("app.ts")).toHaveAttribute("data-disabled", "");
        expect(itemElement("src")).not.toHaveAttribute("aria-disabled");
    });

    it("sets aria-busy while an item's children load", async () => {
        let resolve: (value: []) => void = () => {};
        const model = filesModel();
        await render(() =>
            fileTree({
                model,
                loadChildren: () =>
                    new Promise<[]>((done) => {
                        resolve = done;
                    }),
            }),
        );
        model.run("item.expand", { itemId: "lib" });
        await settle();
        expect(itemElement("lib")).toHaveAttribute("aria-busy", "true");
        expect(itemElement("lib")).toHaveAttribute("data-loading", "");
        resolve([]);
        await settle();
        expect(itemElement("lib")).not.toHaveAttribute("aria-busy");
    });

    it("keeps one tab stop: tabindex 0 on it, -1 on every other item", async () => {
        await render(() =>
            fileTree({ model: filesModel({ focusedItemId: "app" }) }),
        );
        const stops = items().filter((item) => item.tabIndex === 0);
        expect(stops).toEqual([itemElement("app.ts")]);
        expect(itemElement("src")).toHaveAttribute("tabindex", "-1");
    });

    it("puts the part on every element and the path on every item", async () => {
        await render(() => fileTree({ model: filesModel() }));
        expect(byPath("/0")).toBe(itemElement("src"));
        expect(byPath("/0/2")).toBe(itemElement("utils"));
        expect(byPath("/1")).toBe(itemElement("readme.md"));
        const parts = new Set(
            [...document.querySelectorAll("[data-tree-part]")].map((element) =>
                element.getAttribute("data-tree-part"),
            ),
        );
        expect([...parts].sort()).toEqual(
            [
                "root",
                "item",
                "content",
                "toggle",
                "group",
                "live-region",
            ].sort(),
        );
        expect(
            document.querySelector('[data-tree-part="live-region"]'),
        ).toHaveAttribute("aria-live", "polite");
    });

    it("gives the depth to the items' parts as --tree-depth and data-depth", async () => {
        await render(() => fileTree({ model: filesModel() }));
        const utils = itemElement("utils");
        expect(utils.style.getPropertyValue("--tree-depth")).toBe("1");
        expect(utils).toHaveAttribute("data-depth", "1");
        const row = utils.querySelector('[data-tree-part="content"]');
        expect(row).toHaveAttribute("data-depth", "1");
    });

    it("renders a collapsed group only with keep-mounted, hidden", async () => {
        await render(() =>
            h(Tree.Root, { model: filesModel(), "aria-label": "Files" }, () =>
                h(Tree.Items, null, {
                    default: ({ item }: { item: ItemOf<FileTypes> }) => [
                        h(Tree.Item, { item }, () =>
                            h(
                                Tree.Group,
                                { keepMounted: true },
                                {
                                    default: ({
                                        item: child,
                                    }: {
                                        item: ItemOf<FileTypes>;
                                    }) => [
                                        h(Tree.Item, {
                                            item: child,
                                            "data-testid": child.id,
                                        }),
                                    ],
                                },
                            ),
                        ),
                    ],
                }),
            ),
        );
        // readme is a leaf: its group renders, empty and hidden
        const groups = document.querySelectorAll<HTMLElement>('[role="group"]');
        expect(groups).toHaveLength(2);
        expect(groups[1]).toHaveStyle({ display: "none" });
        expect(document.querySelector('[data-testid="app"]')).toHaveAttribute(
            "aria-level",
            "2",
        );
    });
});
