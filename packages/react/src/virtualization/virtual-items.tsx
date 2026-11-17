import type { AnyTypes, ItemOf, TreeTypes } from "@fragiola/tree";
import type { VirtualRow } from "@fragiola/tree/virtualization";
import * as React from "react";
import { useTreeContext } from "../context";
import { useTreeVirtualWindow } from "./use-tree-virtual-window";

export interface VirtualItemsProps<T extends TreeTypes = AnyTypes> {
    /**
     * renders a row: called with each rendered visible item, in order, and its `VirtualRow` (its
     * level, offset, size). Render a `Tree.Item` with no `Tree.Group`: a virtualized tree is flat
     */
    children: (item: ItemOf<T>, row: VirtualRow) => React.ReactNode;
}

/** A spacer: the space of the rows that are not rendered (`data-tree-part="spacer"`). */
function spacer(key: string, size: number): React.ReactElement {
    const props = {
        "aria-hidden": true,
        "data-tree-part": "spacer",
        // it keeps its size in a flex root
        style: { height: size, flexShrink: 0 },
    };
    return <div key={key} {...props} />;
}

/**
 * The rows of a virtualized tree (a `Tree.Root` whose model has `virtualization()`): only the
 * visible items in view plus the overscan, flat (each item carries its `aria-level`,
 * `aria-posinset` and `aria-setsize`), between spacers that take the place of the others. It renders no element of its own.
 *
 * ```tsx
 * import { VirtualItems, virtualization } from "@fragiola/tree-react/virtualization";
 *
 * const model = createTreeModel(json, { features: [virtualization({ rowSize: 28 })] });
 * <Tree.Root model={model} style={{ height: 400, overflow: "auto" }}>
 *     <VirtualItems<Types>>{(item) => <FileRow item={item} />}</VirtualItems>
 * </Tree.Root>
 * ```
 */
export function VirtualItems<T extends TreeTypes = AnyTypes>({
    children,
}: VirtualItemsProps<T>) {
    const { state } = useTreeContext("VirtualItems");
    const window = useTreeVirtualWindow();
    if (!window) return null;
    const rows: React.ReactNode[] = [];
    for (const row of window.rows) {
        const item = state.items[row.itemId];
        if (!item) continue;
        rows.push(
            <React.Fragment key={`row:${row.itemId}`}>
                {row.spaceBefore > 0 && spacer("spacer", row.spaceBefore)}
                {children(item as unknown as ItemOf<T>, row)}
            </React.Fragment>,
        );
    }
    if (window.spaceAfter > 0) {
        rows.push(spacer("spacer:after", window.spaceAfter));
    }
    return rows;
}
