// The virtualization feature: `virtualization(options)` renders only the visible items in view, so a
// tree of hundreds of thousands of visible items scrolls, navigates and drags like a small one. It
// adds nothing to the model: each engine on the model gets its own virtualizer.
import type { FeatureEngine, TreeFeature } from "../features/types";
import { connectVirtualizer, type TreeVirtualizerOptions } from "./virtualizer";

/** The virtualization feature, as `features` holds it. */
export type VirtualizationFeature = TreeFeature<"virtualization">;

/**
 * The virtualization feature: the engine keeps the window of the visible items in view
 * (`engine.get("virtual-window")`, what `Tree.VirtualItems` renders), scrolls to an item before
 * focusing it, and drags over the rows on screen.
 *
 * ```ts
 * import { virtualization } from "@fragiola/tree/virtualization";
 * const model = createTreeModel(json, { features: [virtualization({ rowSize: 28 })] });
 * ```
 */
export function virtualization(
    options: TreeVirtualizerOptions = {},
): VirtualizationFeature {
    const frozen = Object.freeze({ ...options });
    return Object.freeze({
        name: "virtualization",
        engine: (host): FeatureEngine => {
            const viewport = connectVirtualizer(host, frozen);
            return {
                viewport,
                get: { "virtual-window": () => viewport.currentWindow() },
                destroy: () => viewport.destroy(),
            };
        },
    } satisfies VirtualizationFeature);
}
