import { computed, type Signal } from "@angular/core";
import type { VirtualWindow } from "@fragiola/tree";
import { injectTreeContext } from "../context";

/**
 * The rows the enclosing `[treeRoot]` renders when it is virtualized (its `virtual` input): each
 * visible item in view plus the overscan, with its offset, size and the spacer before it, and the
 * space after the last one. `null` before the root created its engine, and without `virtual`.
 * `ng-template[treeVirtualItems]` renders it; read it to render the rows your own way. Call it in
 * an injection context.
 */
export function injectTreeVirtualWindow(): Signal<VirtualWindow | null> {
    const context = injectTreeContext("injectTreeVirtualWindow");
    return computed(() => {
        // the window changes with the tree and with the engine's revision (a scroll, a measure)
        context.state();
        context.revision();
        return context.engine()?.get("virtual-window") ?? null;
    });
}
