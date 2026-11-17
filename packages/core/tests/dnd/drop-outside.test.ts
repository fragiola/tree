// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
    createTreeDropOutside,
    type DropOutside,
} from "../../src/dnd/drop-outside";
import type { AnnounceEvent } from "../../src/engine/host";
import type { TreeEngineOptions } from "../../src/engine/tree-engine";
import { type Mounted, mount, pointer } from "../engine/dom";
import { type FileTypes, filesModel } from "../fixture";

let trees: Mounted[] = [];
let zone: HTMLElement | undefined;
afterEach(() => {
    for (const tree of trees) tree.unmount();
    trees = [];
    zone?.remove();
    zone = undefined;
    Reflect.deleteProperty(document, "elementFromPoint");
});

/** A trash zone right of the tree (x 500 and past), found by `elementFromPoint` (jsdom has none). */
function trash(): HTMLElement {
    zone = document.createElement("div");
    zone.dataset.trash = "";
    document.body.append(zone);
    const found = zone;
    Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: (x: number) => (x >= 500 ? found : document.body),
    });
    return found;
}

function setup(
    options: TreeEngineOptions<FileTypes> = {},
    model = filesModel(),
    left = 0,
) {
    const announced: AnnounceEvent[] = [];
    const m = mount(
        model,
        {
            announce: (event) => {
                announced.push(event);
                return event.type;
            },
            ...options,
        },
        document,
        left,
    );
    trees.push(m);
    return { m, announced };
}

/** A drop outside that removes the items dropped on the trash. */
function removing() {
    const dropped: DropOutside<FileTypes>[] = [];
    const dropOutside = createTreeDropOutside<FileTypes>({
        onDrop: (drop) => {
            dropped.push(drop);
            return (
                drop.element?.closest("[data-trash]") != null &&
                drop.model.run("item.remove", { itemIds: [...drop.itemIds] }).ok
            );
        },
    });
    return { dropOutside, dropped };
}

function drag(m: Mounted, itemId: string, x: number, y: number) {
    const content = m.content(itemId);
    pointer(content, "pointerdown", 40, m.rowY(itemId));
    pointer(content, "pointermove", 40, m.rowY(itemId) + 10);
    pointer(content, "pointermove", x, y);
    return content;
}

describe("a drop outside the tree", () => {
    it("without the option, a release outside cancels", () => {
        trash();
        const { m, announced } = setup();
        const content = drag(m, "readme", 600, 50);
        expect(m.engine.get("drop-outside-element")).toBeNull();
        pointer(content, "pointerup", 600, 50);
        expect(announced.at(-1)).toEqual({
            type: "drag-cancel",
            itemIds: ["readme"],
        });
        expect(m.model.state.rootItemIds).toEqual(["src", "readme"]);
    });

    it("hands the items, the point and the element under it to the app", () => {
        const found = trash();
        const { dropOutside, dropped } = removing();
        const { m, announced } = setup({ dropOutside });
        const content = drag(m, "readme", 600, 50);
        // the app's targets see the drag over them
        expect(m.engine.is("dragging")).toBe(true);
        expect(m.engine.get("drop-outside-element")).toBe(found);
        expect(m.engine.get("drop-target")).toBeNull();
        pointer(content, "pointerup", 600, 50);
        expect(dropped).toHaveLength(1);
        expect(dropped[0]).toMatchObject({
            itemIds: ["readme"],
            element: found,
            x: 600,
            y: 50,
            modifiers: { altKey: false, ctrlKey: false, metaKey: false },
        });
        expect(dropped[0]?.model).toBe(m.model);
        expect(m.model.state.rootItemIds).toEqual(["src"]);
        expect(m.engine.is("dragging")).toBe(false);
        expect(m.engine.get("drop-outside-element")).toBeNull();
        expect(announced.at(-1)).toEqual({
            type: "drop-outside",
            itemIds: ["readme"],
            element: found,
        });
    });

    it("an app that does not take the items cancels the drag", () => {
        trash();
        const { dropOutside, dropped } = removing();
        const { m, announced } = setup({ dropOutside });
        const content = drag(m, "readme", 450, 50);
        expect(m.engine.get("drop-outside-element")).toBe(document.body);
        pointer(content, "pointerup", 450, 50);
        expect(dropped).toHaveLength(1);
        expect(m.model.state.rootItemIds).toEqual(["src", "readme"]);
        expect(announced.at(-1)?.type).toBe("drag-cancel");
    });

    it("inside the tree nothing changes: back over it, the element is gone and a release drops there", () => {
        trash();
        const { dropOutside, dropped } = removing();
        const { m } = setup({ dropOutside });
        const content = drag(m, "readme", 600, 50);
        pointer(content, "pointermove", 40, m.rowY("app", 0.1));
        expect(m.engine.get("drop-outside-element")).toBeNull();
        pointer(content, "pointerup", 40, m.rowY("app", 0.1));
        expect(dropped).toHaveLength(0);
        expect(m.model.state.items.src?.childItemIds?.[0]).toBe("readme");
    });

    it("past the view of the scroll container the root is in, the drag is outside", () => {
        trash();
        const { dropOutside, dropped } = removing();
        const { m } = setup({ dropOutside });
        // the root (100px of rows) in a container that shows its first 50px
        const container = document.createElement("div");
        container.style.overflowY = "auto";
        container.getBoundingClientRect = () =>
            ({
                top: 0,
                left: 0,
                width: 300,
                height: 50,
                right: 300,
                bottom: 50,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }) as DOMRect;
        document.body.append(container);
        container.append(m.root);
        try {
            // below the view, over the hidden rows of the root: outside
            const content = drag(m, "app", 40, 90);
            expect(m.engine.get("drop-outside-element")).toBe(document.body);
            expect(m.engine.get("drop-target")).toBeNull();
            pointer(content, "pointerup", 40, 90);
            expect(dropped).toHaveLength(1);
            expect(dropped[0]?.element).toBe(document.body);
            // not the trash: the app refused, nothing moved to a hidden row
            expect(m.model.state.items.src?.childItemIds).toEqual([
                "app",
                "lib",
                "utils",
            ]);
        } finally {
            container.remove();
        }
    });

    it("in a drag group, a release over another tree of the group is not outside", () => {
        trash();
        const { dropOutside, dropped } = removing();
        const model = filesModel();
        const { m } = setup({ dropOutside, dragGroup: "files" }, model);
        const { m: other } = setup({ dragGroup: "files" }, model, 400);
        const content = drag(m, "readme", 440, other.rowY("app", 0.1));
        expect(m.engine.get("drop-outside-element")).toBeNull();
        pointer(content, "pointerup", 440, other.rowY("app", 0.1));
        expect(dropped).toHaveLength(0);
        expect(model.state.items.src?.childItemIds?.[0]).toBe("readme");
    });
});
