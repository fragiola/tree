import { describe, expect, it } from "vitest";
import { filesModel, fileTree, fire, focus, itemElement, render } from "./tree";

const box = (label: string) => {
    const element = itemElement(label).querySelector(
        ':scope > [data-tree-part="content"] > [data-tree-part="checkbox"]',
    );
    if (!element) throw new Error(`no checkbox on ${label}`);
    return element;
};

describe("tri-state checkboxes", () => {
    it("checks an item and its descendants on a press (cascade), mixing the parent", async () => {
        const model = filesModel({ expandedItemIds: ["src", "utils"] });
        await render(() => fileTree({ model, checkboxes: true }));
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

    it("does not select on a press of the checkbox", async () => {
        const model = filesModel();
        await render(() => fileTree({ model, checkboxes: true }));
        await fire(box("app.ts"), "click");
        expect(model.state.selectedItemIds).toEqual([]);
    });

    it("toggles the focused item's check with Space when the root has checkboxes", async () => {
        const model = filesModel();
        await render(() => fileTree({ model, checkboxes: true }));
        await focus(itemElement("readme.md"));
        await fire(itemElement("readme.md"), "keydown", { key: " " });
        expect(model.state.checkedItemIds).toEqual(["readme"]);
        expect(itemElement("readme.md")).toHaveAttribute(
            "aria-checked",
            "true",
        );
    });

    it("hides the checkbox from assistive technology: the item carries the state", async () => {
        await render(() => fileTree({ model: filesModel(), checkboxes: true }));
        expect(box("app.ts")).toHaveAttribute("aria-hidden", "true");
        expect(box("app.ts")).not.toHaveAttribute("tabindex");
    });
});
