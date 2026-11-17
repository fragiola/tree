import { Component, input } from "@angular/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { selection } from "../selection/public-api";
import { createTreeModel, TREE, type TreeModel } from "../src/public-api";
import { FileTree, type FileTypes, files, itemElement, render } from "./tree";

afterEach(() => {
    vi.restoreAllMocks();
});

@Component({
    selector: "test-bare",
    imports: [TREE],
    template: `
        <div [treeRoot]="model()" [selectedItemIds]="selected()" aria-label="Files">
            <ng-template [treeItems]="model()" let-item>
                <div [treeItem]="item"><div treeItemContent>{{ item.label }}</div></div>
            </ng-template>
        </div>
    `,
})
class Bare {
    readonly model = input.required<TreeModel<FileTypes>>();
    readonly selected = input<readonly string[] | undefined>(undefined);
}

describe("features on the root", () => {
    it("a bare tree says nothing about a selection", async () => {
        await render(Bare, { model: createTreeModel<FileTypes>(files()) });
        expect(document.querySelector('[role="tree"]')).not.toHaveAttribute(
            "aria-multiselectable",
        );
        expect(document.querySelector("[aria-selected]")).toBeNull();
    });

    it("an item gets its features' ARIA, and every part of it their data-*", async () => {
        await render(FileTree, {
            defaultTree: files({
                settings: { selectionMode: "multiple" },
                selectedItemIds: ["app"],
            }),
        });
        expect(document.querySelector('[role="tree"]')).toHaveAttribute(
            "aria-multiselectable",
            "true",
        );
        const app = itemElement("app.ts");
        expect(app).toHaveAttribute("aria-selected", "true");
        expect(app).toHaveAttribute("data-selected", "");
        const content = app.querySelector('[data-tree-part="content"]');
        expect(content).toHaveAttribute("data-selected", "");
        expect(content).not.toHaveAttribute("aria-selected");
    });

    it("warns once, and ignores it, when a feature's input has no feature", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const model = createTreeModel<FileTypes>(files());
        const rendered = await render(Bare, { model, selected: ["app"] });
        await rendered.set("selected", ["readme"]);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toContain(
            "selectedItemIds needs the selection feature",
        );
        expect("selectedItemIds" in model.state).toBe(false);
    });

    it("warns once when the features input changes after the root created its model", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        @Component({
            selector: "test-features",
            imports: [TREE],
            template: `<div treeRoot [defaultTree]="json" [features]="features()" aria-label="Files"></div>`,
        })
        class Host {
            readonly json = files();
            readonly features = input([selection()]);
        }
        const rendered = await render(Host);
        await rendered.set("features", [selection({ mode: "multiple" })]);
        await rendered.set("features", [selection()]);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toContain(
            "the features input changed after the root created its model",
        );
    });
});
