// The tree the tests render: every primitive, assembled the way an app does, with no text but the
// labels (the app's data) and the names the app gives.
import {
    createTreeModel,
    type ItemOf,
    type RootProps,
    Tree,
    type TreeJson,
} from "../src";

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

export const filesModel = (patch: Partial<TreeJson<FileTypes>> = {}) =>
    createTreeModel<FileTypes>(files(patch));

export function FileItem({ item }: { item: ItemOf<FileTypes> }) {
    return (
        <Tree.Item item={item}>
            <Tree.ItemContent>
                <Tree.Toggle />
                <Tree.Checkbox />
                <span>{item.label}</span>
                <Tree.RenameInput aria-label="Name" />
            </Tree.ItemContent>
            <Tree.Group<FileTypes>>
                {(child) => <FileItem item={child} />}
            </Tree.Group>
        </Tree.Item>
    );
}

export function FileTree(props: RootProps<FileTypes>) {
    return (
        <Tree.Root<FileTypes> aria-label="Files" {...props}>
            <Tree.Items<FileTypes>>
                {(item) => <FileItem item={item} />}
            </Tree.Items>
            <Tree.DropIndicator />
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
