import type { AnyTypes, ItemOf, TreeTypes } from "@fragiola/tree";
import { Fragment, h } from "vue";
import { depthStyle, itemDataAttributes } from "../composables/internal";
import type { TreeItemState } from "../composables/use-tree-item";
import { useItemContext, useTreeContext } from "../context";
import {
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
    type TreeComponent,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface GroupProps extends PrimitiveProps {
    /** render the group while the item is collapsed too, hidden (default false: only when expanded) */
    keepMounted?: boolean | undefined;
}

export interface GroupSlots<T extends TreeTypes = AnyTypes>
    extends RenderSlot<TreeItemState> {
    /**
     * renders a child item: called with each child of the enclosing item, in order; with
     * `typedTree<Types>().Group`, `item.data` narrows on `item.kind`
     */
    default?: SlotFunction<{ item: ItemOf<T> }>;
}

/**
 * The children of the enclosing `Tree.Item` (`role="group"`), rendered only while the item is
 * expanded (`keep-mounted` keeps them, hidden): renders the default slot with each child, keyed by
 * its id. Its state is the item's.
 */
export const Group: TreeComponent<GroupProps, GroupSlots> = definePrimitive<
    GroupProps,
    GroupSlots
>(
    "Group",
    ["keepMounted", "as"],
    (props, { attrs, slots }) => {
        const { state: tree } = useTreeContext("Group");
        const itemContext = useItemContext("Group");
        return () => {
            const { item, state } = itemContext.value;
            if (!state.expanded && props.keepMounted !== true) return null;
            const items = tree.value.items;
            const children = (item.childItemIds ?? []).flatMap((itemId) => {
                const child = items[itemId];
                return child
                    ? [
                          h(
                              Fragment,
                              { key: itemId },
                              slots.default?.({ item: child }),
                          ),
                      ]
                    : [];
            });
            return renderElement({
                tag: "div",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                props: {
                    role: "group",
                    "data-tree-part": "group",
                    ...itemDataAttributes(state),
                },
                style: {
                    ...depthStyle(state),
                    ...(state.expanded ? {} : { display: "none" }),
                },
                children: () => children,
            });
        };
    },
    { booleans: ["keepMounted"] },
);
