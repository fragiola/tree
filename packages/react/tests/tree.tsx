// The tree the tests render: every primitive, assembled the way an app does, with no text but the
// labels (the app's data) and the names the app gives.
import {
    createTreeModel,
    type ItemOf,
    type RootProps,
    Tree,
    type TreeFeatures,
    type TreeJson,
    useTree,
    useTreeItem,
} from "../src";
import { asyncChildren } from "../src/async-children";
import { checkboxes } from "../src/checkboxes";
import {
    type DragAndDropOptions,
    DropIndicator,
    dragAndDrop,
} from "../src/drag-and-drop";
import { rename, useTreeItemRename } from "../src/rename";
import { selection } from "../src/selection";
import { typeAhead } from "../src/type-ahead";

export type FileTypes = {
    items: { folder: undefined; file: { size: number } };
};

//   src/            folder, expanded
//     app.ts
//     lib/          loaded by the app's loader (unloaded)
//     utils/        folder
//       a.ts
//       b.ts
//   readme.md
export function files(
    patch: Partial<TreeJson<FileTypes>> = {},
): TreeJson<FileTypes> {
    return {
        version: 1,
        rootItemIds: ["src", "readme"],
        items: {
            src: {
                kind: "folder",
                label: "src",
                childItemIds: ["app", "lib", "utils"],
            },
            app: { kind: "file", label: "app.ts", data: { size: 120 } },
            lib: { kind: "folder", label: "lib", childrenStatus: "unloaded" },
            utils: { kind: "folder", label: "utils", childItemIds: ["a", "b"] },
            a: { kind: "file", label: "a.ts", data: { size: 1 } },
            b: { kind: "file", label: "b.ts", data: { size: 2 } },
            readme: { kind: "file", label: "readme.md", data: { size: 3 } },
        },
        expandedItemIds: ["src"],
        ...patch,
    };
}

/** The features the tests' trees install: every feature but the drag extensions. */
export const FEATURES = [
    selection(),
    checkboxes(),
    rename(),
    asyncChildren(),
    typeAhead(),
    dragAndDrop(),
] as const;

/** The tests' features with drag and drop's options, and more features after them (a drag group). */
export function featuresWith<const E extends TreeFeatures>(
    extra: E,
    drag: DragAndDropOptions = {},
) {
    return [
        selection(),
        checkboxes(),
        rename(),
        asyncChildren(),
        typeAhead(),
        dragAndDrop(drag),
        ...extra,
    ] as const;
}

export const filesModel = (patch: Partial<TreeJson<FileTypes>> = {}) =>
    createTreeModel<FileTypes, typeof FEATURES>(files(patch), {
        features: FEATURES,
    });

/**
 * A model of `files()` with other features: without `asyncChildren()`, `lib` is a parent with no
 * children (a document without the feature has no `childrenStatus`).
 */
export function filesModelWith<const F extends TreeFeatures>(
    features: F,
    patch: Partial<TreeJson<FileTypes>> = {},
) {
    const json = files(patch);
    if (!features.some((feature) => feature.name === "async-children")) {
        const { childrenStatus: _, ...lib } = json.items.lib ?? {
            kind: "folder",
            label: "lib",
        };
        json.items.lib = { ...lib, childItemIds: [] };
    }
    return createTreeModel<FileTypes, F>(json, { features });
}

/**
 * The app's own check control: a native button out of the tab order and hidden from assistive
 * technology (the item carries `aria-checked`, and Space toggles it), running `item.toggle-check`.
 */
export function Check({ item }: { item: ItemOf<FileTypes> }) {
    const { model } = useTree<FileTypes, typeof FEATURES>();
    const { state } = useTreeItem(item);
    return (
        <button
            type="button"
            tabIndex={-1}
            aria-hidden
            data-testid="check"
            data-checked={state.checked ? "" : undefined}
            data-indeterminate={state.indeterminate ? "" : undefined}
            onClick={() => model.run("item.toggle-check", { itemId: item.id })}
        />
    );
}

/** The app's own rename editor, wired by `useTreeItemRename`. */
export function RenameField({ item }: { item: ItemOf<FileTypes> }) {
    const { state, props } = useTreeItemRename(item);
    return state.renaming ? <input {...props} aria-label="Name" /> : null;
}

export function FileItem({ item }: { item: ItemOf<FileTypes> }) {
    return (
        <Tree.Item item={item}>
            <Tree.ItemContent>
                <Tree.Toggle />
                <Check item={item} />
                <span>{item.label}</span>
                <RenameField item={item} />
            </Tree.ItemContent>
            <Tree.Group<FileTypes>>
                {(child) => <FileItem item={child} />}
            </Tree.Group>
        </Tree.Item>
    );
}

export function FileTree<F extends TreeFeatures = typeof FEATURES>(
    props: RootProps<FileTypes, F>,
) {
    return (
        <Tree.Root<FileTypes, F>
            aria-label="Files"
            features={FEATURES as unknown as F}
            {...props}
        >
            <Tree.Items<FileTypes>>
                {(item) => <FileItem item={item} />}
            </Tree.Items>
            <DropIndicator />
            <Tree.LiveRegion />
        </Tree.Root>
    );
}

/** An item's element, by its id: `role="treeitem"` with its label. */
export function itemElement(label: string): HTMLElement {
    const row = [
        ...document.querySelectorAll<HTMLElement>('[data-tree-part="item"]'),
    ].find(
        (element) =>
            element.querySelector(
                ':scope > [data-tree-part="content"] > span:not([data-tree-part])',
            )?.textContent === label,
    );
    if (!row) throw new Error(`no item "${label}"`);
    return row;
}

/** An item's row (`Tree.ItemContent`), by its label. */
export function content(label: string): HTMLElement {
    const element = itemElement(label).querySelector<HTMLElement>(
        ':scope > [data-tree-part="content"]',
    );
    if (!element) throw new Error(`no row "${label}"`);
    return element;
}

export const byPath = (path: string) =>
    document.querySelector<HTMLElement>(`[data-tree-path="${path}"]`);
