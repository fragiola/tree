// A virtualized tree for the tests: 50 folders of 20 files, all expanded (1050 visible items),
// rendered flat by `Tree.VirtualItems` (the same tree as packages/react's virtual tests).
import { h, type VNodeChild } from "vue";
import { createTreeModel, type ItemOf, type TreeJson } from "../src";
import { virtualization } from "../src/virtualization";
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

export const virtual = virtualization({
    rowSize: 20,
    overscan: 2,
    initialViewportSize: 100,
});

/** A model of `bigTree()` with the virtualization feature. */
export const virtualModel = () =>
    createTreeModel<FileTypes, readonly [typeof virtual]>(bigTree(), {
        features: [virtual],
    });

/** `Tree.Root` with a virtualized model and its rows: an item, its row, its toggle and its label. */
export function bigFileTree(withVirtual = true): VNodeChild {
    return h(
        Tree.Root,
        {
            "aria-label": "Files",
            model: withVirtual
                ? virtualModel()
                : createTreeModel<FileTypes>(bigTree()),
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
