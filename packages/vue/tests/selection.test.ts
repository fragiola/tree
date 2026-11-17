import type { CommandEvent } from "@fragiola/tree";
import { describe, expect, it } from "vitest";
import {
    content,
    type FileTypes,
    filesModel,
    fileTree,
    fire,
    focus,
    itemElement,
    render,
} from "./tree";

async function setup(selectionMode: "single" | "multiple" = "multiple") {
    const model = filesModel({ settings: { selectionMode } });
    const events: CommandEvent<FileTypes>[] = [];
    model.subscribe((event) => events.push(event));
    await render(() => fileTree({ model }));
    return { model, events };
}

describe("selection", () => {
    it("selects and focuses an item on a click, through commands", async () => {
        const { model, events } = await setup("single");
        await fire(content("app.ts"), "click");
        expect(model.state.selectedItemIds).toEqual(["app"]);
        expect(itemElement("app.ts")).toHaveFocus();
        expect(itemElement("app.ts")).toHaveAttribute("data-selected", "");
        expect(events.map((event) => event.command)).toEqual([
            "item.focus",
            "item.select",
        ]);
    });

    it("toggles with Ctrl and extends a range with Shift", async () => {
        const { model } = await setup();
        await fire(content("app.ts"), "click");
        await fire(content("readme.md"), "click", { ctrlKey: true });
        expect(model.state.selectedItemIds).toEqual(["app", "readme"]);
        // from the anchor (readme, the last press) to lib: the visible range
        await fire(content("lib"), "click", { shiftKey: true });
        expect([...model.state.selectedItemIds].sort()).toEqual([
            "lib",
            "readme",
            "utils",
        ]);
    });

    it("selects with Space, extends with Shift+ArrowDown and selects all with Ctrl+A", async () => {
        const { model } = await setup();
        await focus(itemElement("src"));
        await fire(itemElement("src"), "keydown", { key: " " });
        expect(model.state.selectedItemIds).toEqual(["src"]);
        await fire(itemElement("src"), "keydown", {
            key: "ArrowDown",
            shiftKey: true,
        });
        expect(model.state.selectedItemIds).toEqual(["src", "app"]);
        expect(itemElement("app.ts")).toHaveFocus();
        await fire(itemElement("app.ts"), "keydown", {
            key: "a",
            ctrlKey: true,
        });
        expect(model.state.selectedItemIds).toHaveLength(5);
    });

    it("does not select on a press of the toggle: it only expands", async () => {
        const { model } = await setup();
        const toggle = itemElement("utils").querySelector(
            '[data-tree-part="toggle"]',
        );
        if (!toggle) throw new Error("no toggle");
        await fire(toggle, "click");
        expect(model.is("item-expanded", { itemId: "utils" })).toBe(true);
        expect(model.state.selectedItemIds).toEqual([]);
    });

    it("expands on a click of a parent's row with expand-on-click", async () => {
        const model = filesModel();
        await render(() => fileTree({ model, expandOnClick: true }));
        await fire(content("utils"), "click");
        expect(model.is("item-expanded", { itemId: "utils" })).toBe(true);
        expect(model.state.selectedItemIds).toEqual(["utils"]);
    });
});
