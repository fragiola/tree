import { useTreeContext } from "../context";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface LiveRegionState {
    /** the latest text the root's `announce` returned ("" before any) */
    announcement: string;
}

export interface LiveRegionProps extends DivPrimitiveProps<LiveRegionState> {}

/**
 * The tree's live region (`role="status"`, `aria-live="polite"`): it shows the text the root's
 * `announce` returned for the latest drag step or failed load. The package writes no text: with no
 * `announce`, it stays empty. Hide it visually yourself (a visually-hidden class).
 */
export function LiveRegion(props: LiveRegionProps) {
    const { engine } = useTreeContext("LiveRegion");
    const announcement = engine?.get("announcement") ?? "";
    return useRenderElement("div", props, {
        state: { announcement },
        props: {
            role: "status",
            "aria-live": "polite",
            "aria-atomic": true,
            "data-tree-part": "live-region",
            children: announcement,
        },
    });
}
