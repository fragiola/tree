// Parity with @fragiola/tree-react: the same document, rendered by both adapters with every part,
// gives the same elements (part, tag, order) with the same ARIA, `data-*` and structural style.
// The one difference is Angular's: a directive is on the app's element, which is there even when
// React renders nothing (a collapsed item's group, the rename input of an item not renaming, the
// drop indicator with no drop target); the directive hides it (`display: none`), and the
// comparison leaves those hidden elements out.
import { Component, input } from "@angular/core";
import { Tree as ReactTree } from "@fragiola/tree-react";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
    createTreeModel,
    TREE,
    type TreeJson,
    type TreeModel,
} from "../src/public-api";
import { BigTree, bigTree, virtual } from "./big-tree";
import {
    type FileTypes,
    files,
    filesModel,
    focus,
    itemElement,
    press,
    render,
    renderFiles,
} from "./tree";

type Item = { id: string; label: string; childItemIds?: string[] };

const r = React.createElement;

function reactItem(item: Item): React.ReactElement {
    return r(
        ReactTree.Item,
        { key: item.id, item: item as never },
        r(
            ReactTree.ItemContent,
            null,
            r(ReactTree.Toggle),
            r(ReactTree.Checkbox),
            r("span", null, item.label),
            r(ReactTree.RenameInput, { "aria-label": "Name" }),
        ),
        r(ReactTree.Group, {
            children: (child: Item) => reactItem(child),
        } as never),
    );
}

/** Every element of a tree, as its part, tag, ARIA, `data-*` and style. */
function snapshot(root: Element, skipHidden: boolean) {
    return [...root.querySelectorAll<HTMLElement>("[data-tree-part]")]
        .filter(
            (element) =>
                !(
                    skipHidden &&
                    element.style.display === "none" &&
                    ["group", "rename-input", "drop-indicator"].includes(
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

    it("renders the same rename input", async () => {
        const json = files({ renamingItemId: "readme" });
        const { angular, react } = await both(json);
        expect(
            angular.find(
                (part) => part.attributes["data-tree-part"] === "rename-input",
            ),
        ).toBeDefined();
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
                        model: createTreeModel(bigTree()) as never,
                        "aria-label": "Files",
                        virtual,
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
                    <div [treeItem]="item">
                        <div treeItemContent>
                            <span treeToggle></span>
                            <span treeCheckbox></span>
                            <span>{{ item.label }}</span>
                            <input treeRenameInput aria-label="Name" />
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
