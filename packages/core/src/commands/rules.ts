// The tree's rules, shared by the commands: the permission flags, the lookups that fail with
// `not_found`, the move rules and what keeps the state consistent after items leave or hide.
import type { Draft } from "../state/draft";
import {
    childIdsOf,
    documentOrder,
    holdsChildren,
    isDescendantOf,
    nearestVisible,
} from "../state/structure";
import type { TreeItem, TreeSettings } from "../state/types";
import { visibleItems } from "../state/visible-items";
import { type Failure, fail } from "./define";

/** An item's flags, its own or the tree's defaults. */
export interface ResolvedFlags {
    readonly disabled: boolean;
    readonly movable: boolean;
    readonly renamable: boolean;
    readonly droppable: boolean;
}

export function resolveFlags(
    settings: TreeSettings,
    item: TreeItem,
): ResolvedFlags {
    return {
        disabled: item.disabled ?? false,
        movable: item.movable ?? settings.movable,
        renamable: item.renamable ?? settings.renamable,
        droppable: item.droppable ?? settings.droppable,
    };
}

export function isFailure(value: unknown): value is Failure {
    return (
        typeof value === "object" &&
        value !== null &&
        (value as { ok?: unknown }).ok === false
    );
}

/** The item `id` names, or `not_found` at `path`. */
export function requireItem(
    draft: Draft,
    id: string,
    path = "/itemId",
): TreeItem | Failure {
    return draft.item(id) ?? fail("not_found", `"${id}" is not an item`, path);
}

/** An item that is not disabled, or why not (`not_found`, `refused`). */
export function requireEnabled(
    draft: Draft,
    id: string,
    action: string,
    path = "/itemId",
): TreeItem | Failure {
    const item = requireItem(draft, id, path);
    if (isFailure(item)) return item;
    if (resolveFlags(draft.settings, item).disabled) {
        return fail(
            "refused",
            `"${id}" is disabled: it cannot ${action}`,
            path,
        );
    }
    return item;
}

/** The parent `to.parentItemId` names (`null`: the root), if it can take children now. */
export function requireTarget(
    draft: Draft,
    parentItemId: string | null,
    path = "/to/parentItemId",
): TreeItem | null | Failure {
    if (parentItemId === null) return null;
    const parent = requireItem(draft, parentItemId, path);
    if (isFailure(parent)) return parent;
    if (!holdsChildren(parent)) {
        return fail(
            "refused",
            parent.childrenStatus !== undefined
                ? `"${parentItemId}"'s children are ${parent.childrenStatus}: load them first`
                : `"${parentItemId}" is a leaf: it holds no children`,
            path,
        );
    }
    return parent;
}

/** The items in document order, each once, with the ones inside another listed one left out. */
export function outermost(draft: Draft, itemIds: readonly string[]): string[] {
    const order = documentOrder(draft.state);
    const unique = [...new Set(itemIds)].sort(
        (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
    );
    return unique.filter(
        (id) =>
            !unique.some(
                (other) =>
                    other !== id && isDescendantOf(draft.state, id, other),
            ),
    );
}

/**
 * Why moving `itemIds` into `parentItemId` is refused, or undefined: a missing item, a disabled
 * or not movable item, a target that is not a loaded parent, not droppable or disabled, or a move
 * into the item itself or one of its descendants.
 */
export function checkMove(
    draft: Draft,
    itemIds: readonly string[],
    parentItemId: string | null,
): Failure | undefined {
    for (const [i, id] of itemIds.entries()) {
        const item = requireItem(draft, id, `/itemIds/${i}`);
        if (isFailure(item)) return item;
        const flags = resolveFlags(draft.settings, item);
        if (flags.disabled) {
            return fail(
                "refused",
                `"${id}" is disabled: it cannot move`,
                `/itemIds/${i}`,
            );
        }
        if (!flags.movable) {
            return fail("refused", `"${id}" is not movable`, `/itemIds/${i}`);
        }
    }
    const target = requireTarget(draft, parentItemId);
    if (isFailure(target)) return target;
    if (target !== null) {
        const flags = resolveFlags(draft.settings, target);
        if (flags.disabled) {
            return fail(
                "refused",
                `"${target.id}" is disabled: nothing can be dropped into it`,
                "/to/parentItemId",
            );
        }
        if (!flags.droppable) {
            return fail(
                "refused",
                `"${target.id}" does not accept drops`,
                "/to/parentItemId",
            );
        }
        for (const id of itemIds) {
            if (
                id === target.id ||
                isDescendantOf(draft.state, target.id, id)
            ) {
                return fail(
                    "refused",
                    `"${id}" cannot move into itself or one of its descendants`,
                    "/to/parentItemId",
                );
            }
        }
    }
    return undefined;
}

/**
 * Inserts `itemIds` (already detached) into a parent's children before `before` (an id still in
 * the list), or at the end.
 */
export function insertChildren(
    draft: Draft,
    parentItemId: string | null,
    itemIds: readonly string[],
    before: string | undefined,
): void {
    const children = [...childIdsOf(draft.state, parentItemId)];
    const at = before === undefined ? -1 : children.indexOf(before);
    children.splice(at < 0 ? children.length : at, 0, ...itemIds);
    draft.setChildIds(parentItemId, children);
}

/** Takes an item out of its parent's children (the item itself stays). */
export function detach(
    draft: Draft,
    parentItemId: string | null,
    itemId: string,
): void {
    draft.setChildIds(
        parentItemId,
        childIdsOf(draft.state, parentItemId).filter((id) => id !== itemId),
    );
}

/**
 * After items left the tree: every list forgets them, and the focus (when it was one of them)
 * moves to the visible item now at the focused item's place (`visibleAt`), else the last one.
 */
export function forgetItems(
    draft: Draft,
    removed: ReadonlySet<string>,
    visibleAt: number | undefined,
): void {
    if (removed.size === 0) return;
    const keep = (ids: readonly string[]) => {
        const kept = ids.filter((id) => !removed.has(id));
        return kept.length === ids.length ? ids : kept;
    };
    draft.set("expandedItemIds", keep(draft.state.expandedItemIds));
    draft.set("selectedItemIds", keep(draft.state.selectedItemIds));
    draft.set("checkedItemIds", keep(draft.state.checkedItemIds));
    const { selectionAnchorItemId, focusedItemId, renamingItemId } =
        draft.state;
    if (selectionAnchorItemId !== null && removed.has(selectionAnchorItemId)) {
        draft.set("selectionAnchorItemId", null);
    }
    if (renamingItemId !== null && removed.has(renamingItemId)) {
        draft.set("renamingItemId", null);
    }
    if (focusedItemId !== null && removed.has(focusedItemId)) {
        const visible = visibleItems(draft.state);
        const next =
            visible[Math.min(visibleAt ?? visible.length, visible.length - 1)];
        draft.set("focusedItemId", next?.itemId ?? null);
    }
}

/** The focus, when its item is now hidden (a collapse, a move), moves to its nearest visible ancestor. */
export function settleFocus(draft: Draft): void {
    const focused = draft.state.focusedItemId;
    if (focused === null) return;
    const visible = nearestVisible(draft.state, focused) ?? null;
    if (visible !== focused) draft.set("focusedItemId", visible);
}

/** Every item of a subtree (the item itself first, then its descendants). */
export function subtreeOf(draft: Draft, itemId: string): string[] {
    const out: string[] = [];
    const visit = (id: string) => {
        out.push(id);
        for (const child of draft.item(id)?.childItemIds ?? []) visit(child);
    };
    visit(itemId);
    return out;
}
