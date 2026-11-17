import type { AnyTypes, ItemOf, TreeTypes } from "@fragiola/tree";
import type { VirtualRow } from "@fragiola/tree/virtualization";
import { Fragment, h, type VNode } from "vue";
import { useTreeContext } from "../context";
import {
    definePrimitive,
    type SlotFunction,
    type TreeComponent,
} from "../utils/primitive";
import { useTreeVirtualWindow } from "./use-tree-virtual-window";

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
 * The rows of a virtualized tree (a `Tree.Root` whose model has `virtualization()`): only the
 * visible items in view plus the overscan, flat (each item carries its `aria-level`,
 * `aria-posinset` and `aria-setsize`), between spacers that take the place of the others. It
 * renders no element of its own. `typedVirtualItems<Types>()` is the same component, typed.
 *
 * ```vue
 * <Tree.Root :model="model" style="height: 400px; overflow: auto">
 *     <VirtualItems v-slot="{ item }"><FileRow :item="item" /></VirtualItems>
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
                        h(Fragment, { key: `row:${row.itemId}` }, [
                            row.spaceBefore > 0
                                ? spacer("spacer", row.spaceBefore)
                                : null,
                            ...(slots.default?.({ item, row }) ?? []),
                        ]),
                    );
                }
                if (current.spaceAfter > 0) {
                    nodes.push(spacer("spacer:after", current.spaceAfter));
                }
                return nodes;
            };
        },
    );

/**
 * `VirtualItems` typed by your registry (its slot's `item`), which a Vue template cannot pass:
 * `const Rows = typedVirtualItems<Types>()`.
 */
export function typedVirtualItems<T extends TreeTypes>(): TreeComponent<
    VirtualItemsProps,
    VirtualItemsSlots<T>
> {
    return VirtualItems as unknown as TreeComponent<
        VirtualItemsProps,
        VirtualItemsSlots<T>
    >;
}
