// A virtualized tree for the tests: 50 folders of 20 files, all expanded (1050 visible items),
// rendered flat by `Tree.VirtualItems` (the same tree as packages/react's virtual tests).
import { h, type VNodeChild } from "vue";
import {
    createTreeModel,
    createTreeVirtualizer,
    type ItemOf,
    type TreeJson,
} from "../src";
import { type FileTypes, Tree } from "./tree";

export function bigTree(): TreeJson<FileTypes> {
    const items: TreeJson<FileTypes>["items"] = {};
    const rootItemIds: string[] = [];
    for (let f = 0; f < 50; f++) {
        const childItemIds: string[] = [];
        for (let i = 0; i < 20; i++) {
            childItemIds.push(`f${f}-${i}`);
            items[`f${f}-${i}`] = {
                kind: "file",
                label: `file ${f}.${i}`,
                data: { size: i },
            };
        }
        rootItemIds.push(`f${f}`);
        items[`f${f}`] = { kind: "folder", label: `folder ${f}`, childItemIds };
    }
    return { version: 1, rootItemIds, items, expandedItemIds: rootItemIds };
}

export const virtual = createTreeVirtualizer({
    rowSize: 20,
    overscan: 2,
    initialViewportSize: 100,
});

/** `Tree.Root` with `virtual` and its rows: an item, its row, its toggle and its label. */
export function bigFileTree(withVirtual = true): VNodeChild {
    return h(
        Tree.Root,
        {
            "aria-label": "Files",
            model: createTreeModel<FileTypes>(bigTree()),
            virtual: withVirtual ? virtual : undefined,
            style: { height: "100px", overflow: "auto" },
        },
        {
            default: () => [
                h(Tree.VirtualItems, null, {
                    default: ({ item }: { item: ItemOf<FileTypes> }) => [
                        h(
                            Tree.Item,
                            { item },
                            {
                                default: () => [
                                    h(Tree.ItemContent, null, {
                                        default: () => [
                                            h(Tree.Toggle),
                                            h("span", item.label),
                                        ],
                                    }),
                                ],
                            },
                        ),
                    ],
                }),
            ],
        },
    );
}
