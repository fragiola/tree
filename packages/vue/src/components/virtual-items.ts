import type { AnyTypes, ItemOf, TreeTypes, VirtualRow } from "@fragiola/tree";
import { Fragment, h, type VNode } from "vue";
import { useTreeVirtualWindow } from "../composables/use-tree-virtual-window";
import { useTreeContext } from "../context";
import {
    definePrimitive,
    type SlotFunction,
    type TreeComponent,
} from "../utils/primitive";

// biome-ignore lint/complexity/noBannedTypes: Tree.VirtualItems takes no prop
export type VirtualItemsProps = {};

export interface VirtualItemsSlots<T extends TreeTypes = AnyTypes> {
    /**
     * renders a row: called with each rendered visible item, in order, and its `VirtualRow` (its
     * level, offset, size). Render a `Tree.Item` with no `Tree.Group`: a virtualized tree is flat
     */
    default?: SlotFunction<{ item: ItemOf<T>; row: VirtualRow }>;
}

/** A spacer: the space of the rows that are not rendered (`data-tree-part="spacer"`). */
function spacer(key: string, size: number): VNode {
    return h("div", {
        key,
        "aria-hidden": "true",
        "data-tree-part": "spacer",
        // it keeps its size in a flex root
        style: { height: `${size}px`, flexShrink: 0 },
    });
}

/**
 * The rows of a virtualized tree (`Tree.Root` with `virtual`): only the visible items in view plus
 * the overscan, flat (each item carries its `aria-level`, `aria-posinset` and `aria-setsize`),
 * between spacers that take the place of the others. It renders no element of its own.
 *
 * ```vue
 * <Tree.Root :model="model" :virtual="virtual" style="height: 400px; overflow: auto">
 *     <Tree.VirtualItems v-slot="{ item }"><FileRow :item="item" /></Tree.VirtualItems>
 * </Tree.Root>
 * ```
 */
export const VirtualItems: TreeComponent<VirtualItemsProps, VirtualItemsSlots> =
    definePrimitive<VirtualItemsProps, VirtualItemsSlots>(
        "VirtualItems",
        [],
        (_props, { slots }) => {
            const { state } = useTreeContext("VirtualItems");
            const window = useTreeVirtualWindow();
            return () => {
                const current = window.value;
                if (!current) return [];
                const tree = state.value;
                const nodes: VNode[] = [];
                for (const row of current.rows) {
                    const item = tree.items[row.itemId];
                    if (!item) continue;
                    nodes.push(
                        h(Fragment, { key: row.itemId }, [
                            row.spaceBefore > 0
                                ? spacer(
                                      `before:${row.itemId}`,
                                      row.spaceBefore,
                                  )
                                : null,
                            ...(slots.default?.({ item, row }) ?? []),
                        ]),
                    );
                }
                if (current.spaceAfter > 0) {
                    nodes.push(spacer("after", current.spaceAfter));
                }
                return nodes;
            };
        },
    );
