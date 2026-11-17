// The core's controlled root props: the expanded items, described as a feature
// describes its own (`TreeRootProp`), so an adapter maps every controlled list the same way.
import type { RunOptions } from "../commands/types";
import type { FeatureModel, TreeRootProp } from "./types";

type Entry = { command: string; payload: Record<string, unknown> };

/**
 * Runs `entries` as one batch; when the batch is refused (an id the tree does not have, a disabled
 * item), runs each one the model accepts on its own.
 */
function runAll(
    model: FeatureModel,
    entries: Entry[],
    options: RunOptions,
): void {
    if (entries.length === 0) return;
    if (model.run("batch", { commands: entries }, options).ok) return;
    for (const { command, payload } of entries) {
        model.run(command as "item.expand", payload, options);
    }
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((id) => set.has(id));
}

/**
 * The controlled list every tree has: `expandedItemIds`, with its change callback. A feature's are in `model.get("features")` (`rootProps`).
 */
export const TREE_ROOT_PROPS: readonly TreeRootProp[] = Object.freeze([
    {
        prop: "expandedItemIds",
        changeProp: "onExpandedItemIdsChange",
        read: (state) => state.expandedItemIds,
        sync: (model, itemIds, options) => {
            const now = model.state.expandedItemIds;
            if (sameSet(itemIds, now)) return;
            const wanted = new Set(itemIds);
            const current = new Set(now);
            runAll(
                model,
                [
                    ...now
                        .filter((itemId) => !wanted.has(itemId))
                        .map((itemId) => ({
                            command: "item.collapse",
                            payload: { itemId },
                        })),
                    ...itemIds
                        .filter((itemId) => !current.has(itemId))
                        .map((itemId) => ({
                            command: "item.expand",
                            payload: { itemId },
                        })),
                ],
                options,
            );
        },
    },
] satisfies TreeRootProp[]);
