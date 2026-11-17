import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tree } from "../src";
import { FileTree, filesModel, itemElement } from "./tree";

const box = (label: string) => {
    const element = itemElement(label).querySelector(
        ':scope > [data-tree-part="content"] > [data-testid="check"]',
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

    it("does not select on a press of the app's check control", () => {
        const model = filesModel();
        render(<FileTree model={model} checkboxes />);
        fireEvent.pointerDown(box("app.ts"), { button: 0, isPrimary: true });
        fireEvent.click(box("app.ts"));
        expect(model.state.selectedItemIds).toEqual([]);
        expect(model.state.checkedItemIds).toEqual(["app"]);
    });

    it("does not select on a press of a control that is not native, with data-tree-no-drag", () => {
        const model = filesModel();
        render(
            <Tree.Root model={model} checkboxes aria-label="Files">
                <Tree.Items>
                    {(item) => (
                        <Tree.Item item={item}>
                            <Tree.ItemContent>
                                <span>{item.label}</span>
                                {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: a non-native check control, hidden from assistive technology; Space on the item is its key */}
                                <span
                                    data-tree-no-drag=""
                                    data-testid="check"
                                    onClick={() =>
                                        model.run("item.toggle-check", {
                                            itemId: item.id,
                                        })
                                    }
                                />
                            </Tree.ItemContent>
                        </Tree.Item>
                    )}
                </Tree.Items>
            </Tree.Root>,
        );
        fireEvent.click(box("readme.md"));
        expect(model.state.selectedItemIds).toEqual([]);
        expect(model.state.checkedItemIds).toEqual(["readme"]);
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

    it("leaves the check control to the app: the item carries the state, and renders no checkbox of its own", () => {
        render(<FileTree model={filesModel()} checkboxes />);
        expect(itemElement("app.ts")).toHaveAttribute("aria-checked", "false");
        expect(document.querySelector('[role="checkbox"]')).toBeNull();
        expect(
            document.querySelector('[data-tree-part="checkbox"]'),
        ).toBeNull();
    });
});
