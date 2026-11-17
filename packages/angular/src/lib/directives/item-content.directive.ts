import { computed, Directive, type Signal } from "@angular/core";
import { DRAG_EXEMPT } from "@fragiola/tree";
import { injectItemContext, injectTreeContext } from "../context";
import {
    bindFeatureAttributes,
    bindStructuralStyle,
    injectHost,
} from "../utils/helpers";
import {
    depthStyle,
    ITEM_DATA_HOST,
    itemData,
    type TreeItemState,
} from "../utils/item-state";
import { bindRegistration } from "../utils/signals";

/**
 * An item's row: `<div treeItemContent>`, the element a press selects (Shift extends, Ctrl/Cmd
 * toggles; `expandOnClick` also expands) and a drag starts from (Pointer Events), and the rect the
 * drag hit-tests. A press on a control inside it (a button, an input, the toggle, an element with
 * `data-tree-no-drag`) is the control's.
 */
@Directive({
    selector: "[treeItemContent]",
    exportAs: "treeItemContent",
    host: {
        "data-tree-part": "content",
        ...ITEM_DATA_HOST,
        "(pointerdown)": "onPointerDown($event)",
        "(click)": "onClick($event)",
    },
})
export class TreeItemContentDirective {
    private readonly context = injectTreeContext("[treeItemContent]");
    private readonly item = injectItemContext("[treeItemContent]");
    private readonly host = injectHost();

    /** the enclosing item's state */
    readonly state: Signal<TreeItemState> = this.item.state;

    protected readonly itemData = computed(() => itemData(this.state()));

    constructor() {
        // the installed features' data-* (`data-selected` with `selection()`)
        bindFeatureAttributes(
            this.host,
            () => this.state().attributes,
            "data-",
        );
        bindStructuralStyle(this.host, () => depthStyle(this.state()));
        bindRegistration(
            this.context.engine,
            () => this.item.state().itemId || undefined,
            "content",
            this.host,
        );
    }

    protected onPointerDown(event: PointerEvent): void {
        this.context
            .engine()
            ?.adapter.handlePointerDown(this.item.item().id, event);
    }

    protected onClick(event: MouseEvent): void {
        if (!exempt(event)) {
            this.context
                .engine()
                ?.adapter.handleClick(this.item.item().id, event);
        }
    }
}

/**
 * A press on a control inside the row (a button, an input, the toggle) is the control's. Read
 * along the dispatch path, not the DOM: a control's own listener may have removed it already (a
 * re-render on the state its command changed takes it out before the click reaches the row).
 */
function exempt(event: Event): boolean {
    const row = event.currentTarget;
    for (const target of event.composedPath()) {
        if (target === row) return false;
        // `nodeType`, not `instanceof`: the tree may be in another window (an iframe)
        const element = target as Element;
        if (element.nodeType === 1 && element.matches(DRAG_EXEMPT)) {
            return true;
        }
    }
    return false;
}
