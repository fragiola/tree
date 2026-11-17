// The recursion's templates: where a `<ng-template treeItems>` renders, a group's own template at
// any depth of its content, a tree inside another tree's group, and the nested items' views
// checked with the view they are declared in.
import { Component, input } from "@angular/core";
import { describe, expect, it } from "vitest";
import { createTreeModel, TREE, type TreeModel } from "../src/public-api";
import { type FileTypes, filesModel, items, render } from "./tree";

const labels = (root: ParentNode = document) =>
    [...root.querySelectorAll<HTMLElement>('[role="treeitem"]')].map(
        (item) => item.dataset.label,
    );

@Component({
    selector: "test-wrapped-template",
    imports: [TREE],
    template: `
        <div [treeRoot]="model()" aria-label="Files">
            <ng-template [treeItems]="model()" let-item>
                <div [treeItem]="item" [attr.data-label]="item.label">
                    <div treeItemContent>{{ item.label }}</div>
                    <div treeGroup>
                        @if (true) {
                            <section>
                                <ng-template [treeItems]="model()" let-child>
                                    <div [treeItem]="child" [attr.data-label]="child.label">
                                        <div treeItemContent>{{ child.label }}</div>
                                    </div>
                                </ng-template>
                            </section>
                        }
                    </div>
                </div>
            </ng-template>
        </div>
    `,
})
class WrappedTemplate {
    readonly model = input.required<TreeModel<FileTypes>>();
}

@Component({
    selector: "test-nested-trees",
    imports: [TREE],
    template: `
        <div [treeRoot]="outer()" aria-label="Outer">
            <ng-template [treeItems]="outer()" let-item>
                <div [treeItem]="item" [attr.data-label]="item.label">
                    <div treeItemContent>{{ item.label }}</div>
                    <div treeGroup>
                        @if (item.id === "src") {
                            <div [treeRoot]="inner()" aria-label="Inner">
                                <ng-template [treeItems]="inner()" let-other>
                                    <div [treeItem]="other" [attr.data-label]="other.label">
                                        <div treeItemContent>{{ other.label }}</div>
                                    </div>
                                </ng-template>
                            </div>
                        }
                    </div>
                </div>
            </ng-template>
        </div>
    `,
})
class NestedTrees {
    readonly outer = input.required<TreeModel<FileTypes>>();
    readonly inner = input.required<TreeModel<FileTypes>>();
}

@Component({
    selector: "test-plain-field",
    imports: [TREE],
    template: `
        <div [treeRoot]="model()" aria-label="Files">
            <ng-template [treeItems]="model()" let-item>
                <div
                    [treeItem]="item"
                    [attr.data-label]="item.label"
                    [attr.data-highlighted]="item.id === highlighted ? '' : null"
                >
                    <div treeItemContent>{{ item.label }}</div>
                    <div treeGroup></div>
                </div>
            </ng-template>
        </div>
    `,
})
class PlainField {
    readonly model = input.required<TreeModel<FileTypes>>();
    /** a plain field, not a signal */
    highlighted = "";
}

describe("the recursion's templates", () => {
    it("a group's own template inside an element or an @if renders its children once", async () => {
        await render(WrappedTemplate, { model: filesModel() });
        // src, its 3 children, readme: each once
        expect(labels()).toEqual([
            "src",
            "app.ts",
            "lib",
            "utils",
            "readme.md",
        ]);
    });

    it("a tree inside another tree's group renders its own root items", async () => {
        const inner = createTreeModel<FileTypes>({
            version: 1,
            rootItemIds: ["x"],
            items: { x: { kind: "file", label: "x.ts", data: { size: 1 } } },
        });
        await render(NestedTrees, { outer: filesModel(), inner });
        const tree = document.querySelector('[aria-label="Inner"]');
        expect(tree).not.toBeNull();
        expect(labels(tree as Element)).toEqual(["x.ts"]);
        // the outer group still renders its own children (the inner tree is not its template)
        expect(items()).toHaveLength(6);
    });

    it("nested items read the component's plain fields as root items do", async () => {
        const rendered = await render(PlainField, {
            model: filesModel({ expandedItemIds: ["src", "utils"] }),
        });
        rendered.component.highlighted = "a";
        rendered.fixture.changeDetectorRef.markForCheck();
        await rendered.fixture.whenStable();
        const a = document.querySelector('[data-label="a.ts"]');
        expect(a).toHaveAttribute("data-highlighted");
        rendered.component.highlighted = "src";
        rendered.fixture.changeDetectorRef.markForCheck();
        await rendered.fixture.whenStable();
        expect(a).not.toHaveAttribute("data-highlighted");
        expect(document.querySelector('[data-label="src"]')).toHaveAttribute(
            "data-highlighted",
        );
    });
});
