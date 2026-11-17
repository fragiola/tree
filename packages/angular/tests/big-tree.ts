// A virtualized tree for the tests: 50 folders of 20 files, all expanded (1050 visible items),
// rendered flat by `ng-template[treeVirtualItems]` (the same tree as packages/react's virtual
// tests).
import { Component, input } from "@angular/core";
import {
    createTreeModel,
    createTreeVirtualizer,
    TREE,
    type TreeJson,
    type TreeModel,
    type TreeVirtualizer,
} from "../src/public-api";
import type { FileTypes } from "./tree";

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

/** `[treeRoot]` with `virtual` and its rows: an item, its row, its toggle and its label. */
@Component({
    selector: "test-big-tree",
    imports: [TREE],
    template: `
        <div
            [treeRoot]="model"
            [virtual]="virtual()"
            aria-label="Files"
            style="height: 100px; overflow: auto"
        >
            <ng-template [treeVirtualItems]="model" let-item let-row="row">
                <div [treeItem]="item" [attr.data-offset]="row.offset">
                    <div treeItemContent>
                        <span treeToggle></span>
                        <span>{{ item.label }}</span>
                    </div>
                </div>
            </ng-template>
        </div>
    `,
})
export class BigTree {
    readonly model: TreeModel<FileTypes> = createTreeModel<FileTypes>(
        bigTree(),
    );
    readonly virtual = input<TreeVirtualizer | undefined>(virtual);
}
