import { useItemContext, useTreeContext } from "../context";
import { itemDataAttributes, useTreeItemState } from "../hooks/internal";
import type { TreeItemState } from "../hooks/use-tree-item";
import { type SpanPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface ToggleProps extends SpanPrimitiveProps<TreeItemState> {
    /** what it shows (a chevron); no text and no icon of its own */
    children?: React.ReactNode;
}

/**
 * Expands or collapses the enclosing item on a press. It is a pointer affordance: the keyboard
 * expands with the arrows on the item, which carries `aria-expanded`, so the toggle is hidden from
 * assistive technology and never takes focus. Rendered on a leaf too, with `data-leaf`.
 */
export function Toggle(props: ToggleProps) {
    const { children, ...rest } = props;
    const { engine } = useTreeContext("Toggle");
    const { item } = useItemContext("Toggle");
    const state = useTreeItemState(item);
    const onClick = () => {
        engine?.adapter.handleToggleClick(item.id);
    };
    return useRenderElement("span", rest, {
        state,
        props: {
            "aria-hidden": true,
            "data-tree-part": "toggle",
            ...itemDataAttributes(state),
            onClick,
            children,
        },
    });
}
