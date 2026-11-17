import type { CommandEvent } from "@fragiola/tree";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    content,
    FileTree,
    type FileTypes,
    filesModel,
    itemElement,
} from "./tree";

function setup(selectionMode: "single" | "multiple" = "multiple") {
    const model = filesModel({ settings: { selectionMode } });
    const events: CommandEvent<FileTypes>[] = [];
    model.subscribe((event) => events.push(event));
    render(<FileTree model={model} />);
    return { model, events };
}

describe("selection", () => {
    it("selects and focuses an item on a click, through commands", () => {
        const { model, events } = setup("single");
        fireEvent.click(content("app.ts"));
        expect(model.state.selectedItemIds).toEqual(["app"]);
        expect(itemElement("app.ts")).toHaveFocus();
        expect(itemElement("app.ts")).toHaveAttribute("data-selected", "");
        expect(events.map((event) => event.command)).toEqual([
            "item.focus",
            "item.select",
        ]);
    });

    it("toggles with Ctrl and extends a range with Shift", () => {
        const { model } = setup();
        fireEvent.click(content("app.ts"));
        fireEvent.click(content("readme.md"), { ctrlKey: true });
        expect(model.state.selectedItemIds).toEqual(["app", "readme"]);
        // from the anchor (readme, the last press) to lib: the visible range
        fireEvent.click(content("lib"), { shiftKey: true });
        expect([...model.state.selectedItemIds].sort()).toEqual([
            "lib",
            "readme",
            "utils",
        ]);
    });

    it("selects with Space, extends with Shift+ArrowDown and selects all with Ctrl+A", () => {
        const { model } = setup();
        act(() => itemElement("src").focus());
        fireEvent.keyDown(itemElement("src"), { key: " " });
        expect(model.state.selectedItemIds).toEqual(["src"]);
        fireEvent.keyDown(itemElement("src"), {
            key: "ArrowDown",
            shiftKey: true,
        });
        expect(model.state.selectedItemIds).toEqual(["src", "app"]);
        expect(itemElement("app.ts")).toHaveFocus();
        fireEvent.keyDown(itemElement("app.ts"), { key: "a", ctrlKey: true });
        expect(model.state.selectedItemIds).toHaveLength(5);
    });

    it("does not select on a press of the toggle: it only expands", () => {
        const { model } = setup();
        const toggle = itemElement("utils").querySelector(
            '[data-tree-part="toggle"]',
        );
        if (!toggle) throw new Error("no toggle");
        fireEvent.click(toggle);
        expect(model.is("item-expanded", { itemId: "utils" })).toBe(true);
        expect(model.state.selectedItemIds).toEqual([]);
    });

    it("expands on a click of a parent's row with expandOnClick", () => {
        const model = filesModel();
        render(<FileTree model={model} expandOnClick />);
        fireEvent.click(content("utils"));
        expect(model.is("item-expanded", { itemId: "utils" })).toBe(true);
        expect(model.state.selectedItemIds).toEqual(["utils"]);
    });
});
