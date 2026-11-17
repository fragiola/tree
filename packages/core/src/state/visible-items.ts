// The flat render order of the items whose ancestors are all expanded: what the keyboard walks,
// what a range selection spans and what a virtualizer would window. Behaviour from React Complex
// Tree's linear items (controlledEnvironment/useLinearItems.ts, tree/getItemsLinearly.ts); the
// code is Fragiola's own.
import { cachedOn, expandedSet, expansionKey, itemOf } from "./structure";
import type { TreeState, VisibleItem } from "./types";

const visibleCache = new WeakMap<TreeState, readonly VisibleItem[]>();
const sharedVisible = new WeakMap<object, readonly VisibleItem[]>();
const indexCache = new WeakMap<
    readonly VisibleItem[],
    ReadonlyMap<string, number>
>();

/**
 * The visible items, in render order. The same list for every committed state with the same
 * items, root items and expanded items (a focus or a selection keeps it).
 */
export function visibleItems(state: TreeState): readonly VisibleItem[] {
    return cachedOn(
        sharedVisible,
        visibleCache,
        expansionKey(state),
        state,
        () => {
            const out: VisibleItem[] = [];
            const expanded = expandedSet(state);
            const visit = (
                ids: readonly string[],
                parentItemId: string | null,
                level: number,
            ) => {
                ids.forEach((itemId, index) => {
                    out.push(
                        Object.freeze({
                            itemId,
                            parentItemId,
                            level,
                            posinset: index + 1,
                            setsize: ids.length,
                        }),
                    );
                    const children = itemOf(state, itemId)?.childItemIds;
                    if (children && expanded.has(itemId)) {
                        visit(children, itemId, level + 1);
                    }
                });
            };
            visit(state.rootItemIds, null, 1);
            return Object.freeze(out);
        },
    );
}

/** Each visible item's index in {@link visibleItems}. */
export function visibleIndex(state: TreeState): ReadonlyMap<string, number> {
    const list = visibleItems(state);
    let index = indexCache.get(list);
    if (index === undefined) {
        index = new Map(list.map((item, i) => [item.itemId, i] as const));
        indexCache.set(list, index);
    }
    return index;
}
