import { describe, expect, it } from "vitest";
import { h } from "vue";
import {
    filesModel,
    fileTree,
    focus,
    itemElement,
    press,
    render,
    settle,
} from "./tree";

describe("the keyboard (WAI-ARIA APG Tree View)", () => {
    it("moves DOM focus with the arrows, Home and End", async () => {
        await render(() => fileTree({ model: filesModel() }));
        await focus(itemElement("src"));
        await press("ArrowDown");
        expect(itemElement("app.ts")).toHaveFocus();
        await press("End");
        expect(itemElement("readme.md")).toHaveFocus();
        await press("Home");
        expect(itemElement("src")).toHaveFocus();
        expect(itemElement("src")).toHaveAttribute("tabindex", "0");
    });

    it("expands and collapses with Right and Left, keeping focus on the item", async () => {
        const model = filesModel();
        await render(() => fileTree({ model }));
        await focus(itemElement("utils"));
        await press("ArrowRight");
        expect(model.is("item-expanded", { itemId: "utils" })).toBe(true);
        expect(itemElement("a.ts")).toBeInTheDocument();
        await press("ArrowRight");
        expect(itemElement("a.ts")).toHaveFocus();
        await press("ArrowLeft");
        expect(itemElement("utils")).toHaveFocus();
        await press("ArrowLeft");
        expect(model.is("item-expanded", { itemId: "utils" })).toBe(false);
        expect(itemElement("utils")).toHaveFocus();
    });

    it("keeps DOM focus in the tree when a collapse removes the focused item", async () => {
        const model = filesModel({ expandedItemIds: ["src", "utils"] });
        await render(() => fileTree({ model }));
        await focus(itemElement("a.ts"));
        model.run("item.collapse", { itemId: "src" });
        await settle();
        expect(() => itemElement("a.ts")).toThrow();
        expect(model.state.focusedItemId).toBe("src");
        expect(itemElement("src")).toHaveFocus();
    });

    it("keeps DOM focus on an item moved into another parent (a new element)", async () => {
        const model = filesModel();
        await render(() => fileTree({ model }));
        await focus(itemElement("readme.md"));
        model.run("item.move", {
            itemIds: ["readme"],
            to: { parentItemId: "src", index: 0 },
        });
        await settle();
        expect(itemElement("readme.md")).toHaveAttribute("aria-level", "2");
        expect(itemElement("readme.md")).toHaveFocus();
    });

    it("swaps Right and Left in a right-to-left tree", async () => {
        const model = filesModel();
        await render(() => h("div", { dir: "rtl" }, [fileTree({ model })]));
        await focus(itemElement("utils"));
        await press("ArrowLeft");
        expect(model.is("item-expanded", { itemId: "utils" })).toBe(true);
    });

    it("finds an item by typing its label (type-ahead)", async () => {
        await render(() => fileTree({ model: filesModel() }));
        await focus(itemElement("src"));
        await press("r");
        expect(itemElement("readme.md")).toHaveFocus();
    });

    it("takes a key map over the defaults", async () => {
        await render(() =>
            fileTree({ model: filesModel(), keyMap: { "focus-next": ["j"] } }),
        );
        await focus(itemElement("src"));
        await press("j");
        expect(itemElement("app.ts")).toHaveFocus();
    });

    it("starts a rename with F2", async () => {
        await render(() => fileTree({ model: filesModel() }));
        await focus(itemElement("app.ts"));
        await press("F2");
        expect(
            document.querySelector('input[aria-label="Name"]'),
        ).toHaveFocus();
    });
});
