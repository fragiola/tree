import { itemDataAttributes } from "../composables/internal";
import type { TreeItemState } from "../composables/use-tree-item";
import { useItemContext, useTreeContext } from "../context";
import {
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
    type TreeComponent,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface ToggleProps extends PrimitiveProps {}

export interface ToggleSlots extends RenderSlot<TreeItemState> {
    /** what it shows (a chevron); no text and no icon of its own */
    default?: SlotFunction<{ state: TreeItemState }>;
}

/**
 * Expands or collapses the enclosing item on a press. It is a pointer affordance: the keyboard
 * expands with the arrows on the item, which carries `aria-expanded`, so the toggle is hidden from
 * assistive technology and never takes focus. Rendered on a leaf too, with `data-leaf`.
 */
export const Toggle: TreeComponent<ToggleProps, ToggleSlots> = definePrimitive<
    ToggleProps,
    ToggleSlots
>("Toggle", ["as"], (props, { attrs, slots }) => {
    const { engine } = useTreeContext("Toggle");
    const itemContext = useItemContext("Toggle");
    const onClick = () => {
        engine.value?.adapter.handleToggleClick(itemContext.value.item.id);
    };
    return () => {
        const { state } = itemContext.value;
        return renderElement({
            tag: "span",
            as: props.as,
            attrs,
            render: slots.render,
            state,
            props: {
                "aria-hidden": true,
                "data-tree-part": "toggle",
                ...itemDataAttributes(state),
                onClick,
            },
            children: () => slots.default?.({ state }),
        });
    };
});
