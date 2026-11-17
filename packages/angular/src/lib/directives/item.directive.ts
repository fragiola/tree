import {
    computed,
    Directive,
    forwardRef,
    input,
    type Signal,
} from "@angular/core";
import type { AnyTypes, ItemOf, TreeTypes } from "@fragiola/tree";
import {
    injectTreeContext,
    TREE_ITEM,
    type TreeContext,
    type TreeItemContext,
} from "../context";
import {
    beforeInputs,
    bindFeatureAttributes,
    bindStructuralStyle,
    injectHost,
} from "../utils/helpers";
import {
    depthStyle,
    ITEM_DATA_HOST,
    itemData,
    type TreeItemState,
    treeItemState,
    UNSET_ITEM_STATE,
} from "../utils/item-state";
import { bindRegistration } from "../utils/signals";

/**
 * An item (`role="treeitem"`, the WAI-ARIA APG Tree View): `<div [treeItem]="item">`, with
 * `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` (a parent), the features' ARIA
 * (`aria-selected` with `selection()`, `aria-checked` with `checkboxes()`, `aria-busy` with
 * `asyncChildren()`), `aria-disabled` and the
 * roving `tabindex`. It is the element DOM focus goes to; its state is in `data-*` (and
 * `#node="treeItem"`, `node.state()`), its depth in `--tree-depth`. The parts inside it
 * (`treeItemContent`, `treeToggle`, `treeGroup`, …) are this item's.
 */
@Directive({
    selector: "[treeItem]",
    exportAs: "treeItem",
    providers: [
        {
            provide: TREE_ITEM,
            useExisting: forwardRef(() => TreeItemDirective),
        },
    ],
    host: {
        role: "treeitem",
        "[attr.aria-level]": "state().level",
        "[attr.aria-posinset]": "state().posinset",
        "[attr.aria-setsize]": "state().setsize",
        "[attr.aria-expanded]": "aria().expanded",
        "[attr.aria-disabled]": "aria().disabled",
        "[attr.tabindex]": "aria().tabindex",
        "data-tree-part": "item",
        "[attr.data-tree-path]": "state().path",
        ...ITEM_DATA_HOST,
        "(focus)": "onFocus($event)",
    },
})
export class TreeItemDirective<T extends TreeTypes = AnyTypes>
    implements TreeItemContext
{
    /** the item, as `<ng-template treeItems>` gives it */
    readonly treeItem = input.required<ItemOf<T>>();

    private readonly context: TreeContext = injectTreeContext("[treeItem]");
    private readonly host = injectHost();

    /** the item, with the registry erased (what the parts inside it read) */
    readonly item: Signal<ItemOf<AnyTypes>> = computed(
        () => this.treeItem() as unknown as ItemOf<AnyTypes>,
    );

    /** what the item shows: its place in the tree and its state */
    readonly state: Signal<TreeItemState> = computed(() =>
        beforeInputs(UNSET_ITEM_STATE, () =>
            treeItemState(this.context, this.item()),
        ),
    );

    protected readonly itemData = computed(() => itemData(this.state()));

    protected readonly aria = computed(() => {
        const state = this.state();
        return {
            expanded: state.leaf ? null : String(state.expanded),
            disabled: state.disabled ? "true" : null,
            tabindex: state.tabStop ? "0" : "-1",
        };
    });

    constructor() {
        bindStructuralStyle(this.host, () => depthStyle(this.state()));
        bindFeatureAttributes(this.host, () => this.state().attributes);
        bindRegistration(
            this.context.engine,
            () => beforeInputs(undefined, () => this.item().id),
            "item",
            this.host,
        );
    }

    /** DOM focus on the item's own element (not a control inside it) makes it the focused item */
    protected onFocus(event: FocusEvent): void {
        if (event.target === event.currentTarget) {
            this.context.engine()?.adapter.handleFocus(this.item().id);
        }
    }
}
