// Ported from React Complex Tree (https://github.com/lukasbach/react-complex-tree), v2.6.4,
// packages/core/src/drag/DraggingPositionEvaluation.ts and useDraggingPosition.ts (the hovering
// offset) and useGetParentOfLinearItem.ts. Copyright (c) 2023 Lukas Bach. MIT licence, see LICENSE.
//
// Where a drop lands, from the hovered visible item, the part of its row the pointer is in, and
// the pointer's inline offset (its level at the end of a sublist). Pure: it reads the visible items
// and the structure it is given, and decides nothing about permissions (the engine asks
// `model.can("item.move", …)` for the target this returns).
import type { VisibleItem } from "../state/types";

/** Where a drop lands relative to the item it names. */
export type DropPosition = "before" | "after" | "inside";

/**
 * A drop target: the `item.move` it would run (`parentItemId`, `index`), and how it reads on
 * screen (`position` relative to `itemId`, the `level` the dropped items take, 1 for the root).
 */
export interface DropTarget {
    readonly parentItemId: string | null;
    readonly index: number;
    readonly position: DropPosition;
    /** the item the position is relative to; `null` for a drop into an empty tree */
    readonly itemId: string | null;
    readonly level: number;
}

/** What the evaluation reads of the tree. */
export interface DropContext {
    /** the visible items, in render order */
    readonly visible: readonly VisibleItem[];
    /** a parent's children (`null`: the root items) */
    childIdsOf(parentItemId: string | null): readonly string[];
    /** whether an item takes children now: a drop inside it is possible */
    holdsChildren(itemId: string): boolean;
    /** the items being dragged */
    readonly draggingItemIds: readonly string[];
}

/** The pointer over a row: which one, which part of it, how far in. */
export interface HoverPosition {
    /** the hovered visible item's index */
    readonly index: number;
    /** `top` or `bottom` for a line between rows; undefined for the middle (inside) */
    readonly offset: "top" | "bottom" | undefined;
    /** the pointer's depth from its inline offset (0 for the root's), when known */
    readonly indentation: number | undefined;
}

/** The part of a row the pointer is in: thirds for a row that takes drops inside, halves otherwise. */
export function hoverOffset(
    fraction: number,
    takesInside: boolean,
    isLast: boolean,
): "top" | "bottom" | undefined {
    const threshold = takesInside ? 1 / 3 : 0.5;
    // the lower half of the last row is always "after": there is nothing below it to drop before
    if (isLast && fraction >= 0.5) return "bottom";
    if (fraction < threshold) return "top";
    if (fraction > 1 - threshold) return "bottom";
    return takesInside ? undefined : fraction < 0.5 ? "top" : "bottom";
}

interface LinearParent {
    readonly parentLinearIndex: number;
    /** `null`: the root */
    readonly itemId: string | null;
    readonly depth: number;
}

const depthOf = (item: VisibleItem) => item.level - 1;

/** The parent of the visible item at `index`, walking back to the first row one level up. */
function parentOfLinear(
    visible: readonly VisibleItem[],
    index: number,
): LinearParent {
    const item = visible[index];
    if (!item) return { parentLinearIndex: 0, itemId: null, depth: -1 };
    const depth = depthOf(item);
    let at = index;
    while (visible[at] && depthOf(visible[at] as VisibleItem) !== depth - 1) {
        at -= 1;
    }
    const parent = visible[at];
    return parent
        ? { parentLinearIndex: at, itemId: parent.itemId, depth: depth - 1 }
        : { parentLinearIndex: 0, itemId: null, depth: -1 };
}

/** Whether any ancestor of the visible item at `index` is being dragged. */
function hasDraggedAncestor(
    visible: readonly VisibleItem[],
    index: number,
    dragging: ReadonlySet<string>,
): boolean {
    const parent = parentOfLinear(visible, index);
    if (parent.itemId === null) return false;
    if (dragging.has(parent.itemId)) return true;
    return hasDraggedAncestor(visible, parent.parentLinearIndex, dragging);
}

/**
 * The drop target of a hover: a target, `"invalid"` (the hover is over the dragged items or
 * inside them, or inside an item that takes no children), or undefined (no drag, or outside the
 * rows).
 */
export function evaluateDrop(
    context: DropContext,
    hover: HoverPosition,
): DropTarget | "invalid" | undefined {
    const { visible } = context;
    if (visible.length === 0) {
        return {
            parentItemId: null,
            index: 0,
            position: "inside",
            itemId: null,
            level: 1,
        };
    }
    if (
        context.draggingItemIds.length === 0 ||
        hover.index < 0 ||
        hover.index >= visible.length
    ) {
        return undefined;
    }
    const dragging = new Set(context.draggingItemIds);
    let linearIndex = hover.index;
    let offset = hover.offset;
    const { indentation } = hover;
    let target = visible[linearIndex] as VisibleItem;

    // Don't drop at the bottom of an open folder: it would land visually elsewhere. Redirect to
    // the top of its contents.
    const next = visible[linearIndex + 1];
    if (next && depthOf(target) === depthOf(next) - 1 && offset === "bottom") {
        target = next;
        linearIndex += 1;
        offset = "top";
    }

    // Inside a folder, only drop at the bottom offset, to be visually consistent; also for items
    // below open subtrees, so the inline offset decides the level there (when it is known).
    const prior = visible[linearIndex - 1];
    if (prior && offset === "top") {
        const distance = depthOf(prior) - depthOf(target);
        if (distance === 0 || (distance > 0 && indentation !== undefined)) {
            offset = "bottom";
            linearIndex -= 1;
            target = prior;
        }
    }

    // The last item of a group, dropped below: the inline offset may reparent upwards.
    if (indentation !== undefined && offset === "bottom") {
        const deepest = depthOf(target);
        const below = visible[linearIndex + 1];
        const legalDepthCount = deepest - (below ? depthOf(below) : 0);
        if (legalDepthCount > 0 && indentation !== deepest) {
            const droppingIndent = Math.max(
                deepest - legalDepthCount,
                indentation,
            );
            let parent: LinearParent = {
                parentLinearIndex: linearIndex,
                itemId: target.itemId,
                depth: deepest,
            };
            let above: LinearParent | undefined;
            for (let depth = deepest; depth >= droppingIndent; depth -= 1) {
                above = parent;
                parent = parentOfLinear(visible, parent.parentLinearIndex);
            }
            if (
                above &&
                above.itemId !== null &&
                !(
                    parent.itemId !== null &&
                    hasDraggedAncestor(
                        visible,
                        parent.parentLinearIndex + 1,
                        dragging,
                    )
                ) &&
                !(parent.itemId !== null && dragging.has(parent.itemId))
            ) {
                return {
                    parentItemId: parent.itemId,
                    index:
                        context
                            .childIdsOf(parent.itemId)
                            .indexOf(above.itemId) + 1,
                    position: "after",
                    itemId: above.itemId,
                    level: droppingIndent + 1,
                };
            }
        }
    }

    if (hasDraggedAncestor(visible, linearIndex, dragging)) return "invalid";
    if (dragging.has(target.itemId)) return "invalid";
    if (offset === undefined && !context.holdsChildren(target.itemId)) {
        return "invalid";
    }

    if (offset === undefined) {
        return {
            parentItemId: target.itemId,
            index: context.childIdsOf(target.itemId).length,
            position: "inside",
            itemId: target.itemId,
            level: depthOf(target) + 2,
        };
    }
    const parent = parentOfLinear(visible, linearIndex);
    const childIndex =
        context.childIdsOf(parent.itemId).indexOf(target.itemId) +
        (offset === "top" ? 0 : 1);
    return {
        parentItemId: parent.itemId,
        index: childIndex,
        position: offset === "top" ? "before" : "after",
        itemId: target.itemId,
        level: depthOf(target) + 1,
    };
}

/**
 * Every position a keyboard drag can stop at, in render order: before an item (unless the item
 * above is its sibling: that one's "after" is the same place), inside a parent that takes
 * children, after an item (unless it is an open folder: its first child's "before" is the same
 * place). The dragged items' descendants are skipped. Ported from React Complex Tree's
 * useGetViableDragPositions.ts.
 */
export function viablePositions(context: DropContext): DropTarget[] {
    const { visible } = context;
    const dragging = new Set(context.draggingItemIds);
    const targets: DropTarget[] = [];
    let skipBelowDepth = -1;
    for (const [linearIndex, item] of visible.entries()) {
        const depth = depthOf(item);
        if (skipBelowDepth !== -1 && depth > skipBelowDepth) continue;
        skipBelowDepth = -1;
        if (hasDraggedAncestor(visible, linearIndex, dragging)) {
            skipBelowDepth = depth;
            continue;
        }
        const parent = parentOfLinear(visible, linearIndex);
        const childIndex = context
            .childIdsOf(parent.itemId)
            .indexOf(item.itemId);
        const above = visible[linearIndex - 1];
        const below = visible[linearIndex + 1];
        const withinFolder = above !== undefined && depthOf(above) === depth;
        // (deviation: a dragged open folder's children are skipped, so its "after" is a place of its own)
        const belowOpenFolder =
            below !== undefined &&
            depth === depthOf(below) - 1 &&
            !dragging.has(item.itemId);
        if (!withinFolder) {
            targets.push({
                parentItemId: parent.itemId,
                index: childIndex,
                position: "before",
                itemId: item.itemId,
                level: depth + 1,
            });
        }
        if (context.holdsChildren(item.itemId) && !dragging.has(item.itemId)) {
            targets.push({
                parentItemId: item.itemId,
                index: context.childIdsOf(item.itemId).length,
                position: "inside",
                itemId: item.itemId,
                level: depth + 2,
            });
        }
        if (!belowOpenFolder) {
            targets.push({
                parentItemId: parent.itemId,
                index: childIndex + 1,
                position: "after",
                itemId: item.itemId,
                level: depth + 1,
            });
        }
        // (deviation: the end of each enclosing sublist is a place too, as the pointer's inline
        // offset reaches it; the shallowest is the next item's "before", or the tree's end)
        const stop = below === undefined ? 0 : depthOf(below) + 1;
        let ancestor = parent;
        while (ancestor.itemId !== null && ancestor.depth >= stop) {
            const outer = parentOfLinear(visible, ancestor.parentLinearIndex);
            targets.push({
                parentItemId: outer.itemId,
                index:
                    context.childIdsOf(outer.itemId).indexOf(ancestor.itemId) +
                    1,
                position: "after",
                itemId: ancestor.itemId,
                level: ancestor.depth + 1,
            });
            ancestor = outer;
        }
    }
    return targets;
}
