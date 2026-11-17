import { Component, input } from "@angular/core";
import { describe, expect, it } from "vitest";
import { TREE, type TreeModel } from "../src/public-api";
import {
    byPath,
    type FileTypes,
    filesModel,
    itemElement,
    items,
    render,
    renderFiles,
    settle,
    shownGroups,
} from "./tree";

const tree = () => document.querySelector<HTMLElement>('[role="tree"]');

/** Each item with a `keepMounted` group of its own template (no toggle, no content). */
@Component({
    selector: "test-kept",
    imports: [TREE],
    template: `
        <div [treeRoot]="model()" aria-label="Files">
            <ng-template treeItems let-item>
                <div [treeItem]="item">
                    <div treeGroup [keepMounted]="keepMounted()">
                        <ng-template treeItems let-child>
                            <div [treeItem]="child" [attr.data-testid]="child.id"></div>
                        </ng-template>
                    </div>
                </div>
            </ng-template>
        </div>
    `,
})
class Kept {
    readonly model = input.required<TreeModel<FileTypes>>();
    readonly keepMounted = input(true);
}

describe("the WAI-ARIA Tree View roles and states", () => {
    it("renders a tree, its items and their groups", async () => {
        await renderFiles({ model: filesModel() });
        expect(tree()).toHaveAttribute("aria-label", "Files");
        expect(tree()).toHaveAttribute("data-tree-part", "root");
        expect(tree()).not.toHaveAttribute("aria-multiselectable");
        // src, its 3 children and readme: lib and utils are collapsed
        expect(items()).toHaveLength(5);
        // Angular: every item's group element is there; a collapsed one is empty and hidden
        // (React and Vue render none)
        const groups = shownGroups();
        expect(groups).toHaveLength(1);
        expect(groups[0]).toHaveAttribute("data-tree-part", "group");
        expect(itemElement("src")).toContainElement(groups[0] ?? null);
        const hidden = itemElement("utils").querySelector<HTMLElement>(
            ':scope > [role="group"]',
        );
        expect(hidden).toHaveStyle({ display: "none" });
        expect(hidden?.childElementCount).toBe(0);
    });

    it("gives every item its level, position and set size", async () => {
        await renderFiles({ model: filesModel() });
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
        await renderFiles({ model: filesModel() });
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
        await renderFiles({ model });
        expect(tree()).toHaveAttribute("aria-multiselectable", "true");
        expect(itemElement("app.ts")).toHaveAttribute("aria-selected", "true");
        expect(itemElement("src")).toHaveAttribute("aria-selected", "false");
    });

    it("sets no aria-selected when the selection mode is none", async () => {
        const model = filesModel({ settings: { selectionMode: "none" } });
        await renderFiles({ model });
        expect(itemElement("src")).not.toHaveAttribute("aria-selected");
    });

    it("sets aria-checked (mixed included) on the items with checkboxes", async () => {
        const model = filesModel({
            expandedItemIds: ["src", "utils"],
            checkedItemIds: ["a"],
        });
        await renderFiles({ model, checkboxes: true });
        expect(itemElement("a.ts")).toHaveAttribute("aria-checked", "true");
        expect(itemElement("b.ts")).toHaveAttribute("aria-checked", "false");
        expect(itemElement("utils")).toHaveAttribute("aria-checked", "mixed");
        expect(itemElement("utils")).toHaveAttribute("data-indeterminate");
    });

    it("sets no aria-checked without checkboxes", async () => {
        await renderFiles({ model: filesModel({ checkedItemIds: ["app"] }) });
        expect(itemElement("app.ts")).not.toHaveAttribute("aria-checked");
    });

    it("sets aria-disabled on a disabled item", async () => {
        const json = filesModel().get("tree-json");
        const all = { ...json.items };
        const app = all.app;
        if (app) all.app = { ...app, disabled: true };
        await renderFiles({ defaultTree: { ...json, items: all } });
        expect(itemElement("app.ts")).toHaveAttribute("aria-disabled", "true");
        expect(itemElement("app.ts")).toHaveAttribute("data-disabled", "");
        expect(itemElement("src")).not.toHaveAttribute("aria-disabled");
    });

    it("sets aria-busy while an item's children load", async () => {
        let resolve: (value: []) => void = () => {};
        const model = filesModel();
        await renderFiles({
            model,
            loadChildren: () =>
                new Promise<[]>((done) => {
                    resolve = done;
                }),
        });
        model.run("item.expand", { itemId: "lib" });
        await settle();
        expect(itemElement("lib")).toHaveAttribute("aria-busy", "true");
        expect(itemElement("lib")).toHaveAttribute("data-loading", "");
        resolve([]);
        await settle();
        expect(itemElement("lib")).not.toHaveAttribute("aria-busy");
    });

    it("keeps one tab stop: tabindex 0 on it, -1 on every other item", async () => {
        await renderFiles({ model: filesModel({ focusedItemId: "app" }) });
        const stops = items().filter((item) => item.tabIndex === 0);
        expect(stops).toEqual([itemElement("app.ts")]);
        expect(itemElement("src")).toHaveAttribute("tabindex", "-1");
    });

    it("puts the part on every element and the path on every item", async () => {
        await renderFiles({ model: filesModel() });
        expect(byPath("/0")).toBe(itemElement("src"));
        expect(byPath("/0/2")).toBe(itemElement("utils"));
        expect(byPath("/1")).toBe(itemElement("readme.md"));
        const parts = new Set(
            [...document.querySelectorAll("[data-tree-part]")].map((element) =>
                element.getAttribute("data-tree-part"),
            ),
        );
        // Angular: the drop indicator is the app's element, there and hidden while no drag has a
        // target (React and Vue render none)
        expect([...parts].sort()).toEqual(
            [
                "root",
                "item",
                "content",
                "toggle",
                "group",
                "drop-indicator",
                "live-region",
            ].sort(),
        );
        expect(
            document.querySelector('[data-tree-part="drop-indicator"]'),
        ).toHaveStyle({ display: "none" });
        expect(
            document.querySelector('[data-tree-part="live-region"]'),
        ).toHaveAttribute("aria-live", "polite");
    });

    it("gives the depth to the items' parts as --tree-depth and data-depth", async () => {
        await renderFiles({ model: filesModel() });
        const utils = itemElement("utils");
        expect(utils.style.getPropertyValue("--tree-depth")).toBe("1");
        expect(utils).toHaveAttribute("data-depth", "1");
        const row = utils.querySelector('[data-tree-part="content"]');
        expect(row).toHaveAttribute("data-depth", "1");
    });

    it("renders a collapsed group's children only with keepMounted, hidden", async () => {
        // a group with its own <ng-template treeItems>; nothing is expanded
        const view = await render(Kept, {
            model: filesModel({ expandedItemIds: [] }),
        });
        const groups = document.querySelectorAll<HTMLElement>('[role="group"]');
        expect(groups).toHaveLength(2);
        for (const group of groups) {
            expect(group).toHaveStyle({ display: "none" });
        }
        const app = document.querySelector('[data-testid="app"]');
        expect(app).toHaveAttribute("aria-level", "2");
        expect(app?.parentElement).toBe(groups[0]);
        // without keepMounted, a collapsed group is empty
        await view.set("keepMounted", false);
        expect(document.querySelector('[data-testid="app"]')).toBeNull();
    });

    it("renders an expanded group's children with the group's own template", async () => {
        await render(Kept, { model: filesModel(), keepMounted: false });
        const src = byPath("/0");
        const group = src?.querySelector<HTMLElement>(
            ':scope > [role="group"]',
        );
        expect(group).not.toHaveStyle({ display: "none" });
        expect(
            [...(group?.children ?? [])].map((child) =>
                child.getAttribute("data-testid"),
            ),
        ).toEqual(["app", "lib", "utils"]);
        // the own template has no group: utils' children are not rendered
        expect(document.querySelector('[data-testid="a"]')).toBeNull();
    });
});
