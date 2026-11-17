import { computed, Directive, type Signal } from "@angular/core";
import type { DropPosition } from "@fragiola/tree";
import { injectTreeContext } from "../context";
import {
    bindStructuralStyle,
    dataAttr,
    injectHost,
    px,
} from "../utils/helpers";

export interface DropIndicatorState {
    /** where the drop goes, relative to `itemId`: a line `before` or `after` it, or `inside` it */
    position: DropPosition;
    /** the item the position is relative to (`null`: an empty tree) */
    itemId: string | null;
    /** the level the dropped items take (1 for the root) */
    level: number;
}

/**
 * Where the drag under way would drop: `<div treeDropIndicator></div>` inside `[treeRoot]`, shown
 * only while there is a drop target (`display: none` otherwise), absolutely positioned in the root
 * (a line at the target's level for `before` and `after`, the row's box for `inside`), from
 * `engine.get("drop-indicator")`. It sets only its geometry; draw the line or the box yourself.
 * Hidden from assistive technology (the live region announces the drag).
 */
@Directive({
    selector: "[treeDropIndicator]",
    exportAs: "treeDropIndicator",
    host: {
        "aria-hidden": "true",
        "data-tree-part": "drop-indicator",
        "[attr.data-drop-position]": "data().position",
        "[attr.data-depth]": "data().depth",
    },
})
export class TreeDropIndicatorDirective {
    private readonly context = injectTreeContext("[treeDropIndicator]");

    private readonly indicator = computed(() => {
        this.context.revision();
        return this.context.engine()?.get("drop-indicator") ?? null;
    });

    /** the drop target, or null while there is none */
    readonly state: Signal<DropIndicatorState | null> = computed(() => {
        const indicator = this.indicator();
        return indicator
            ? {
                  position: indicator.position,
                  itemId: indicator.itemId,
                  level: indicator.level,
              }
            : null;
    });

    protected readonly data = computed(() => {
        const state = this.state();
        return {
            position: dataAttr(state?.position),
            depth: state ? dataAttr(state.level - 1) : null,
        };
    });

    constructor() {
        bindStructuralStyle(injectHost(), () => {
            const indicator = this.indicator();
            if (!indicator) return { display: "none" };
            return {
                position: "absolute",
                insetInlineStart: px(indicator.inlineOffset),
                insetInlineEnd: "0px",
                insetBlockStart: px(indicator.blockOffset),
                blockSize: px(indicator.blockSize),
                pointerEvents: "none",
            };
        });
    }
}
