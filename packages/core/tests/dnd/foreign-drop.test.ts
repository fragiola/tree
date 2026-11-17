// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    createTreeForeignDrop,
    type ForeignDrag,
    type ForeignDrop,
} from "../../src/dnd/foreign-drop";
import type { AnnounceEvent } from "../../src/engine/host";
import type { TreeEngineOptions } from "../../src/engine/tree-engine";
import {
    dataTransfer,
    type Mounted,
    mount,
    nativeDrag,
    pointer,
    wait,
} from "../engine/dom";
import { type FileTypes, files as filesJson, filesModel } from "../fixture";

let mounted: Mounted | undefined;
afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
    vi.useRealTimers();
});

function setup(
    options: TreeEngineOptions<FileTypes> = {},
    patch: Parameters<typeof filesModel>[0] = {},
) {
    const announced: AnnounceEvent[] = [];
    mounted = mount(filesModel(patch), {
        autoExpandDelay: 20,
        announce: (event) => {
            announced.push(event);
            return event.type;
        },
        ...options,
    });
    return { m: mounted, announced };
}

/** A foreign drop that records what it is asked and given. */
function recording(accept?: (drag: ForeignDrag<FileTypes>) => boolean) {
    const asked: ForeignDrag<FileTypes>[] = [];
    const dropped: ForeignDrop<FileTypes>[] = [];
    const foreignDrop = createTreeForeignDrop<FileTypes>({
        accept: (drag) => {
            asked.push(drag);
            return accept?.(drag) ?? true;
        },
        onDrop: (drop) => {
            dropped.push(drop);
            for (const file of drop.dataTransfer.files)
                drop.model.run("item.add", {
                    item: {
                        id: file.name,
                        kind: "file",
                        label: file.name,
                        data: { size: file.size },
                    },
                    to: {
                        parentItemId: drop.to.parentItemId,
                        index: drop.to.index,
                    },
                });
        },
    });
    return { foreignDrop, asked, dropped };
}

const files = () =>
    dataTransfer(["Files"], { files: [new File(["abc"], "notes.txt")] });

describe("a foreign drop", () => {
    it("without the option, native drags are ignored", () => {
        const { m } = setup();
        const transfer = files();
        expect(
            nativeDrag(m.root, "dragover", 40, m.rowY("app", 0.1), transfer),
        ).toBe(false);
        expect(m.engine.is("dragging")).toBe(false);
        expect(m.engine.get("drop-target")).toBeNull();
        expect(nativeDrag(m.root, "drop", 40, m.rowY("app"), transfer)).toBe(
            false,
        );
        expect(m.model.state.items["notes.txt"]).toBeUndefined();
    });

    it("shows the evaluated target, then hands the drop to the app with it", () => {
        const { foreignDrop, asked, dropped } = recording();
        const { m, announced } = setup({ foreignDrop });
        const transfer = files();
        expect(
            nativeDrag(m.root, "dragenter", 40, m.rowY("app", 0.1), transfer),
        ).toBe(true);
        expect(transfer.dropEffect).toBe("copy");
        expect(m.engine.is("dragging")).toBe(true);
        expect(m.engine.is("keyboard-dragging")).toBe(false);
        expect(m.engine.get("dragging-item-ids")).toEqual([]);
        expect(m.engine.get("drop-target")).toMatchObject({
            parentItemId: "src",
            index: 0,
            position: "before",
            itemId: "app",
        });
        expect(m.engine.is("item-drop-target", { itemId: "app" })).toBe(true);
        expect(m.engine.get("drop-indicator")).toMatchObject({
            position: "before",
            itemId: "app",
        });
        expect(asked[0]?.types).toEqual(["Files"]);
        expect(announced.at(-1)).toMatchObject({
            type: "foreign-drag-over",
            types: ["Files"],
            target: { itemId: "app", position: "before" },
        });
        expect(
            nativeDrag(m.root, "drop", 40, m.rowY("app", 0.1), transfer),
        ).toBe(true);
        expect(dropped).toHaveLength(1);
        expect(dropped[0]?.dataTransfer).toBe(transfer);
        expect(dropped[0]?.to).toMatchObject({ parentItemId: "src", index: 0 });
        expect(m.model.state.items.src?.childItemIds).toEqual([
            "notes.txt",
            "app",
            "lib",
            "utils",
        ]);
        expect(m.engine.is("dragging")).toBe(false);
        expect(m.engine.get("drop-target")).toBeNull();
        expect(announced.at(-1)).toMatchObject({
            type: "foreign-drop",
            types: ["Files"],
            target: { itemId: "app", position: "before" },
        });
    });

    it("asks accept once per target, and a refused type shows no target", () => {
        const { foreignDrop, asked, dropped } = recording(({ types }) =>
            types.includes("Files"),
        );
        const { m } = setup({ foreignDrop });
        const text = dataTransfer(["text/plain"], {
            text: { "text/plain": "hi" },
        });
        // the root is a drop zone: the dragover is cancelled, with no drop where nothing is taken
        for (let i = 0; i < 5; i++)
            expect(
                nativeDrag(m.root, "dragover", 40, m.rowY("app", 0.1), text),
            ).toBe(true);
        expect(text.dropEffect).toBe("none");
        expect(m.engine.get("drop-target")).toBeNull();
        expect(m.engine.get("drop-indicator")).toBeNull();
        const calls = asked.length;
        expect(calls).toBeGreaterThan(0);
        nativeDrag(m.root, "dragover", 40, m.rowY("app", 0.1), text);
        expect(asked.length).toBe(calls);
        // a drop there opens nothing in the browser, and reaches no onDrop
        expect(nativeDrag(m.root, "drop", 40, m.rowY("app", 0.1), text)).toBe(
            true,
        );
        expect(dropped).toHaveLength(0);
    });

    it("a new drag's types replace those of a drag that ended unseen", () => {
        const { foreignDrop } = recording(({ types }) =>
            types.includes("Files"),
        );
        const { m } = setup({ foreignDrop });
        const text = dataTransfer(["text/plain"]);
        nativeDrag(m.root, "dragenter", 40, m.rowY("app", 0.1), text);
        expect(m.engine.get("drop-target")).toBeNull();
        expect(
            nativeDrag(m.root, "dragenter", 40, m.rowY("app", 0.1), files()),
        ).toBe(true);
        expect(m.engine.get("drop-target")).not.toBeNull();
    });

    it("a disabled or non-droppable parent takes no foreign drop", () => {
        const { foreignDrop } = recording();
        const json = filesJson();
        const { m } = setup(
            { foreignDrop },
            {
                items: {
                    ...json.items,
                    src: { ...json.items.src, droppable: false },
                    utils: { ...json.items.utils, disabled: true },
                } as typeof json.items,
            },
        );
        nativeDrag(m.root, "dragover", 40, m.rowY("app", 0.1), files());
        expect(m.engine.get("drop-target")?.parentItemId).not.toBe("src");
        nativeDrag(m.root, "dragover", 40, m.rowY("utils", 0.5), files());
        expect(m.engine.get("drop-target")?.parentItemId).not.toBe("utils");
    });

    it("a dragleave to an element inside the root keeps the drag; out of it ends it", () => {
        const { foreignDrop } = recording();
        const { m } = setup({ foreignDrop });
        const transfer = files();
        nativeDrag(m.root, "dragover", 40, m.rowY("app", 0.1), transfer);
        nativeDrag(
            m.content("app"),
            "dragleave",
            40,
            m.rowY("app", 0.1),
            transfer,
            m.content("lib"),
        );
        expect(m.engine.is("dragging")).toBe(true);
        nativeDrag(
            m.root,
            "dragleave",
            400,
            m.rowY("app"),
            transfer,
            document.body,
        );
        expect(m.engine.is("dragging")).toBe(false);
        expect(m.engine.get("drop-target")).toBeNull();
    });

    it("a dragleave with no related target ends the drag unless a dragover follows", async () => {
        const { foreignDrop } = recording();
        const { m, announced } = setup({ foreignDrop });
        const transfer = files();
        nativeDrag(m.root, "dragover", 40, m.rowY("utils", 0.5), transfer);
        // between two children (some browsers): a dragover follows, the drag goes on
        nativeDrag(m.root, "dragleave", 40, m.rowY("utils", 0.5), transfer);
        nativeDrag(m.root, "dragover", 40, m.rowY("app", 0.1), transfer);
        await wait(150);
        expect(m.engine.is("dragging")).toBe(true);
        // Escape: nothing follows, the drag ends and no folder expands
        nativeDrag(m.root, "dragover", 40, m.rowY("utils", 0.5), transfer);
        nativeDrag(m.root, "dragleave", 40, m.rowY("utils", 0.5), transfer);
        await wait(150);
        expect(m.engine.is("dragging")).toBe(false);
        expect(m.model.is("item-expanded", { itemId: "utils" })).toBe(false);
        expect(announced.at(-1)).toMatchObject({
            type: "foreign-drag-over",
            target: null,
        });
    });

    it("cancel-drag ends a foreign drag", () => {
        const { foreignDrop } = recording();
        const { m } = setup({ foreignDrop });
        nativeDrag(m.root, "dragover", 40, m.rowY("app", 0.1), files());
        expect(m.engine.run("cancel-drag").ok).toBe(true);
        expect(m.engine.is("dragging")).toBe(false);
        expect(m.engine.get("drop-target")).toBeNull();
    });

    it("expands a hovered collapsed parent after the delay", async () => {
        const { foreignDrop } = recording();
        const { m } = setup({ foreignDrop });
        nativeDrag(m.root, "dragover", 40, m.rowY("utils", 0.5), files());
        expect(m.engine.get("drop-target")).toMatchObject({
            parentItemId: "utils",
            position: "inside",
        });
        await wait(40);
        expect(m.model.is("item-expanded", { itemId: "utils" })).toBe(true);
    });

    it("ends a drag no dragover keeps alive", () => {
        vi.useFakeTimers();
        const { foreignDrop } = recording();
        const { m } = setup({ foreignDrop });
        nativeDrag(m.root, "dragover", 40, m.rowY("app", 0.1), files());
        vi.advanceTimersByTime(900);
        nativeDrag(m.root, "dragover", 40, m.rowY("app", 0.1), files());
        vi.advanceTimersByTime(600);
        expect(m.engine.is("dragging")).toBe(true);
        vi.advanceTimersByTime(1600);
        expect(m.engine.is("dragging")).toBe(false);
    });

    it("leaves a tree's own pointer drag alone", () => {
        const { foreignDrop, dropped } = recording();
        const { m } = setup({ foreignDrop });
        const content = m.content("readme");
        pointer(content, "pointerdown", 40, m.rowY("readme"));
        pointer(content, "pointermove", 40, m.rowY("readme") + 10);
        expect(m.engine.get("dragging-item-ids")).toEqual(["readme"]);
        // refused, so the browser opens nothing either
        expect(
            nativeDrag(m.root, "drop", 40, m.rowY("app", 0.1), files()),
        ).toBe(true);
        expect(dropped).toHaveLength(0);
        expect(m.engine.get("dragging-item-ids")).toEqual(["readme"]);
        pointer(content, "pointerup", 40, m.rowY("readme") + 10);
    });

    it("drops into an empty tree", () => {
        const { foreignDrop, dropped } = recording();
        const { m } = setup(
            { foreignDrop },
            { rootItemIds: [], items: {}, expandedItemIds: [] },
        );
        expect(nativeDrag(m.root, "dragover", 40, 10, files())).toBe(true);
        expect(m.engine.get("drop-target")).toMatchObject({
            parentItemId: null,
            index: 0,
            itemId: null,
        });
        nativeDrag(m.root, "drop", 40, 10, files());
        expect(dropped).toHaveLength(1);
        expect(m.model.state.rootItemIds).toEqual(["notes.txt"]);
    });

    it("destroy ends the foreign drag", () => {
        const { foreignDrop } = recording();
        const { m } = setup({ foreignDrop });
        nativeDrag(m.root, "dragover", 40, m.rowY("app", 0.1), files());
        m.engine.destroy();
        expect(m.engine.is("dragging")).toBe(false);
    });
});
