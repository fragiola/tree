// The flat render order of the items whose ancestors are all expanded: what the keyboard walks,
// what a range selection spans and what a virtualizer would window. Behaviour from React Complex
// Tree's linear items (controlledEnvironment/useLinearItems.ts, tree/getItemsLinearly.ts); the
// code is Fragiola's own.
import { expandedSet, itemOf } from "./structure";
import type { TreeState, VisibleItem } from "./types";

const visibleCache = new WeakMap<TreeState, readonly VisibleItem[]>();
const indexCache = new WeakMap<TreeState, ReadonlyMap<string, number>>();

/** The visible items, in render order. */
export function visibleItems(state: TreeState): readonly VisibleItem[] {
    let list = visibleCache.get(state);
    if (list === undefined) {
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
        list = Object.freeze(out);
        visibleCache.set(state, list);
    }
    return list;
}

/** Each visible item's index in {@link visibleItems}. */
export function visibleIndex(state: TreeState): ReadonlyMap<string, number> {
    let index = indexCache.get(state);
    if (index === undefined) {
        index = new Map(
            visibleItems(state).map((item, i) => [item.itemId, i] as const),
        );
        indexCache.set(state, index);
    }
    return index;
}
