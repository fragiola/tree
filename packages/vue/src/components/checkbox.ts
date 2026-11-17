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

export interface CheckboxProps extends PrimitiveProps {}

export interface CheckboxSlots extends RenderSlot<TreeItemState> {
    /** what it shows (a check mark, a dash when mixed); no text and no icon of its own */
    default?: SlotFunction<{ state: TreeItemState }>;
}

/**
 * The enclosing item's checkbox (`role="checkbox"`, `aria-checked` `true`, `false` or `"mixed"`):
 * a press toggles its check (`item.toggle-check`). Focus stays on the item, which carries the same
 * `aria-checked` when the root has `checkboxes` (and Space toggles it), so the checkbox is hidden
 * from assistive technology and never takes focus.
 */
export const Checkbox: TreeComponent<CheckboxProps, CheckboxSlots> =
    definePrimitive<CheckboxProps, CheckboxSlots>(
        "Checkbox",
        ["as"],
        (props, { attrs, slots }) => {
            const { engine, model, state: tree } = useTreeContext("Checkbox");
            const itemContext = useItemContext("Checkbox");
            const onClick = () => {
                engine.value?.adapter.handleCheckboxClick(
                    itemContext.value.item.id,
                );
            };
            return () => {
                tree.value;
                const { item, state: itemState } = itemContext.value;
                // the full check state (mixed included), even when the root has no `checkboxes`
                const checkState = model.get("check-state-by", {
                    itemId: item.id,
                });
                const state: TreeItemState = {
                    ...itemState,
                    checkState,
                    checked: checkState === "checked",
                    indeterminate: checkState === "mixed",
                };
                return renderElement({
                    tag: "span",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state,
                    props: {
                        role: "checkbox",
                        "aria-checked": state.indeterminate
                            ? "mixed"
                            : state.checked,
                        "aria-disabled": state.disabled || undefined,
                        "aria-hidden": true,
                        "data-tree-part": "checkbox",
                        ...itemDataAttributes(state),
                        onClick,
                    },
                    children: () => slots.default?.({ state }),
                });
            };
        },
    );
