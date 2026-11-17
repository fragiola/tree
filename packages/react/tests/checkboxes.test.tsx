import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileTree, filesModel, itemElement } from "./tree";

const box = (label: string) => {
    const element = itemElement(label).querySelector(
        ':scope > [data-tree-part="content"] > [data-tree-part="checkbox"]',
    );
    if (!element) throw new Error(`no checkbox on ${label}`);
    return element;
};

describe("tri-state checkboxes", () => {
    it("checks an item and its descendants on a press (cascade), mixing the parent", () => {
        const model = filesModel({ expandedItemIds: ["src", "utils"] });
        render(<FileTree model={model} checkboxes />);
        fireEvent.click(box("a.ts"));
        expect(model.state.checkedItemIds).toEqual(["a"]);
        expect(itemElement("utils")).toHaveAttribute("aria-checked", "mixed");
        expect(box("utils")).toHaveAttribute("data-indeterminate");
        fireEvent.click(box("b.ts"));
        expect(itemElement("utils")).toHaveAttribute("aria-checked", "true");
        expect(box("utils")).toHaveAttribute("data-checked");
        fireEvent.click(box("utils"));
        expect(model.state.checkedItemIds).toEqual([]);
    });

    it("does not select on a press of the checkbox", () => {
        const model = filesModel();
        render(<FileTree model={model} checkboxes />);
        fireEvent.click(box("app.ts"));
        expect(model.state.selectedItemIds).toEqual([]);
    });

    it("toggles the focused item's check with Space when the root has checkboxes", () => {
        const model = filesModel();
        render(<FileTree model={model} checkboxes />);
        act(() => itemElement("readme.md").focus());
        fireEvent.keyDown(itemElement("readme.md"), { key: " " });
        expect(model.state.checkedItemIds).toEqual(["readme"]);
        expect(itemElement("readme.md")).toHaveAttribute(
            "aria-checked",
            "true",
        );
    });

    it("hides the checkbox from assistive technology: the item carries the state", () => {
        render(<FileTree model={filesModel()} checkboxes />);
        expect(box("app.ts")).toHaveAttribute("aria-hidden", "true");
        expect(box("app.ts")).not.toHaveAttribute("tabindex");
    });
});
