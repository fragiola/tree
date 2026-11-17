// Reads of the tree's structure: parents, ancestors, descendants, paths, visibility. Each takes a
// state and caches what it computes on that state object (states are never mutated: a draft hands
// out a new snapshot after every change).
import type { TreeItem, TreeState } from "./types";

type AnyState = TreeState;

function cached<V>(
    cache: WeakMap<AnyState, V>,
    state: AnyState,
    compute: () => V,
): V {
    let value = cache.get(state);
    if (value === undefined) {
        value = compute();
        cache.set(state, value);
    }
    return value;
}

/** An item of a state, or undefined (own keys only: `toString` is not an item). */
export function itemOf(state: AnyState, id: string): TreeItem | undefined {
    return Object.hasOwn(state.items, id) ? state.items[id] : undefined;
}

/** A leaf has neither children nor a children status. */
export function isLeaf(item: TreeItem): boolean {
    return item.childItemIds === undefined && item.childrenStatus === undefined;
}

/** Whether an item holds children now: a parent whose children are not waiting for the loader. */
export function holdsChildren(item: TreeItem): boolean {
    return (
        item.childItemIds !== undefined &&
        (item.childrenStatus === undefined || item.childrenStatus === "loaded")
    );
}

/** The children of a parent (`null`: the root items). */
export function childIdsOf(
    state: AnyState,
    parentItemId: string | null,
): readonly string[] {
    if (parentItemId === null) return state.rootItemIds;
    return itemOf(state, parentItemId)?.childItemIds ?? [];
}

const parentCache = new WeakMap<AnyState, ReadonlyMap<string, string | null>>();

/** Every attached item's parent (`null` for a root item). */
export function parentIndex(
    state: AnyState,
): ReadonlyMap<string, string | null> {
    return cached(parentCache, state, () => {
        const parents = new Map<string, string | null>();
        const visit = (ids: readonly string[], parent: string | null) => {
            for (const id of ids) {
                if (parents.has(id)) continue;
                parents.set(id, parent);
                const children = itemOf(state, id)?.childItemIds;
                if (children) visit(children, id);
            }
        };
        visit(state.rootItemIds, null);
        return parents;
    });
}

/** An item's parent: an id, `null` for a root item, undefined for an unknown item. */
export function parentOf(
    state: AnyState,
    itemId: string,
): string | null | undefined {
    return parentIndex(state).get(itemId);
}

/** An item's ancestors, nearest first. */
export function ancestorsOf(state: AnyState, itemId: string): string[] {
    const ancestors: string[] = [];
    for (
        let parent = parentOf(state, itemId);
        typeof parent === "string";
        parent = parentOf(state, parent)
    ) {
        ancestors.push(parent);
    }
    return ancestors;
}

/** An item's descendants, in document order (itself excluded). */
export function descendantsOf(state: AnyState, itemId: string): string[] {
    const out: string[] = [];
    const visit = (ids: readonly string[]) => {
        for (const id of ids) {
            out.push(id);
            const children = itemOf(state, id)?.childItemIds;
            if (children) visit(children);
        }
    };
    visit(itemOf(state, itemId)?.childItemIds ?? []);
    return out;
}

/** Whether `itemId` is inside `ancestorItemId`'s subtree (itself excluded). */
export function isDescendantOf(
    state: AnyState,
    itemId: string,
    ancestorItemId: string,
): boolean {
    return ancestorsOf(state, itemId).includes(ancestorItemId);
}

const orderCache = new WeakMap<AnyState, ReadonlyMap<string, number>>();

/** Each attached item's index in document order (depth first, children after their parent). */
export function documentOrder(state: AnyState): ReadonlyMap<string, number> {
    return cached(orderCache, state, () => {
        const order = new Map<string, number>();
        const visit = (ids: readonly string[]) => {
            for (const id of ids) {
                if (order.has(id)) continue;
                order.set(id, order.size);
                const children = itemOf(state, id)?.childItemIds;
                if (children) visit(children);
            }
        };
        visit(state.rootItemIds);
        return order;
    });
}

const expandedCache = new WeakMap<AnyState, ReadonlySet<string>>();

/** The expanded items, as a set. */
export function expandedSet(state: AnyState): ReadonlySet<string> {
    return cached(expandedCache, state, () => new Set(state.expandedItemIds));
}

/** Whether an item is attached and all its ancestors are expanded. */
export function isVisible(state: AnyState, itemId: string): boolean {
    if (parentOf(state, itemId) === undefined) return false;
    const expanded = expandedSet(state);
    return ancestorsOf(state, itemId).every((id) => expanded.has(id));
}

/** The nearest of an item and its ancestors that is visible, or undefined. */
export function nearestVisible(
    state: AnyState,
    itemId: string,
): string | undefined {
    if (parentOf(state, itemId) === undefined) return undefined;
    // from the root down: an item is visible while every item above it is expanded
    const chain = [...ancestorsOf(state, itemId).reverse(), itemId];
    const expanded = expandedSet(state);
    let visible = chain[0];
    for (let i = 1; i < chain.length; i++) {
        if (!expanded.has(chain[i - 1] ?? "")) break;
        visible = chain[i];
    }
    return visible;
}

/** An item's path: its index among its siblings at each level, from the root (`/0/2`). */
export function pathOf(state: AnyState, itemId: string): string | undefined {
    if (parentOf(state, itemId) === undefined) return undefined;
    const segments: number[] = [];
    let id: string = itemId;
    for (;;) {
        const parent = parentOf(state, id);
        if (parent === undefined) return undefined;
        segments.push(childIdsOf(state, parent).indexOf(id));
        if (parent === null) break;
        id = parent;
    }
    return `/${segments.reverse().join("/")}`;
}
