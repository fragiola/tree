import { DRAG_EXEMPT } from "@fragiola/tree";
import { depthStyle, itemDataAttributes } from "../composables/internal";
import type { TreeItemState } from "../composables/use-tree-item";
import { useItemContext, useTreeContext } from "../context";
import {
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
    type TreeComponent,
} from "../utils/primitive";
import { registerElement } from "../utils/registration";
import { elementRef, type RenderSlot, renderElement } from "../utils/render";

export interface ItemContentProps extends PrimitiveProps {}

export interface ItemContentSlots extends RenderSlot<TreeItemState> {
    /** the row's content: the label, an icon, the toggle, your check control or rename editor; no text of its own */
    default?: SlotFunction<{ state: TreeItemState }>;
}

/**
 * An item's row: the element a press selects (Shift extends, Ctrl/Cmd toggles; `expand-on-click`
 * also expands) and a drag starts from (Pointer Events), and the rect the drag hit-tests. A press
 * on a control inside it (a button, an input, the toggle) is the control's.
 */
export const ItemContent: TreeComponent<ItemContentProps, ItemContentSlots> =
    definePrimitive<ItemContentProps, ItemContentSlots>(
        "ItemContent",
        ["as"],
        (props, { attrs, slots }) => {
            const { engine } = useTreeContext("ItemContent");
            const itemContext = useItemContext("ItemContent");
            const itemId = () => itemContext.value.item.id;
            const ref = elementRef(
                (element) => {
                    const current = engine.value;
                    if (!current) return undefined;
                    const id = itemId();
                    return registerElement(
                        current,
                        `content:${id}`,
                        element,
                        (registered) =>
                            current.adapter.registerContent(id, registered),
                    );
                },
                () => [engine.value, itemId()],
            );
            // a press on a control inside the row (a button, an input, the toggle) is the
            // control's. Read along the dispatch path, not the DOM: a control's own listener may
            // have removed it already (Vue flushes between listeners, so a `v-if` on the state its
            // command changed takes it out before the click reaches the row)
            const exempt = (event: Event) => {
                const row = event.currentTarget;
                for (const target of event.composedPath()) {
                    if (target === row) return false;
                    // `nodeType`, not `instanceof`: the tree may be in another window (an iframe)
                    const element = target as Element;
                    if (
                        element.nodeType === 1 &&
                        element.matches(DRAG_EXEMPT)
                    ) {
                        return true;
                    }
                }
                return false;
            };
            const onPointerdown = (event: PointerEvent) => {
                engine.value?.adapter.handlePointerDown(itemId(), event);
            };
            const onClick = (event: MouseEvent) => {
                if (!exempt(event)) {
                    engine.value?.adapter.handleClick(itemId(), event);
                }
            };
            return () => {
                const { state } = itemContext.value;
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state,
                    ref,
                    props: {
                        "data-tree-part": "content",
                        ...itemDataAttributes(state),
                        onPointerdown,
                        onClick,
                    },
                    style: depthStyle(state),
                    children: () => slots.default?.({ state }),
                });
            };
        },
    );
