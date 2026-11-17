// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { CommandEvent } from "../../src/commands/types";
import { veto } from "../../src/commands/types";
import {
    type DragGroupFeature,
    dragGroup,
} from "../../src/drag-group/drag-group";
import { dropOutside } from "../../src/drop-outside/drop-outside";
import type { TransferHandler, TreeTransfer } from "../../src/drop-target/host";
import { type DragSession, dragSessionOf } from "../../src/drop-target/session";
import type { AnnounceEvent } from "../../src/engine/host";
import type { TreeEngineOptions } from "../../src/engine/tree-engine";
import type { TreeFeatures } from "../../src/features/types";
import { createTreeModel, type TreeModel } from "../../src/state/model";
import { type Mounted, mount, pointer, WIDTH } from "../engine/dom";
import { allFeatures, type FileTypes, filesModel } from "../fixture";

// tree A at x 0-300, tree B at x 400-700
const B_LEFT = WIDTH + 100;
const inA = 40;
const inB = B_LEFT + 40;

let trees: Mounted[] = [];
afterEach(() => {
    for (const tree of trees) tree.unmount();
    trees = [];
});

function tree<F extends TreeFeatures>(
    model: TreeModel<FileTypes, F>,
    options: TreeEngineOptions<FileTypes> = {},
    left = 0,
    doc: Document = document,
): Mounted<F> {
    const mounted = mount(model, options, doc, left);
    trees.push(mounted as unknown as Mounted);
    return mounted;
}

/** Every feature, and the drag group `name` (its trees of one document share their drags). */
const groupFeatures = (name = "g", transfer?: TransferHandler) =>
    [
        ...allFeatures({ dragAndDrop: { autoExpandDelay: 20 } }),
        dragGroup({ name, transfer }),
    ] as const;
type GroupFeatures = ReturnType<typeof groupFeatures>;

/** `filesModel()` in the drag group `name`. */
function groupedFiles(
    patch: Parameters<typeof filesModel>[0] = {},
    name = "g",
) {
    return filesModel<GroupFeatures>(patch, {
        features: groupFeatures(name),
    });
}

/** A second model: one folder, `inbox`, and a file. */
function inboxModel(transfer?: TransferHandler) {
    return createTreeModel<FileTypes, GroupFeatures>(
        {
            version: 1,
            rootItemIds: ["inbox", "note"],
            items: {
                inbox: { kind: "folder", label: "inbox", childItemIds: [] },
                note: { kind: "file", label: "note", data: { size: 9 } },
            },
        },
        { features: groupFeatures("g", transfer) },
    );
}

function recorded<F extends TreeFeatures>(model: TreeModel<FileTypes, F>) {
    const events: CommandEvent<FileTypes>[] = [];
    model.subscribe((event) => events.push(event));
    return events;
}

/** Presses `itemId`'s row in `m` and moves past the threshold. */
function startDrag(m: Mounted, itemId: string) {
    const content = m.content(itemId);
    const y = m.rowY(itemId);
    pointer(content, "pointerdown", inA, y);
    pointer(content, "pointermove", inA, y + 10);
}

const describeTarget = (m: Mounted) => {
    const target = m.engine.get("drop-target");
    return target && `${target.position} ${target.itemId}`;
};

describe("a drag group", () => {
    it("without a group, a drag stays in its tree", () => {
        const model = filesModel();
        const a = tree(model);
        const b = tree(model, {}, B_LEFT);
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inB, b.rowY("app", 0.1));
        expect(a.engine.get("drop-target")).toBeNull();
        expect(b.engine.is("dragging")).toBe(false);
        expect(b.engine.get("drop-target")).toBeNull();
        pointer(a.content("readme"), "pointerup", inB, b.rowY("app", 0.1));
        expect(model.state.rootItemIds).toEqual(["src", "readme"]);
    });

    it("over one model, a pointer drop in the other tree is one item.move", () => {
        const model = groupedFiles();
        const events = recorded(model);
        const announced: AnnounceEvent[] = [];
        const a = tree(model, {
            announce: (event) => {
                announced.push(event);
                return event.type;
            },
        });
        const b = tree(model, {}, B_LEFT);
        startDrag(a, "readme");
        // the other tree knows of the drag, and drags the same item
        expect(b.engine.is("dragging")).toBe(true);
        expect(b.engine.is("dragging-from-other-tree")).toBe(true);
        expect(a.engine.is("dragging-from-other-tree")).toBe(false);
        expect(b.engine.is("item-dragging", { itemId: "readme" })).toBe(true);
        pointer(a.content("readme"), "pointermove", inB, b.rowY("app", 0.1));
        expect(describeTarget(b)).toBe("before app");
        expect(b.engine.get("drop-indicator")).toMatchObject({
            position: "before",
            itemId: "app",
        });
        expect(a.engine.get("drop-target")).toBeNull();
        expect(announced.at(-1)).toMatchObject({
            type: "drag-over",
            target: { itemId: "app", position: "before" },
            targetTree: { root: b.root, model },
        });
        pointer(a.content("readme"), "pointerup", inB, b.rowY("app", 0.1));
        expect(a.engine.is("dragging")).toBe(false);
        expect(b.engine.is("dragging")).toBe(false);
        expect(model.state.items.src?.childItemIds).toEqual([
            "readme",
            "app",
            "lib",
            "utils",
        ]);
        expect(events.map((event) => event.command)).toEqual(["item.move"]);
        expect(announced.at(-1)).toMatchObject({
            type: "drop",
            targetTree: { root: b.root },
        });
    });

    it("back over its own tree, the target is the source's again", () => {
        const model = groupedFiles();
        const a = tree(model, {});
        const b = tree(model, {}, B_LEFT);
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inB, b.rowY("app", 0.1));
        expect(describeTarget(b)).toBe("before app");
        pointer(a.content("readme"), "pointermove", inA, a.rowY("app", 0.1));
        expect(describeTarget(a)).toBe("before app");
        expect(b.engine.get("drop-target")).toBeNull();
        expect(b.engine.is("dragging")).toBe(true);
        // outside both
        pointer(a.content("readme"), "pointermove", WIDTH + 50, 10);
        expect(a.engine.get("drop-target")).toBeNull();
        expect(b.engine.get("drop-target")).toBeNull();
    });

    it("over two models, the target adds the subtree and the source removes it", () => {
        const files = groupedFiles({ expandedItemIds: ["src", "utils"] });
        const inbox = inboxModel();
        const fromEvents = recorded(files);
        const toEvents = recorded(inbox);
        const a = tree(files, {});
        const b = tree(inbox, {}, B_LEFT);
        startDrag(a, "utils");
        // another model: no item of its own is dragged
        expect(b.engine.get("dragging-item-ids")).toEqual([]);
        expect(b.engine.is("dragging-from-other-tree")).toBe(true);
        pointer(a.content("utils"), "pointermove", inB, b.rowY("inbox", 0.5));
        expect(describeTarget(b)).toBe("inside inbox");
        pointer(a.content("utils"), "pointerup", inB, b.rowY("inbox", 0.5));
        expect(inbox.state.items.inbox?.childItemIds).toEqual(["utils"]);
        expect(inbox.state.items.utils).toMatchObject({
            kind: "folder",
            label: "utils",
            childItemIds: ["a", "b"],
        });
        expect(inbox.state.items.b).toMatchObject({ data: { size: 2 } });
        // expanded as it was
        expect(inbox.is("item-expanded", { itemId: "utils" })).toBe(true);
        expect(files.state.items.src?.childItemIds).toEqual(["app", "lib"]);
        expect(files.state.items.a).toBeUndefined();
        expect(toEvents.map((event) => event.command)).toEqual(["batch"]);
        expect(fromEvents.map((event) => event.command)).toEqual([
            "item.remove",
        ]);
    });

    it("a target the target model refuses never shows", () => {
        const files = groupedFiles();
        const inbox = inboxModel();
        inbox.use((ctx, next) =>
            ctx.command === "item.add" && ctx.payload.to.parentItemId === null
                ? veto("only into folders")
                : next(),
        );
        const a = tree(files, {});
        const b = tree(inbox, {}, B_LEFT);
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inB, b.rowY("note", 0.1));
        expect(b.engine.get("drop-target")).toBeNull();
        expect(b.engine.get("drop-indicator")).toBeNull();
        pointer(a.content("readme"), "pointermove", inB, b.rowY("inbox", 0.5));
        expect(describeTarget(b)).toBe("inside inbox");
        pointer(a.content("readme"), "pointermove", inB, b.rowY("note", 0.9));
        pointer(a.content("readme"), "pointerup", inB, b.rowY("note", 0.9));
        expect(inbox.state.rootItemIds).toEqual(["inbox", "note"]);
        expect(files.state.rootItemIds).toEqual(["src", "readme"]);
    });

    it("an id the target model has refuses the default transfer", () => {
        const files = groupedFiles();
        const other = groupedFiles();
        const a = tree(files, {});
        const b = tree(other, {}, B_LEFT);
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inB, b.rowY("app", 0.1));
        expect(b.engine.get("drop-target")).toBeNull();
    });

    it("the app's transfer decides: a copy with new ids, the modifiers, a refusal", () => {
        const files = groupedFiles();
        const calls: TreeTransfer[] = [];
        const transfer = (event: TreeTransfer) => {
            calls.push(event);
            if (event.to.parentItemId === null) return false;
            if (event.dryRun) return undefined;
            event.to.model.run("batch", {
                commands: event.commands.map((entry) =>
                    entry.command === "item.add"
                        ? {
                              ...entry,
                              payload: {
                                  ...entry.payload,
                                  item: {
                                      ...entry.payload.item,
                                      id: `copy-${entry.payload.item.id}`,
                                  },
                              },
                          }
                        : entry,
                ),
            });
            return true;
        };
        const inbox = inboxModel(transfer);
        const a = tree(files, {});
        const b = tree(inbox, {}, B_LEFT);
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inB, b.rowY("note", 0.9));
        expect(b.engine.get("drop-target")).toBeNull();
        pointer(a.content("readme"), "pointermove", inB, b.rowY("inbox", 0.5));
        expect(describeTarget(b)).toBe("inside inbox");
        pointer(a.content("readme"), "pointerup", inB, b.rowY("inbox", 0.5), {
            altKey: true,
        });
        expect(inbox.state.items.inbox?.childItemIds).toEqual(["copy-readme"]);
        // a copy: the source keeps it
        expect(files.state.rootItemIds).toEqual(["src", "readme"]);
        const drop = calls.at(-1);
        expect(drop).toMatchObject({
            dryRun: false,
            itemIds: ["readme"],
            from: files,
            to: { model: inbox, parentItemId: "inbox", index: 0 },
            modifiers: { altKey: true, ctrlKey: false },
        });
        expect(drop?.items.map((item) => item.id)).toEqual(["readme"]);
    });

    it("transfers a subtree with a disabled expanded folder, which stays collapsed", () => {
        const files = groupedFiles({ expandedItemIds: ["src", "utils"] });
        files.run("item.set-flags", { itemId: "utils", disabled: true });
        const inbox = inboxModel();
        const a = tree(files, {});
        const b = tree(inbox, {}, B_LEFT);
        startDrag(a, "src");
        pointer(a.content("src"), "pointermove", inB, b.rowY("inbox", 0.5));
        expect(describeTarget(b)).toBe("inside inbox");
        pointer(a.content("src"), "pointerup", inB, b.rowY("inbox", 0.5));
        expect(inbox.state.items.utils?.childItemIds).toEqual(["a", "b"]);
        expect(inbox.is("item-expanded", { itemId: "src" })).toBe(true);
        expect(inbox.is("item-expanded", { itemId: "utils" })).toBe(false);
        expect(files.state.rootItemIds).toEqual(["readme"]);
    });

    it("a transfer handler that returns nothing at the drop gets the default transfer", () => {
        const files = groupedFiles();
        const inbox = inboxModel(() => undefined);
        const a = tree(files, {});
        const b = tree(inbox, {}, B_LEFT);
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inB, b.rowY("inbox", 0.5));
        pointer(a.content("readme"), "pointerup", inB, b.rowY("inbox", 0.5));
        expect(inbox.state.items.inbox?.childItemIds).toEqual(["readme"]);
        expect(files.state.rootItemIds).toEqual(["src"]);
    });

    it("a source that refuses the removal refuses the transfer", () => {
        const files = groupedFiles();
        files.use((ctx, next) =>
            ctx.command === "item.remove" ? veto("kept") : next(),
        );
        const inbox = inboxModel();
        const a = tree(files, {});
        const b = tree(inbox, {}, B_LEFT);
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inB, b.rowY("inbox", 0.5));
        expect(b.engine.get("drop-target")).toBeNull();
        pointer(a.content("readme"), "pointerup", inB, b.rowY("inbox", 0.5));
        expect(inbox.state.items.inbox?.childItemIds).toEqual([]);
    });

    it("hovers a collapsed parent of the other tree long enough: it expands", async () => {
        const model = groupedFiles({ expandedItemIds: [] });
        const a = tree(model, {});
        const b = tree(model, {}, B_LEFT);
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inB, b.rowY("src", 0.5));
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(model.is("item-expanded", { itemId: "src" })).toBe(true);
        pointer(a.content("readme"), "pointercancel", inB, 0);
    });

    it("drops into an empty tree of the group", () => {
        const files = groupedFiles();
        const empty = createTreeModel<FileTypes, GroupFeatures>(
            { version: 1, rootItemIds: [], items: {} },
            { features: groupFeatures() },
        );
        const a = tree(files, {});
        const b = tree(empty, {}, B_LEFT);
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inB, 30);
        expect(b.engine.get("drop-target")).toEqual({
            parentItemId: null,
            index: 0,
            position: "inside",
            itemId: null,
            level: 1,
        });
        pointer(a.content("readme"), "pointerup", inB, 30);
        expect(empty.state.rootItemIds).toEqual(["readme"]);
        expect(files.state.rootItemIds).toEqual(["src"]);
    });

    it("Escape and cancel-drag on either tree cancel it in both", () => {
        const model = groupedFiles();
        const a = tree(model, {});
        const b = tree(model, {}, B_LEFT);
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inB, b.rowY("app", 0.1));
        expect(b.engine.run("cancel-drag").ok).toBe(true);
        expect(a.engine.is("dragging")).toBe(false);
        expect(b.engine.is("dragging")).toBe(false);
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inB, b.rowY("app", 0.1));
        a.key("Escape");
        document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
        );
        expect(a.engine.is("dragging")).toBe(false);
        expect(b.engine.get("drop-target")).toBeNull();
        expect(b.engine.is("dragging")).toBe(false);
        expect(model.state.rootItemIds).toEqual(["src", "readme"]);
    });

    it("the other tree is not pressable during the drag", () => {
        const model = groupedFiles();
        const a = tree(model, {});
        const b = tree(model, {}, B_LEFT);
        startDrag(a, "readme");
        expect(b.engine.can("start-keyboard-drag", { itemIds: ["app"] })).toBe(
            false,
        );
    });

    it("the target tree unmounted mid-drag: the drag goes on in the source", () => {
        const model = groupedFiles();
        const a = tree(model, {});
        const b = tree(model, {}, B_LEFT);
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inB, b.rowY("app", 0.1));
        expect(describeTarget(b)).toBe("before app");
        b.unmount();
        trees = trees.filter((t) => t !== b);
        expect(a.engine.is("dragging")).toBe(true);
        pointer(a.content("readme"), "pointerup", inB, 10);
        expect(model.state.rootItemIds).toEqual(["src", "readme"]);
        // a later drag in the group of one works as before
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inA, a.rowY("app", 0.1));
        expect(describeTarget(a)).toBe("before app");
    });

    it("the source tree destroyed mid-drag: the other tree forgets it", () => {
        const model = groupedFiles();
        const a = tree(model, {});
        const b = tree(model, {}, B_LEFT);
        startDrag(a, "readme");
        pointer(a.content("readme"), "pointermove", inB, b.rowY("app", 0.1));
        a.unmount();
        trees = trees.filter((t) => t !== a);
        expect(b.engine.is("dragging")).toBe(false);
        expect(b.engine.get("drop-target")).toBeNull();
    });

    it("trees of two documents never join, whatever their group", () => {
        const model = groupedFiles();
        const other = document.implementation.createHTMLDocument("other");
        const a = tree(model, {});
        const b = tree(model, {}, B_LEFT, other);
        startDrag(a, "readme");
        expect(b.engine.is("dragging")).toBe(false);
        pointer(a.content("readme"), "pointermove", inB, b.rowY("app", 0.1));
        expect(b.engine.get("drop-target")).toBeNull();
    });

    it("trees of another group never join", () => {
        const a = tree(groupedFiles({}, "files"), {});
        const b = tree(groupedFiles({}, "other"), {}, B_LEFT);
        startDrag(a, "readme");
        expect(b.engine.is("dragging")).toBe(false);
    });
});

describe("a keyboard drag in a group", () => {
    function keyboardSetup(options: TreeEngineOptions<FileTypes> = {}) {
        const files = groupedFiles({ expandedItemIds: ["src"] });
        const inbox = inboxModel();
        const announced: AnnounceEvent[] = [];
        const a = tree(files, {
            announce: (event) => {
                announced.push(event);
                return event.type;
            },
            ...options,
        });
        const b = tree(inbox, {}, B_LEFT);
        return { files, inbox, a, b, announced };
    }

    it("Down goes past the source's last position into the next tree, and Enter drops there", () => {
        const { files, inbox, a, b, announced } = keyboardSetup();
        a.item("readme").focus();
        a.key("ArrowDown"); // focus stays on readme (last)
        expect(
            a.engine.run("start-keyboard-drag", { itemIds: ["readme"] }).ok,
        ).toBe(true);
        const seen: string[] = [];
        for (let i = 0; i < 20 && b.engine.get("drop-target") === null; i++) {
            a.key("ArrowDown");
            seen.push(describeTarget(a) ?? "elsewhere");
        }
        expect(describeTarget(b)).toBe("before inbox");
        expect(a.engine.get("drop-target")).toBeNull();
        expect(announced.at(-1)).toMatchObject({
            type: "drag-over",
            targetTree: { root: b.root, model: inbox },
        });
        a.key("ArrowDown");
        expect(describeTarget(b)).toBe("inside inbox");
        // and back up into the source
        a.key("ArrowUp");
        a.key("ArrowUp");
        expect(b.engine.get("drop-target")).toBeNull();
        expect(a.engine.get("drop-target")).not.toBeNull();
        a.key("ArrowDown");
        a.key("ArrowDown");
        expect(describeTarget(b)).toBe("inside inbox");
        a.key("Enter");
        expect(inbox.state.items.inbox?.childItemIds).toEqual(["readme"]);
        expect(files.state.rootItemIds).toEqual(["src"]);
        expect(a.engine.is("dragging")).toBe(false);
        expect(b.engine.is("dragging")).toBe(false);
        expect(announced.at(-1)).toMatchObject({ type: "drop" });
    });

    it("stops at the last position of the last tree, and Escape cancels in both", () => {
        const { files, inbox, a, b } = keyboardSetup();
        a.engine.run("start-keyboard-drag", { itemIds: ["readme"] });
        for (let i = 0; i < 30; i++) a.key("ArrowDown");
        expect(describeTarget(b)).toBe("after note");
        a.key("Escape");
        expect(a.engine.is("dragging")).toBe(false);
        expect(b.engine.is("dragging")).toBe(false);
        expect(files.state.rootItemIds).toEqual(["src", "readme"]);
        expect(inbox.state.rootItemIds).toEqual(["inbox", "note"]);
    });

    it("skips the positions the other model refuses, asked when reached", () => {
        const { inbox, a, b } = keyboardSetup();
        let asked = 0;
        inbox.use((ctx, next) => {
            if (ctx.command === "batch") asked++;
            return ctx.command === "item.add" &&
                ctx.payload.to.parentItemId === null
                ? veto("only into folders")
                : next();
        });
        a.engine.run("start-keyboard-drag", { itemIds: ["readme"] });
        expect(asked).toBe(0);
        for (let i = 0; i < 30 && b.engine.get("drop-target") === null; i++)
            a.key("ArrowDown");
        expect(describeTarget(b)).toBe("inside inbox");
        a.key("ArrowDown");
        // nothing valid below: the target stays
        expect(describeTarget(b)).toBe("inside inbox");
    });

    it("the target tree unmounted: back where the drag started", () => {
        const { a, b } = keyboardSetup();
        a.engine.run("start-keyboard-drag", { itemIds: ["readme"] });
        const start = describeTarget(a);
        for (let i = 0; i < 30 && b.engine.get("drop-target") === null; i++)
            a.key("ArrowDown");
        b.unmount();
        trees = trees.filter((t) => t !== b);
        expect(describeTarget(a)).toBe(start);
        a.key("Enter");
        expect(a.engine.is("dragging")).toBe(false);
    });
});

describe("the drag extensions' requirements", () => {
    it("dragGroup() and dropOutside() without dragAndDrop() fail at creation", () => {
        expect(() =>
            filesModel({}, { features: [dragGroup({ name: "g" })] }),
        ).toThrow(/drag-and-drop/);
        expect(() =>
            filesModel(
                {},
                { features: [dropOutside({ onDrop: () => false })] },
            ),
        ).toThrow(/drag-and-drop/);
    });
});

describe("a drag ended by its source's destroy, in either order of features", () => {
    for (const order of ["drag-and-drop first", "drag-group first"] as const) {
        /** the drag sessions of the engines, in creation order (the group they joined) */
        const sessions: DragSession[] = [];
        const group = (name: string): DragGroupFeature => {
            const feature = dragGroup({ name });
            return {
                ...feature,
                engine: (host) => {
                    sessions.push(dragSessionOf(host));
                    return feature.engine?.(host) ?? {};
                },
            };
        };
        const model = (name: string) =>
            filesModel<TreeFeatures>(
                {},
                {
                    features:
                        order === "drag-group first"
                            ? [group(name), ...allFeatures()]
                            : [...allFeatures(), group(name)],
                },
            );

        for (const kind of ["pointer", "keyboard"] as const) {
            it(`${order}: a ${kind} drag ends in the group, which keeps no ended drag`, () => {
                sessions.length = 0;
                const name = `${kind}-${order}`;
                const a = tree(model(name), {});
                const b = tree(model(name), {}, B_LEFT);
                if (kind === "pointer") {
                    startDrag(a, "readme");
                    pointer(
                        a.content("readme"),
                        "pointermove",
                        inB,
                        b.rowY("app", 0.1),
                    );
                } else {
                    a.engine.run("start-keyboard-drag", {
                        itemIds: ["readme"],
                    });
                }
                expect(b.engine.is("dragging")).toBe(true);
                expect(sessions[1]?.group?.drag).toBeDefined();
                a.engine.destroy();
                expect(b.engine.is("dragging")).toBe(false);
                // the other tree's group lets the ended drag (and the destroyed engine) go
                expect(sessions[1]?.group?.drag).toBeUndefined();
            });
        }
    }
});
