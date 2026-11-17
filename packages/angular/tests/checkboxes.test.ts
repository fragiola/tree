import { Component, input } from "@angular/core";
import { describe, expect, it } from "vitest";
import { TREE } from "../src/public-api";
import {
    filesModel,
    fire,
    focus,
    itemElement,
    render,
    renderFiles,
} from "./tree";

const box = (label: string) => {
    const element = itemElement(label).querySelector(
        ':scope > [data-tree-part="content"] > [data-testid="check"]',
    );
    if (!element) throw new Error(`no checkbox on ${label}`);
    return element;
};

describe("tri-state checkboxes", () => {
    it("checks an item and its descendants on a press (cascade), mixing the parent", async () => {
        const model = filesModel({ expandedItemIds: ["src", "utils"] });
        await renderFiles({ model, checkboxes: true });
        await fire(box("a.ts"), "click");
        expect(model.state.checkedItemIds).toEqual(["a"]);
        expect(itemElement("utils")).toHaveAttribute("aria-checked", "mixed");
        expect(box("utils")).toHaveAttribute("data-indeterminate");
        await fire(box("b.ts"), "click");
        expect(itemElement("utils")).toHaveAttribute("aria-checked", "true");
        expect(box("utils")).toHaveAttribute("data-checked");
        await fire(box("utils"), "click");
        expect(model.state.checkedItemIds).toEqual([]);
    });

    it("does not select on a press of the app's check control", async () => {
        const model = filesModel();
        await renderFiles({ model, checkboxes: true });
        await fire(box("app.ts"), "pointerdown", {
            button: 0,
            isPrimary: true,
        });
        await fire(box("app.ts"), "click");
        expect(model.state.selectedItemIds).toEqual([]);
        expect(model.state.checkedItemIds).toEqual(["app"]);
    });

    it("does not select on a press of a control that is not native, with data-tree-no-drag", async () => {
        const model = filesModel();
        await render(NotNative, { model });
        await fire(box("readme.md"), "click");
        expect(model.state.selectedItemIds).toEqual([]);
        expect(model.state.checkedItemIds).toEqual(["readme"]);
    });

    it("toggles the focused item's check with Space when the root has checkboxes", async () => {
        const model = filesModel();
        await renderFiles({ model, checkboxes: true });
        await focus(itemElement("readme.md"));
        await fire(itemElement("readme.md"), "keydown", { key: " " });
        expect(model.state.checkedItemIds).toEqual(["readme"]);
        expect(itemElement("readme.md")).toHaveAttribute(
            "aria-checked",
            "true",
        );
    });

    it("leaves the check control to the app: the item carries the state, and renders no checkbox of its own", async () => {
        await renderFiles({ model: filesModel(), checkboxes: true });
        expect(itemElement("app.ts")).toHaveAttribute("aria-checked", "false");
        expect(document.querySelector('[role="checkbox"]')).toBeNull();
        expect(
            document.querySelector('[data-tree-part="checkbox"]'),
        ).toBeNull();
    });
});

/** An app's check control that is not a native one: `data-tree-no-drag` keeps the press its own. */
@Component({
    selector: "test-not-native",
    imports: [TREE],
    template: `
        <div [treeRoot]="model()" checkboxes aria-label="Files">
            <ng-template treeItems let-item>
                <div [treeItem]="item">
                    <div treeItemContent>
                        <span>{{ item.label }}</span>
                        <span
                            data-tree-no-drag=""
                            data-testid="check"
                            (click)="model().run('item.toggle-check', { itemId: item.id })"
                        ></span>
                    </div>
                </div>
            </ng-template>
        </div>
    `,
})
class NotNative {
    readonly model = input(filesModel());
}
