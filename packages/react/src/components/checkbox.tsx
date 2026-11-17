import { useItemContext, useTreeContext } from "../context";
import { itemDataAttributes, useTreeItemState } from "../hooks/internal";
import type { TreeItemState } from "../hooks/use-tree-item";
import { type SpanPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface CheckboxProps extends SpanPrimitiveProps<TreeItemState> {
    /** what it shows (a check mark, a dash when mixed); no text and no icon of its own */
    children?: React.ReactNode;
}

/**
 * The enclosing item's checkbox (`role="checkbox"`, `aria-checked` `true`, `false` or `"mixed"`):
 * a press toggles its check (`item.toggle-check`). Focus stays on the item, which carries the same
 * `aria-checked` when the root has `checkboxes` (and Space toggles it), so the checkbox is hidden
 * from assistive technology and never takes focus.
 */
export function Checkbox(props: CheckboxProps) {
    const { children, ...rest } = props;
    const { engine } = useTreeContext("Checkbox");
    const { item } = useItemContext("Checkbox");
    const state = useTreeItemState(item);
    const onClick = () => {
        engine?.adapter.handleCheckboxClick(item.id);
    };
    return useRenderElement("span", rest, {
        state,
        props: {
            role: "checkbox",
            "aria-checked": state.indeterminate ? "mixed" : state.checked,
            "aria-disabled": state.disabled || undefined,
            "aria-hidden": true,
            "data-tree-part": "checkbox",
            ...itemDataAttributes(state),
            onClick,
            children,
        },
    });
}
