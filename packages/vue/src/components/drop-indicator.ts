import type { DropPosition } from "@fragiola/tree";
import { useTreeContext } from "../context";
import {
    definePrimitive,
    type PrimitiveProps,
    type TreeComponent,
} from "../utils/primitive";
import {
    dataAttributes,
    px,
    type RenderSlot,
    renderElement,
} from "../utils/render";

export interface DropIndicatorState {
    /** where the drop goes, relative to `itemId`: a line `before` or `after` it, or `inside` it */
    position: DropPosition;
    /** the item the position is relative to (`null`: an empty tree) */
    itemId: string | null;
    /** the level the dropped items take (1 for the root) */
    level: number;
}

export interface DropIndicatorProps extends PrimitiveProps {}

export interface DropIndicatorSlots extends RenderSlot<DropIndicatorState> {}

/**
 * Where the drag under way would drop, rendered only while there is a drop target: absolutely
 * positioned in the root (a line at the target's level for `before` and `after`, the row's box
 * for `inside`), from `engine.get("drop-indicator")`. It sets only its geometry; draw the line or
 * the box yourself. Hidden from assistive technology (the live region announces the drag).
 */
export const DropIndicator: TreeComponent<
    DropIndicatorProps,
    DropIndicatorSlots
> = definePrimitive<DropIndicatorProps, DropIndicatorSlots>(
    "DropIndicator",
    ["as"],
    (props, { attrs, slots }) => {
        const { engine, revision } = useTreeContext("DropIndicator");
        return () => {
            revision.value;
            const indicator = engine.value?.get("drop-indicator") ?? null;
            if (!indicator) return null;
            const state: DropIndicatorState = {
                position: indicator.position,
                itemId: indicator.itemId,
                level: indicator.level,
            };
            return renderElement({
                tag: "div",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                props: {
                    "aria-hidden": true,
                    "data-tree-part": "drop-indicator",
                    ...dataAttributes({
                        "drop-position": indicator.position,
                        depth: indicator.level - 1,
                    }),
                },
                style: {
                    position: "absolute",
                    insetInlineStart: px(indicator.inlineOffset),
                    insetInlineEnd: "0px",
                    insetBlockStart: px(indicator.blockOffset),
                    blockSize: px(indicator.blockSize),
                    pointerEvents: "none",
                },
            });
        };
    },
);
