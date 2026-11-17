import { DRAG_EXEMPT } from "@fragiola/tree";
import * as React from "react";
import { useItemContext, useTreeContext } from "../context";
import {
    depthStyle,
    itemDataAttributes,
    useTreeItemState,
} from "../hooks/internal";
import type { TreeItemState } from "../hooks/use-tree-item";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface ItemContentProps extends DivPrimitiveProps<TreeItemState> {
    /** the row's content: the label, an icon, the toggle, the checkbox; no text of its own */
    children?: React.ReactNode;
}

/**
 * An item's row: the element a press selects (Shift extends, Ctrl/Cmd toggles; `expandOnClick`
 * also expands) and a drag starts from (Pointer Events), and the rect the drag hit-tests. A press
 * on a control inside it (a button, an input, the toggle, the checkbox) is the control's.
 */
export function ItemContent(props: ItemContentProps) {
    const { children, ...rest } = props;
    const { engine } = useTreeContext("ItemContent");
    const { item } = useItemContext("ItemContent");
    const state = useTreeItemState(item);
    const itemId = item.id;
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            if (!element || !engine) return;
            engine.adapter.registerContent(itemId, element);
            return () => engine.adapter.registerContent(itemId, null);
        },
        [engine, itemId],
    );
    const exempt = (event: React.SyntheticEvent<HTMLElement>) => {
        const target = event.target as Element | null;
        const control = target?.closest?.(DRAG_EXEMPT);
        return (
            control !== null &&
            control !== undefined &&
            control !== event.currentTarget &&
            event.currentTarget.contains(control)
        );
    };
    const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
        engine?.adapter.handlePointerDown(itemId, event.nativeEvent);
    };
    const onClick = (event: React.MouseEvent<HTMLElement>) => {
        if (!exempt(event)) engine?.adapter.handleClick(itemId, event);
    };
    return useRenderElement("div", rest, {
        state,
        ref,
        props: {
            "data-tree-part": "content",
            ...itemDataAttributes(state),
            onPointerDown,
            onClick,
            children,
        },
        style: depthStyle(state),
    });
}
