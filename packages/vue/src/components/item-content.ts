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
    /** the row's content: the label, an icon, the toggle, the checkbox; no text of its own */
    default?: SlotFunction<{ state: TreeItemState }>;
}

/**
 * An item's row: the element a press selects (Shift extends, Ctrl/Cmd toggles; `expand-on-click`
 * also expands) and a drag starts from (Pointer Events), and the rect the drag hit-tests. A press
 * on a control inside it (a button, an input, the toggle, the checkbox) is the control's.
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
            const exempt = (event: Event) => {
                const target = event.target as Element | null;
                const row = event.currentTarget as Element | null;
                const control = target?.closest?.(DRAG_EXEMPT);
                return (
                    control !== null &&
                    control !== undefined &&
                    control !== row &&
                    row?.contains(control) === true
                );
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
