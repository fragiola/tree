import { computed, Directive, type Signal } from "@angular/core";
import { injectItemContext, injectTreeContext } from "../context";
import { bindFeatureAttributes, injectHost } from "../utils/helpers";
import {
    ITEM_DATA_HOST,
    itemData,
    type TreeItemState,
} from "../utils/item-state";

/**
 * Expands or collapses the enclosing item on a press: `<span treeToggle>▸</span>`. It is a pointer
 * affordance: the keyboard expands with the arrows on the item, which carries `aria-expanded`, so
 * the toggle is hidden from assistive technology and never takes focus. On a leaf too, with
 * `data-leaf`.
 */
@Directive({
    selector: "[treeToggle]",
    exportAs: "treeToggle",
    host: {
        "aria-hidden": "true",
        "data-tree-part": "toggle",
        ...ITEM_DATA_HOST,
        "(click)": "onClick()",
    },
})
export class TreeToggleDirective {
    private readonly context = injectTreeContext("[treeToggle]");
    private readonly item = injectItemContext("[treeToggle]");

    /** the enclosing item's state */
    readonly state: Signal<TreeItemState> = this.item.state;

    protected readonly itemData = computed(() => itemData(this.state()));

    constructor() {
        // the installed features' data-* (`data-selected` with `selection()`)
        bindFeatureAttributes(
            injectHost(),
            () => this.state().attributes,
            "data-",
        );
    }

    protected onClick(): void {
        this.context.engine()?.adapter.handleToggleClick(this.item.item().id);
    }
}
