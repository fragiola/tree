import type { AnyTypes, ItemOf, TreeTypes } from "@fragiola/tree";
import { computed, provide } from "vue";
import { type TreeItemState, useTreeItem } from "../composables/use-tree-item";
import { ItemKey } from "../context";
import {
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
    type TreeComponent,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface ItemProps<T extends TreeTypes = AnyTypes>
    extends PrimitiveProps {
    /** the item, as `Tree.Items` or `Tree.Group` gives it */
    item: ItemOf<T>;
}

export interface ItemSlots extends RenderSlot<TreeItemState> {
    /** its row (`Tree.ItemContent`) and its group (`Tree.Group`); no text of its own */
    default?: SlotFunction<{ state: TreeItemState }>;
}

/**
 * An item (`role="treeitem"`, the WAI-ARIA APG Tree View): `aria-level`, `aria-posinset`,
 * `aria-setsize`, `aria-expanded` (a parent), `aria-selected` (a tree that selects),
 * `aria-checked` (`checkboxes`), `aria-disabled`, `aria-busy` (loading) and the roving `tabindex`.
 * It is the element DOM focus goes to; its state is in `data-*`, its depth in `--tree-depth`.
 */
export const Item: TreeComponent<ItemProps, ItemSlots> = definePrimitive<
    ItemProps,
    ItemSlots
>("Item", ["item", "as"], (props, { attrs, slots }) => {
    const { state, props: itemProps } = useTreeItem(() => props.item);
    provide(
        ItemKey,
        computed(() => ({
            item: props.item as unknown as ItemOf<AnyTypes>,
            state: state.value,
        })),
    );
    return () => {
        const { ref, style, ...elementProps } = itemProps.value;
        const value = state.value;
        return renderElement({
            tag: "div",
            as: props.as,
            attrs,
            render: slots.render,
            state: value,
            ref,
            props: elementProps,
            style,
            children: () => slots.default?.({ state: value }),
        });
    };
});
