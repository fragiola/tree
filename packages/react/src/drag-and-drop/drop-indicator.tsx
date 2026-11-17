import type {
    AnyFeatures,
    AnyTypes,
    DropPosition,
    DropIndicator as Indicator,
    TreeEngine,
} from "@fragiola/tree";
import { useTreeContext } from "../context";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "../utils/use-render";

export interface DropIndicatorState {
    /** where the drop goes, relative to `itemId`: a line `before` or `after` it, or `inside` it */
    position: DropPosition;
    /** the item the position is relative to (`null`: an empty tree) */
    itemId: string | null;
    /** the level the dropped items take (1 for the root) */
    level: number;
}

export interface DropIndicatorProps
    extends DivPrimitiveProps<DropIndicatorState> {}

/**
 * Where the drag under way would drop, rendered only while there is a drop target: absolutely
 * positioned in the root (a line at the target's level for `before` and `after`, the row's box
 * for `inside`), from `engine.get("drop-indicator")`. It sets only its geometry; draw the line or
 * the box yourself. Hidden from assistive technology (the live region announces the drag).
 */
export function DropIndicator(props: DropIndicatorProps) {
    const engine = useTreeContext("DropIndicator").engine as TreeEngine<
        AnyTypes,
        AnyFeatures
    > | null;
    const indicator = engine?.get("drop-indicator") ?? null;
    if (!indicator) return null;
    return <DropIndicatorElement {...props} indicator={indicator} />;
}

function DropIndicatorElement(
    props: DropIndicatorProps & { indicator: Indicator },
) {
    const { indicator, ...rest } = props;
    const state: DropIndicatorState = {
        position: indicator.position,
        itemId: indicator.itemId,
        level: indicator.level,
    };
    return useRenderElement("div", rest, {
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
            insetInlineStart: indicator.inlineOffset,
            insetInlineEnd: 0,
            insetBlockStart: indicator.blockOffset,
            blockSize: indicator.blockSize,
            pointerEvents: "none",
        },
    });
}
