import { computed, type Signal } from "@angular/core";
import type { VirtualWindow } from "@fragiola/tree/virtualization";
import { ɵinjectTreeContext as injectTreeContext } from "@fragiola/tree-angular";

/**
 * The rows the enclosing `[treeRoot]` renders when its model has the virtualization feature
 * (`virtualization(options)`): each visible item in view plus the overscan, with its offset, size
 * and the spacer before it, and the space after the last one. `null` before the root created its
 * engine, and without the feature.
 * `ng-template[treeVirtualItems]` renders it; read it to render the rows your own way. Call it in
 * an injection context.
 */
export function injectTreeVirtualWindow(): Signal<VirtualWindow | null> {
    const context = injectTreeContext("injectTreeVirtualWindow");
    return computed(() => {
        // the window changes with the tree and with the engine's revision (a scroll, a measure)
        context.state();
        context.revision();
        // the virtualization feature's key: undefined on an engine without it
        const virtual = context.engine() as {
            get(key: "virtual-window"): VirtualWindow | null | undefined;
        } | null;
        return virtual?.get("virtual-window") ?? null;
    });
}
