import type { CommandEvent } from "@fragiola/tree";
import { describe, expect, it } from "vitest";
import { h } from "vue";
import type { ItemOf } from "../src";
import {
    content,
    type FileTypes,
    filesModel,
    fileTree,
    fire,
    focus,
    itemElement,
    render,
    Tree,
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

    it("leaves a press on a control of the row to it, even when its listener removed it", async () => {
        const model = filesModel();
        const presses: string[] = [];
        await render(() =>
            h(
                Tree.Root,
                { model, expandOnClick: true, "aria-label": "Files" },
                () =>
                    h(Tree.Items, null, {
                        default: ({ item }: { item: ItemOf<FileTypes> }) => [
                            h(Tree.Item, { item }, () =>
                                h(Tree.ItemContent, null, () => [
                                    h("span", item.label),
                                    // a control whose command removes it (a Retry button on a failed load)
                                    model.is("item-selected", {
                                        itemId: "src",
                                    }) || item.id !== "src"
                                        ? null
                                        : h(
                                              "button",
                                              {
                                                  type: "button",
                                                  onClick: () => {
                                                      presses.push("retry");
                                                      model.run("tree.select", {
                                                          itemIds: ["src"],
                                                      });
                                                  },
                                              },
                                              "Retry",
                                          ),
                                ]),
                            ),
                        ],
                    }),
            ),
        );
        const button = document.querySelector("button");
        if (!button) throw new Error("no button");
        // as a browser does: Vue flushes between the button's listener and the row's
        button.addEventListener("click", () => {
            const content = button.closest('[data-tree-part="content"]');
            button.remove();
            expect(content?.contains(button)).toBe(false);
        });
        await fire(button, "click");
        expect(presses).toEqual(["retry"]);
        // the row neither collapsed src (expand-on-click) nor took the press
        expect(model.is("item-expanded", { itemId: "src" })).toBe(true);
    });
});
