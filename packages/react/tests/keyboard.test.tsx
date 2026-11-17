import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileTree, filesModel, itemElement } from "./tree";

const press = (key: string, init: Partial<KeyboardEventInit> = {}) => {
    const target = document.activeElement ?? document.body;
    fireEvent.keyDown(target, { key, ...init });
};

describe("the keyboard (WAI-ARIA APG Tree View)", () => {
    it("moves DOM focus with the arrows, Home and End", () => {
        render(<FileTree model={filesModel()} />);
        act(() => itemElement("src").focus());
        press("ArrowDown");
        expect(itemElement("app.ts")).toHaveFocus();
        press("End");
        expect(itemElement("readme.md")).toHaveFocus();
        press("Home");
        expect(itemElement("src")).toHaveFocus();
        expect(itemElement("src")).toHaveAttribute("tabindex", "0");
    });

    it("expands and collapses with Right and Left, keeping focus on the item", () => {
        const model = filesModel();
        render(<FileTree model={model} />);
        act(() => itemElement("utils").focus());
        press("ArrowRight");
        expect(model.is("item-expanded", { itemId: "utils" })).toBe(true);
        expect(itemElement("a.ts")).toBeInTheDocument();
        press("ArrowRight");
        expect(itemElement("a.ts")).toHaveFocus();
        press("ArrowLeft");
        expect(itemElement("utils")).toHaveFocus();
        press("ArrowLeft");
        expect(model.is("item-expanded", { itemId: "utils" })).toBe(false);
        expect(itemElement("utils")).toHaveFocus();
    });

    it("keeps DOM focus in the tree when a collapse removes the focused item", () => {
        const model = filesModel({ expandedItemIds: ["src", "utils"] });
        render(<FileTree model={model} />);
        act(() => itemElement("a.ts").focus());
        act(() => {
            model.run("item.collapse", { itemId: "src" });
        });
        expect(screen.queryByText("a.ts")).toBeNull();
        expect(model.state.focusedItemId).toBe("src");
        expect(itemElement("src")).toHaveFocus();
    });

    it("swaps Right and Left in a right-to-left tree", () => {
        const model = filesModel();
        render(
            <div dir="rtl">
                <FileTree model={model} />
            </div>,
        );
        act(() => itemElement("utils").focus());
        press("ArrowLeft");
        expect(model.is("item-expanded", { itemId: "utils" })).toBe(true);
    });

    it("finds an item by typing its label (type-ahead)", () => {
        render(<FileTree model={filesModel()} />);
        act(() => itemElement("src").focus());
        press("r");
        expect(itemElement("readme.md")).toHaveFocus();
    });

    it("takes a key map over the defaults", () => {
        const model = filesModel();
        render(<FileTree model={model} keyMap={{ "focus-next": ["j"] }} />);
        act(() => itemElement("src").focus());
        press("j");
        expect(itemElement("app.ts")).toHaveFocus();
    });

    it("starts a rename with F2", () => {
        const model = filesModel();
        render(<FileTree model={model} />);
        act(() => itemElement("app.ts").focus());
        press("F2");
        expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    });
});
