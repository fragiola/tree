import { computed, Directive, type Signal } from "@angular/core";
import { injectTreeContext } from "../context";

export interface LiveRegionState {
    /** the latest text the root's `announce` returned ("" before any) */
    announcement: string;
}

/**
 * The tree's live region (`role="status"`, `aria-live="polite"`): `<div treeLiveRegion></div>`.
 * Its text is the one the root's `announce` returned for the latest drag step or failed load. The
 * package writes no text: with no `announce`, it stays empty. Hide it visually yourself (a
 * visually-hidden class).
 */
@Directive({
    selector: "[treeLiveRegion]",
    exportAs: "treeLiveRegion",
    host: {
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true",
        "data-tree-part": "live-region",
        "[textContent]": "state().announcement",
    },
})
export class TreeLiveRegionDirective {
    private readonly context = injectTreeContext("[treeLiveRegion]");

    /** the latest announcement */
    readonly state: Signal<LiveRegionState> = computed(() => {
        this.context.revision();
        return {
            announcement: this.context.engine()?.get("announcement") ?? "",
        };
    });
}
