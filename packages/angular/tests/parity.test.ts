// Parity with @fragiola/tree-react: the same document, rendered by both adapters with every part
// and the app's own controls (a check button reading the item's state, a rename editor wired by
// `useTreeItemRename` / `[treeItemRename]`), gives the same elements (part, tag, order) with the
// same ARIA, `data-*` and structural style. The one difference is Angular's: a directive is on the
// app's element, which is there even when React renders nothing (a collapsed item's group, the
// drop indicator with no drop target); the directive hides it (`display: none`), and the
// comparison leaves those hidden elements out.
import { Component, input } from "@angular/core";
import {
    Tree as ReactTree,
    useTree,
    useTreeItem,
    useTreeItemRename,
} from "@fragiola/tree-react";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
    createTreeForeignDrop,
    createTreeModel,
    TREE,
    type TreeJson,
    type TreeModel,
} from "../src/public-api";
import { BigTree, virtualModel } from "./big-tree";
import {
    type FileTypes,
    files,
    filesModel,
    focus,
    itemElement,
    press,
    render,
    renderFiles,
    settle,
} from "./tree";

type Item = { id: string; label: string; childItemIds?: string[] };

const r = React.createElement;

/** The app's check control, as tests/tree.ts renders it. */
function Check({ item }: { item: Item }) {
    const { model } = useTree();
    const { state } = useTreeItem(item as never);
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

/** The app's rename editor, as tests/tree.ts renders it. */
function RenameField({ item }: { item: Item }) {
    const { state, props } = useTreeItemRename(item as never);
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
            r(Check, { item }),
            r("span", null, item.label),
            r(RenameField, { item }),
        ),
        r(ReactTree.Group, {
            children: (child: Item) => reactItem(child),
        } as never),
    );
}

/** The parts, and the app's controls (its check button and its rename editor). */
const ELEMENTS =
    '[data-tree-part], [data-testid="check"], input[aria-label="Name"]';

/** Every element of a tree, as its part, tag, ARIA, `data-*` and style. */
function snapshot(root: Element, skipHidden: boolean) {
    return [...root.querySelectorAll<HTMLElement>(ELEMENTS)]
        .filter(
            (element) =>
                !(
                    skipHidden &&
                    element.style.display === "none" &&
                    ["group", "drop-indicator"].includes(
                        element.dataset.treePart ?? "",
                    )
                ),
        )
        .map(part);
}

/** An element as its tag, ARIA, `data-*` and style. */
function part(element: HTMLElement) {
    return {
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
    };
}

type Snapshot = ReturnType<typeof snapshot>;

async function both(
    json: TreeJson<FileTypes>,
    inputs: { checkboxes?: boolean } = {},
) {
    await renderFiles({ model: filesModel(json), ...inputs });
    const angular = snapshot(
        document.querySelector('[role="tree"]') as Element,
        true,
    );
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
                { model: model as never, "aria-label": "Files", ...inputs },
                r(ReactTree.Items, {
                    children: (item: Item) => reactItem(item),
                } as never),
                r(ReactTree.DropIndicator),
                r(ReactTree.LiveRegion),
            ),
        );
    });
    const react = snapshot(host.firstElementChild as Element, false);
    act(() => root.unmount());
    return { angular, react };
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
        const { angular, react } = await both(json, { checkboxes: true });
        expect(angular.length).toBeGreaterThan(20);
        expect(angular).toEqual(react);
    });

    it("renders the same without checkboxes and with no selection", async () => {
        const { angular, react } = await both(
            files({ settings: { selectionMode: "none" } }),
        );
        expect(angular).toEqual(react);
    });

    it("renders the same check controls, mixed included", async () => {
        const json = files({
            expandedItemIds: ["src", "utils"],
            checkedItemIds: ["a"],
        });
        const { angular, react } = await both(json, { checkboxes: true });
        const checks = angular.filter(
            (part) => part.attributes["data-testid"] === "check",
        );
        expect(checks).toHaveLength(7);
        expect(
            checks.filter((part) => "data-indeterminate" in part.attributes),
        ).toHaveLength(2);
        expect(angular).toEqual(react);
    });

    it("renders the same rename editor", async () => {
        const json = files({ renamingItemId: "readme" });
        const { angular, react } = await both(json);
        expect(angular.filter((part) => part.tag === "INPUT")).toHaveLength(1);
        expect(angular).toEqual(react);
    });
});

describe("parity with @fragiola/tree-react in a virtualized tree", () => {
    it("renders the same rows and spacers, flat, for the same window", async () => {
        await render(BigTree);
        const angular = snapshot(
            document.querySelector('[role="tree"]') as Element,
            true,
        ).map((part) => {
            // the test's own attribute (the row's offset), not a part's
            const { "data-offset": _offset, ...attributes } = part.attributes;
            return { ...part, attributes };
        });
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
                    r(ReactTree.VirtualItems, {
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
        const react = snapshot(host.firstElementChild as Element, false);
        act(() => root.unmount());
        expect(
            angular.filter(
                (part) => part.attributes["data-tree-part"] === "item",
            ),
        ).toHaveLength(7);
        expect(angular).toEqual(react);
    });
});

/** Two trees of the drag group "files": the files, and an inbox over another model. */
@Component({
    selector: "test-two-trees",
    imports: [TREE],
    template: `
        @for (tree of trees(); track tree.name) {
            <div [treeRoot]="tree.model" dragGroup="files" [attr.aria-label]="tree.name">
                <ng-template [treeItems]="tree.model" let-item>
                    <div [treeItem]="item" #treeItem="treeItem">
                        <div treeItemContent>
                            <span treeToggle></span>
                            <button
                                type="button"
                                tabindex="-1"
                                aria-hidden="true"
                                data-testid="check"
                                [attr.data-checked]="treeItem.state().checked ? '' : null"
                                [attr.data-indeterminate]="treeItem.state().indeterminate ? '' : null"
                                (click)="tree.model.run('item.toggle-check', { itemId: item.id })"
                            ></button>
                            <span>{{ item.label }}</span>
                            @if (treeItem.state().renaming) {
                                <input treeItemRename aria-label="Name" />
                            }
                        </div>
                        <div treeGroup></div>
                    </div>
                </ng-template>
                <div treeDropIndicator></div>
                <div treeLiveRegion></div>
            </div>
        }
    `,
})
class TwoTrees {
    readonly trees =
        input.required<{ name: string; model: TreeModel<FileTypes> }[]>();
}

const inboxModel = () =>
    createTreeModel<FileTypes>({
        version: 1,
        rootItemIds: ["inbox"],
        items: { inbox: { kind: "folder", label: "inbox", childItemIds: [] } },
    });

/** Whether the keyboard drag reached the inbox folder, a drop into it. */
const intoInbox = () =>
    document
        .querySelectorAll('[role="tree"]')[1]
        ?.querySelector(
            '[data-tree-part="content"][data-drop-position="inside"]',
        ) != null;

describe("parity with @fragiola/tree-react across a drag group", () => {
    it("renders the same cross-tree drag state", async () => {
        const trees = () => [
            { name: "Files", model: filesModel() },
            { name: "Inbox", model: inboxModel() },
        ];
        await render(TwoTrees, { trees: trees() });
        await focus(itemElement("readme.md"));
        await press("d", { ctrlKey: true, shiftKey: true });
        for (let i = 0; i < 20 && !intoInbox(); i++) await press("ArrowDown");
        const angular = [
            ...document.querySelectorAll<HTMLElement>('[role="tree"]'),
        ].map((root) => [part(root), ...snapshot(root, true)]);
        document.body.innerHTML = "";

        const host = document.createElement("div");
        document.body.append(host);
        const root = createRoot(host);
        (
            globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
        ).IS_REACT_ACT_ENVIRONMENT = true;
        await act(async () => {
            root.render(
                trees().map(({ name, model }) =>
                    r(
                        ReactTree.Root,
                        {
                            key: name,
                            model: model as never,
                            dragGroup: "files",
                            "aria-label": name,
                        },
                        r(ReactTree.Items, {
                            children: (item: Item) => reactItem(item),
                        } as never),
                        r(ReactTree.DropIndicator),
                        r(ReactTree.LiveRegion),
                    ),
                ),
            );
        });
        const key = (name: string, init: KeyboardEventInit = {}) =>
            act(() => {
                document.activeElement?.dispatchEvent(
                    new KeyboardEvent("keydown", {
                        key: name,
                        bubbles: true,
                        cancelable: true,
                        ...init,
                    }),
                );
            });
        act(() => itemElement("readme.md").focus());
        key("d", { ctrlKey: true, shiftKey: true });
        for (let i = 0; i < 20 && !intoInbox(); i++) key("ArrowDown");
        const react = [
            ...host.querySelectorAll<HTMLElement>('[role="tree"]'),
        ].map((root) => [part(root), ...snapshot(root, false)]);
        key("Escape");
        act(() => root.unmount());

        const [files, inbox] = angular as [Snapshot, Snapshot];
        const attributes = (tree: Snapshot, name: string) =>
            tree.find(
                (element) => element.attributes["data-tree-part"] === name,
            )?.attributes;
        expect(attributes(inbox, "root")).toHaveProperty(
            "data-dragging-from-other-tree",
            "",
        );
        expect(attributes(files, "root")).not.toHaveProperty(
            "data-dragging-from-other-tree",
        );
        expect(attributes(inbox, "content")).toHaveProperty(
            "data-drop-position",
            "inside",
        );
        expect(attributes(inbox, "drop-indicator")).toHaveProperty(
            "data-drop-position",
            "inside",
        );
        expect(attributes(files, "drop-indicator")).toBeUndefined();
        expect(angular).toEqual(react);
    });
});

describe("parity with @fragiola/tree-react in a foreign drag", () => {
    it("renders the same target for files dragged on the tree", async () => {
        const foreignDrop = createTreeForeignDrop<FileTypes>({
            onDrop: () => {},
        });
        // the top of app.ts (the second row, 20px each): before it
        const dragOver = (target: Element | null | undefined) => {
            const event = new MouseEvent("dragover", {
                bubbles: true,
                cancelable: true,
                clientX: 40,
                clientY: 22,
            });
            Object.defineProperty(event, "dataTransfer", {
                value: { types: ["Files"], dropEffect: "none" },
            });
            target?.dispatchEvent(event);
        };
        const rendered = await renderFiles({
            model: filesModel(),
            foreignDrop,
        });
        dragOver(document.querySelector('[role="tree"]'));
        rendered.fixture.detectChanges();
        await settle();
        const treeElement = document.querySelector(
            '[role="tree"]',
        ) as HTMLElement;
        const angular = [part(treeElement), ...snapshot(treeElement, true)];
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
        await act(async () => dragOver(host.firstElementChild));
        const reactElement = host.firstElementChild as HTMLElement;
        const react = [part(reactElement), ...snapshot(reactElement, false)];
        act(() => root.unmount());

        expect(angular[0]?.attributes["data-dragging"]).toBe("");
        expect(
            angular.find(
                (element) =>
                    element.attributes["data-tree-part"] === "drop-indicator",
            )?.attributes["data-drop-position"],
        ).toBe("before");
        expect(angular).toEqual(react);
    });
});
