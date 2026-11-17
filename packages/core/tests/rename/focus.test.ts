// @vitest-environment jsdom
// A rename started while DOM focus is outside the tree (a toolbar button) and ended by another
// command still gives focus back to the item: the rename feature tracks every model change.
import { afterEach, describe, expect, it } from "vitest";
import { type Mounted, mount } from "../engine/dom";
import { filesModel } from "../fixture";

let mounted: Mounted | undefined;
let toolbar: HTMLButtonElement | undefined;
afterEach(() => {
    mounted?.unmount();
    toolbar?.remove();
    mounted = undefined;
    toolbar = undefined;
});

/** Starts a rename from a button outside the tree, then focuses the app's editor in the row. */
function renameFromOutside(): Mounted {
    const m = mount(filesModel());
    mounted = m;
    m.engine.run("focus", { itemId: "app" });
    toolbar = document.createElement("button");
    document.body.append(toolbar);
    toolbar.focus();
    m.model.run("item.start-rename", { itemId: "app" });
    const input = document.createElement("input");
    m.content("app").append(input);
    input.focus();
    return m;
}

describe("focus after a rename started from outside the tree", () => {
    it("goes back to the item when another command ends the rename", () => {
        const m = renameFromOutside();
        m.model.run("item.cancel-rename", { itemId: "app" });
        expect(document.activeElement).toBe(m.item("app"));
    });

    it("goes back to the item when disabling it ends the rename", () => {
        const m = renameFromOutside();
        m.model.run("item.set-flags", { itemId: "app", disabled: true });
        expect(document.activeElement).toBe(m.item("app"));
    });

    it("goes back to the item when the settings end the rename", () => {
        const m = renameFromOutside();
        m.model.run("tree.configure", { settings: { renamable: false } });
        expect(document.activeElement).toBe(m.item("app"));
    });
});
