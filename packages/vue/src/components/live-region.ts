import { useTreeContext } from "../context";
import {
    definePrimitive,
    type PrimitiveProps,
    type TreeComponent,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface LiveRegionState {
    /** the latest text the root's `announce` returned ("" before any) */
    announcement: string;
}

export interface LiveRegionProps extends PrimitiveProps {}

export interface LiveRegionSlots extends RenderSlot<LiveRegionState> {}

/**
 * The tree's live region (`role="status"`, `aria-live="polite"`): it shows the text the root's
 * `announce` returned for the latest drag step or failed load. The package writes no text: with no
 * `announce`, it stays empty. Hide it visually yourself (a visually-hidden class).
 */
export const LiveRegion: TreeComponent<LiveRegionProps, LiveRegionSlots> =
    definePrimitive<LiveRegionProps, LiveRegionSlots>(
        "LiveRegion",
        ["as"],
        (props, { attrs, slots }) => {
            const { engine, revision } = useTreeContext("LiveRegion");
            return () => {
                revision.value;
                const announcement = engine.value?.get("announcement") ?? "";
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state: { announcement },
                    props: {
                        role: "status",
                        "aria-live": "polite",
                        "aria-atomic": true,
                        "data-tree-part": "live-region",
                    },
                    children: () => announcement,
                });
            };
        },
    );
