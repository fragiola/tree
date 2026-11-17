import { computed, Directive, type Signal } from "@angular/core";
import { injectItemContext, injectTreeContext } from "../context";
import {
    ITEM_DATA_HOST,
    itemData,
    type TreeItemState,
} from "../utils/item-state";

/**
 * The enclosing item's checkbox (`role="checkbox"`, `aria-checked` `true`, `false` or `"mixed"`):
 * `<span treeCheckbox></span>`; a press toggles its check (`item.toggle-check`). Focus stays on
 * the item, which carries the same `aria-checked` when the root has `checkboxes` (and Space
 * toggles it), so the checkbox is hidden from assistive technology and never takes focus.
 */
@Directive({
    selector: "[treeCheckbox]",
    exportAs: "treeCheckbox",
    host: {
        role: "checkbox",
        "[attr.aria-checked]": "ariaChecked()",
        "[attr.aria-disabled]": "state().disabled ? 'true' : null",
        "aria-hidden": "true",
        "data-tree-part": "checkbox",
        ...ITEM_DATA_HOST,
        "(click)": "onClick()",
    },
})
export class TreeCheckboxDirective {
    private readonly context = injectTreeContext("[treeCheckbox]");
    private readonly item = injectItemContext("[treeCheckbox]");

    /** the enclosing item's state, with its full check state (mixed included) */
    readonly state: Signal<TreeItemState> = computed(() => {
        this.context.state();
        const itemState = this.item.state();
        if (!itemState.itemId) return itemState;
        // the full check state (mixed included), even when the root has no `checkboxes`
        const checkState = this.context
            .model()
            .get("check-state-by", { itemId: itemState.itemId });
        return {
            ...itemState,
            checkState,
            checked: checkState === "checked",
            indeterminate: checkState === "mixed",
        };
    });

    protected readonly itemData = computed(() => itemData(this.state()));

    protected readonly ariaChecked = computed(() => {
        const state = this.state();
        return state.indeterminate ? "mixed" : String(state.checked);
    });

    protected onClick(): void {
        this.context.engine()?.adapter.handleCheckboxClick(this.item.item().id);
    }
}
