import type { AnyTypes, ItemOf, TreeTypes } from "@fragiola/tree";
import { Fragment, h } from "vue";
import { useTreeContext } from "../context";
import {
    definePrimitive,
    type SlotFunction,
    type TreeComponent,
} from "../utils/primitive";

// biome-ignore lint/complexity/noBannedTypes: Tree.Items takes no prop
export type ItemsProps = {};

export interface ItemsSlots<T extends TreeTypes = AnyTypes> {
    /**
     * renders a root item: called with each one, in order, as the model holds it (plain,
     * immutable); with `typedTree<Types>().Items`, `item.data` narrows on `item.kind`
     */
    default?: SlotFunction<{ item: ItemOf<T> }>;
}

/**
 * The root items: renders the default slot with each one, in order, keyed by its id. It renders no
 * element of its own; you own the recursion (`Tree.Group` inside your item renders its children).
 *
 * ```vue
 * <Tree.Items v-slot="{ item }"><FileItem :item="item" /></Tree.Items>
 * ```
 */
export const Items: TreeComponent<ItemsProps, ItemsSlots> = definePrimitive<
    ItemsProps,
    ItemsSlots
>("Items", [], (_props, { slots }) => {
    const { state } = useTreeContext("Items");
    return () => {
        const tree = state.value;
        return tree.rootItemIds.flatMap((itemId) => {
            const item = tree.items[itemId];
            return item
                ? [h(Fragment, { key: itemId }, slots.default?.({ item }))]
                : [];
        });
    };
});
