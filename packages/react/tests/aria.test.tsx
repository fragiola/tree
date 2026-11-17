import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tree } from "../src";
import { byPath, FileTree, filesModel, itemElement } from "./tree";

describe("the WAI-ARIA Tree View roles and states", () => {
    it("renders a tree, its items and their groups", () => {
        render(<FileTree model={filesModel()} />);
        const tree = screen.getByRole("tree", { name: "Files" });
        expect(tree).toHaveAttribute("data-tree-part", "root");
        expect(tree).not.toHaveAttribute("aria-multiselectable");
        // src, its 3 children and readme: lib and utils are collapsed
        const items = screen.getAllByRole("treeitem");
        expect(items).toHaveLength(5);
        const groups = screen.getAllByRole("group");
        expect(groups).toHaveLength(1);
        expect(groups[0]).toHaveAttribute("data-tree-part", "group");
        expect(itemElement("src")).toContainElement(groups[0] ?? null);
    });

    it("gives every item its level, position and set size", () => {
        render(<FileTree model={filesModel()} />);
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

    it("sets aria-expanded on parents only", () => {
        render(<FileTree model={filesModel()} />);
        expect(itemElement("src")).toHaveAttribute("aria-expanded", "true");
        expect(itemElement("utils")).toHaveAttribute("aria-expanded", "false");
        // a parent whose children come from the loader
        expect(itemElement("lib")).toHaveAttribute("aria-expanded", "false");
        expect(itemElement("app.ts")).not.toHaveAttribute("aria-expanded");
    });

    it("sets aria-selected when the tree selects, and aria-multiselectable in multiple mode", () => {
        const model = filesModel({
            settings: { selectionMode: "multiple" },
            selectedItemIds: ["app"],
        });
        render(<FileTree model={model} />);
        expect(screen.getByRole("tree")).toHaveAttribute(
            "aria-multiselectable",
            "true",
        );
        expect(itemElement("app.ts")).toHaveAttribute("aria-selected", "true");
        expect(itemElement("src")).toHaveAttribute("aria-selected", "false");
    });

    it("sets no aria-selected when the selection mode is none", () => {
        render(
            <FileTree
                model={filesModel({ settings: { selectionMode: "none" } })}
            />,
        );
        expect(itemElement("src")).not.toHaveAttribute("aria-selected");
    });

    it("sets aria-checked (mixed included) on the items with checkboxes", () => {
        const model = filesModel({
            expandedItemIds: ["src", "utils"],
            checkedItemIds: ["a"],
        });
        render(<FileTree model={model} checkboxes />);
        expect(itemElement("a.ts")).toHaveAttribute("aria-checked", "true");
        expect(itemElement("b.ts")).toHaveAttribute("aria-checked", "false");
        expect(itemElement("utils")).toHaveAttribute("aria-checked", "mixed");
        expect(itemElement("utils")).toHaveAttribute("data-indeterminate");
    });

    it("sets no aria-checked without checkboxes", () => {
        render(<FileTree model={filesModel({ checkedItemIds: ["app"] })} />);
        expect(itemElement("app.ts")).not.toHaveAttribute("aria-checked");
    });

    it("sets aria-disabled on a disabled item", () => {
        const json = filesModel().get("tree-json");
        const items = { ...json.items };
        const app = items.app;
        if (app) items.app = { ...app, disabled: true };
        render(<FileTree defaultTree={{ ...json, items }} />);
        expect(itemElement("app.ts")).toHaveAttribute("aria-disabled", "true");
        expect(itemElement("app.ts")).toHaveAttribute("data-disabled", "");
        expect(itemElement("src")).not.toHaveAttribute("aria-disabled");
    });

    it("sets aria-busy while an item's children load", async () => {
        let resolve: (value: []) => void = () => {};
        const model = filesModel();
        render(
            <FileTree
                model={model}
                loadChildren={() =>
                    new Promise<[]>((done) => {
                        resolve = done;
                    })
                }
            />,
        );
        act(() => {
            model.run("item.expand", { itemId: "lib" });
        });
        expect(itemElement("lib")).toHaveAttribute("aria-busy", "true");
        expect(itemElement("lib")).toHaveAttribute("data-loading", "");
        await act(async () => resolve([]));
        expect(itemElement("lib")).not.toHaveAttribute("aria-busy");
    });

    it("keeps one tab stop: tabindex 0 on it, -1 on every other item", () => {
        render(<FileTree model={filesModel({ focusedItemId: "app" })} />);
        const stops = screen
            .getAllByRole("treeitem")
            .filter((item) => item.tabIndex === 0);
        expect(stops).toEqual([itemElement("app.ts")]);
        expect(itemElement("src")).toHaveAttribute("tabindex", "-1");
    });

    it("puts the part on every element and the path on every item", () => {
        render(<FileTree model={filesModel()} />);
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

    it("gives the depth to the items' parts as --tree-depth and data-depth", () => {
        render(<FileTree model={filesModel()} />);
        const utils = itemElement("utils");
        expect(utils.style.getPropertyValue("--tree-depth")).toBe("1");
        expect(utils).toHaveAttribute("data-depth", "1");
        const row = utils.querySelector('[data-tree-part="content"]');
        expect(row).toHaveAttribute("data-depth", "1");
    });

    it("renders a collapsed group only with keepMounted, hidden", () => {
        render(
            <Tree.Root model={filesModel()} aria-label="Files">
                <Tree.Items>
                    {(item) => (
                        <Tree.Item item={item}>
                            <Tree.Group keepMounted>
                                {(child) => (
                                    <Tree.Item
                                        item={child}
                                        data-testid={child.id}
                                    />
                                )}
                            </Tree.Group>
                        </Tree.Item>
                    )}
                </Tree.Items>
            </Tree.Root>,
        );
        // readme is a leaf: its group renders, empty and hidden
        const groups = screen.getAllByRole("group", { hidden: true });
        expect(groups).toHaveLength(2);
        expect(groups[1]).toHaveStyle({ display: "none" });
        expect(screen.getByTestId("app")).toHaveAttribute("aria-level", "2");
    });
});
