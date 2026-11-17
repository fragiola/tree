// Parity with @fragiola/tree-react: the same document, rendered by both adapters with every part,
// gives the same elements (part, tag, order) with the same ARIA, `data-*` and structural style.
import {
    Tree as ReactTree,
    useTree as useReactTree,
    useTreeItem as useReactTreeItem,
    useTreeItemRename as useReactTreeItemRename,
} from "@fragiola/tree-react";
import { VirtualItems as ReactVirtualItems } from "@fragiola/tree-react/virtualization";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createTreeForeignDrop, createTreeModel, type TreeJson } from "../src";
import { bigFileTree, virtualModel } from "./big-tree";
import {
    type FileTypes,
    files,
    filesModel,
    fileTree,
    fire,
    itemElement,
    render,
} from "./tree";

type Item = { id: string; label: string; childItemIds?: string[] };

const r = React.createElement;

/** The app's own check control, as `tests/tree.ts`'s `Check` (and packages/react's). */
function ReactCheck({ item }: { item: Item }) {
    const { model } = useReactTree();
    const { state } = useReactTreeItem(item as never);
    return r("button", {
        type: "button",
        tabIndex: -1,
        "aria-hidden": true,
        "data-testid": "check",
        "data-checked": state.checked ? "" : undefined,
        "data-indeterminate": state.indeterminate ? "" : undefined,
        onClick: () => model.run("item.toggle-check", { itemId: item.id }),
    });
}

/** The app's own rename editor, as `tests/tree.ts`'s `RenameField`. */
function ReactRenameField({ item }: { item: Item }) {
    const { state, props } = useReactTreeItemRename(item as never);
    return state.renaming
        ? r("input", { ...props, "aria-label": "Name" })
        : null;
}

function reactItem(item: Item): React.ReactElement {
    return r(
        ReactTree.Item,
        { key: item.id, item: item as never },
        r(
            ReactTree.ItemContent,
            null,
            r(ReactTree.Toggle),
            r(ReactCheck, { item }),
            r("span", null, item.label),
            r(ReactRenameField, { item }),
        ),
        r(ReactTree.Group, {
            children: (child: Item) => reactItem(child),
        } as never),
    );
}

/**
 * Every element of a tree, as its part, tag, ARIA, `data-*` and style: the parts, and the app's
 * own check controls and rename editors (what the composables give them).
 */
function snapshot(root: Element) {
    return [
        ...root.querySelectorAll(
            '[data-tree-part], [data-testid="check"], input',
        ),
    ].map((element) => ({
        tag: element.tagName,
        attributes: Object.fromEntries(
            [...element.attributes]
                .filter(
                    ({ name }) =>
                        name.startsWith("aria-") ||
                        name.startsWith("data-") ||
                        ["role", "tabindex", "type", "style"].includes(name),
                )
                .map(({ name, value }) => [
                    name,
                    name === "style" ? value.replace(/\s|;$/g, "") : value,
                ]),
        ),
    }));
}

async function both(
    json: TreeJson<FileTypes>,
    props: Record<string, unknown> = {},
) {
    await render(() => fileTree({ model: filesModel(json), ...props }));
    const vue = snapshot(document.querySelector('[role="tree"]') as Element);
    document.body.innerHTML = "";
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const model = filesModel(json);
    await act(async () => {
        root.render(
            r(
                ReactTree.Root,
                { model: model as never, "aria-label": "Files", ...props },
                r(ReactTree.Items, {
                    children: (item: Item) => reactItem(item),
                } as never),
                r(ReactTree.DropIndicator),
                r(ReactTree.LiveRegion),
            ),
        );
    });
    const react = snapshot(host.firstElementChild as Element);
    act(() => root.unmount());
    return { vue, react };
}

describe("parity with @fragiola/tree-react", () => {
    it("renders the same elements and attributes for the same document", async () => {
        const json = files({
            expandedItemIds: ["src", "utils"],
            selectedItemIds: ["a"],
            checkedItemIds: ["a"],
            focusedItemId: "app",
            settings: { selectionMode: "multiple" },
        });
        const app = json.items.app;
        if (app) json.items.app = { ...app, disabled: true };
        const { vue, react } = await both(json, { checkboxes: true });
        expect(vue.length).toBeGreaterThan(20);
        expect(vue).toEqual(react);
    });

    it("renders the same without checkboxes and with no selection", async () => {
        const { vue, react } = await both(
            files({ settings: { selectionMode: "none" } }),
        );
        expect(vue).toEqual(react);
    });

    it("gives the app's rename editor the same attributes", async () => {
        const json = files({ renamingItemId: "readme" });
        const { vue, react } = await both(json);
        expect(vue.find((part) => part.tag === "INPUT")).toBeDefined();
        expect(vue).toEqual(react);
    });
});

/** A second model for a drag between trees: one empty folder, "inbox". */
const inboxModel = () =>
    createTreeModel<FileTypes>({
        version: 1,
        rootItemIds: ["inbox"],
        items: { inbox: { kind: "folder", label: "inbox", childItemIds: [] } },
    });

/**
 * A keyboard drag of readme.md (Ctrl+Shift+D) on into the second tree, Down until it shows a drop
 * target: `key` dispatches a keydown on readme.md and lets the adapter render.
 */
async function dragIntoInbox(
    key: (key: string, init?: Record<string, unknown>) => Promise<void>,
) {
    itemElement("readme.md").focus();
    await key("d", { ctrlKey: true, shiftKey: true });
    const inbox = () => document.querySelectorAll('[role="tree"]')[1];
    for (
        let i = 0;
        i < 20 && !inbox()?.querySelector("[data-drop-target]");
        i++
    )
        await key("ArrowDown");
}

describe("parity with @fragiola/tree-react across trees", () => {
    it("renders the same cross-tree drag state", async () => {
        await render(() => [
            fileTree({ model: filesModel(), dragGroup: "files" }),
            fileTree({
                model: inboxModel(),
                dragGroup: "files",
                "aria-label": "Inbox",
            }),
        ]);
        await dragIntoInbox((key, init) =>
            fire(itemElement("readme.md"), "keydown", { key, ...init }),
        );
        const vue = snapshot(document.body);
        await fire(itemElement("readme.md"), "keydown", { key: "Escape" });
        document.body.innerHTML = "";

        const host = document.createElement("div");
        document.body.append(host);
        const root = createRoot(host);
        (
            globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
        ).IS_REACT_ACT_ENVIRONMENT = true;
        const reactTree = (model: unknown, label: string) =>
            r(
                ReactTree.Root,
                {
                    model: model as never,
                    dragGroup: "files",
                    "aria-label": label,
                },
                r(ReactTree.Items, {
                    children: (item: Item) => reactItem(item),
                } as never),
                r(ReactTree.DropIndicator),
                r(ReactTree.LiveRegion),
            );
        await act(async () => {
            root.render(
                r(
                    React.Fragment,
                    null,
                    reactTree(filesModel(), "Files"),
                    reactTree(inboxModel(), "Inbox"),
                ),
            );
        });
        await dragIntoInbox(async (key, init) => {
            await act(async () => {
                itemElement("readme.md").dispatchEvent(
                    new KeyboardEvent("keydown", {
                        key,
                        bubbles: true,
                        cancelable: true,
                        ...init,
                    }),
                );
            });
        });
        const react = snapshot(document.body);
        act(() => root.unmount());

        const inbox = vue.find(
            (part) =>
                part.attributes["data-tree-part"] === "root" &&
                part.attributes["aria-label"] === "Inbox",
        );
        expect(inbox?.attributes["data-dragging-from-other-tree"]).toBe("");
        expect(
            vue.some((part) => part.attributes["data-drop-target"] === ""),
        ).toBe(true);
        expect(
            vue.filter(
                (part) =>
                    part.attributes["data-tree-part"] === "drop-indicator",
            ),
        ).toHaveLength(1);
        expect(vue).toEqual(react);
    });
});

describe("parity with @fragiola/tree-react in a virtualized tree", () => {
    it("renders the same rows and spacers, flat, for the same window", async () => {
        await render(() => bigFileTree());
        const vue = snapshot(
            document.querySelector('[role="tree"]') as Element,
        );
        document.body.innerHTML = "";
        const host = document.createElement("div");
        document.body.append(host);
        const root = createRoot(host);
        (
            globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
        ).IS_REACT_ACT_ENVIRONMENT = true;
        await act(async () => {
            root.render(
                r(
                    ReactTree.Root,
                    {
                        model: virtualModel() as never,
                        "aria-label": "Files",
                    },
                    r(ReactVirtualItems, {
                        children: (item: Item) =>
                            r(
                                ReactTree.Item,
                                { item: item as never },
                                r(
                                    ReactTree.ItemContent,
                                    null,
                                    r(ReactTree.Toggle),
                                    r("span", null, item.label),
                                ),
                            ),
                    } as never),
                ),
            );
        });
        const react = snapshot(host.firstElementChild as Element);
        act(() => root.unmount());
        expect(
            vue.filter((part) => part.attributes["data-tree-part"] === "item"),
        ).toHaveLength(7);
        expect(
            vue.some((part) => part.attributes["data-tree-part"] === "spacer"),
        ).toBe(true);
        expect(vue).toEqual(react);
    });
});

describe("parity with @fragiola/tree-react in a foreign drag", () => {
    it("renders the same target for files dragged on the tree", async () => {
        const foreignDrop = createTreeForeignDrop<FileTypes>({
            onDrop: () => {},
        });
        // the top of app.ts (the second row, 20px each): before it
        const over = {
            clientX: 40,
            clientY: 22,
            dataTransfer: { types: ["Files"], dropEffect: "none" },
        };
        await render(() => fileTree({ model: filesModel(), foreignDrop }));
        await fire(
            document.querySelector('[role="tree"]') as Element,
            "dragover",
            over,
        );
        const vue = snapshot(document.body);
        document.body.innerHTML = "";

        const host = document.createElement("div");
        document.body.append(host);
        const root = createRoot(host);
        (
            globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
        ).IS_REACT_ACT_ENVIRONMENT = true;
        await act(async () => {
            root.render(
                r(
                    ReactTree.Root,
                    {
                        model: filesModel() as never,
                        "aria-label": "Files",
                        foreignDrop: foreignDrop as never,
                    },
                    r(ReactTree.Items, {
                        children: (item: Item) => reactItem(item),
                    } as never),
                    r(ReactTree.DropIndicator),
                    r(ReactTree.LiveRegion),
                ),
            );
        });
        await act(async () => {
            const event = new MouseEvent("dragover", {
                bubbles: true,
                cancelable: true,
                clientX: over.clientX,
                clientY: over.clientY,
            });
            Object.defineProperty(event, "dataTransfer", {
                value: { ...over.dataTransfer },
            });
            host.firstElementChild?.dispatchEvent(event);
        });
        const react = snapshot(document.body);
        act(() => root.unmount());

        expect(vue[0]?.attributes["data-dragging"]).toBe("");
        expect(
            vue.find((part) => part.attributes["data-drop-target"] === ""),
        ).toBeDefined();
        expect(
            vue.find(
                (part) =>
                    part.attributes["data-tree-part"] === "drop-indicator",
            )?.attributes["data-drop-position"],
        ).toBe("before");
        expect(vue).toEqual(react);
    });
});
