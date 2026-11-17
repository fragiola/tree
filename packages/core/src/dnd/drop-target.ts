// From the screen to a drop target and back: the row under the pointer (hit-testing the registered
// rows' rects), the target it gives (drop-evaluation.ts) once `model.can("item.move", …)` accepts
// it, and where the indicator of a target goes.
import type { EngineHost } from "../engine/host";
import type { DropIndicator } from "../engine/verbs";
import {
    bottomOf,
    containsPoint,
    inlineOffset,
    type Rect,
    rectOf,
} from "../geometry/rect";
import { holdsChildren } from "../state/structure";
import type { VisibleItem } from "../state/types";
import {
    type DropContext,
    type DropTarget,
    evaluateDrop,
    hoverOffset,
} from "./drop-evaluation";

/** What the drop evaluation reads of the model, for a drag of `itemIds`. */
export function dropContext(
    host: EngineHost,
    itemIds: readonly string[],
): DropContext {
    const { model } = host;
    return {
        visible: model.get("visible-items"),
        childIdsOf: (parentItemId) =>
            parentItemId === null
                ? model.state.rootItemIds
                : (model.get("item-by", { id: parentItemId })?.childItemIds ??
                  []),
        holdsChildren: (itemId) => {
            const item = model.get("item-by", { id: itemId });
            return item !== undefined && holdsChildren(item);
        },
        draggingItemIds: itemIds,
    };
}

/** Whether the model accepts moving `itemIds` to `target`. */
export function accepts(
    host: EngineHost,
    itemIds: readonly string[],
    target: DropTarget,
): boolean {
    return host.model.can("item.move", {
        itemIds: [...itemIds],
        to: { parentItemId: target.parentItemId, index: target.index },
    });
}

/** The visible row under a point: its index and how far down it the point is (0 to 1). */
export function rowAt(
    host: EngineHost,
    visible: readonly VisibleItem[],
    y: number,
): { index: number; fraction: number } | undefined {
    let last: { index: number; rect: Rect } | undefined;
    for (const [index, entry] of visible.entries()) {
        const content = host.contentOf(entry.itemId);
        if (!content) continue;
        const rect = rectOf(content);
        if (y < bottomOf(rect)) {
            const fraction =
                rect.height > 0 ? (y - rect.top) / rect.height : 0.5;
            return { index, fraction: Math.max(0, fraction) };
        }
        last = { index, rect };
    }
    // below the last row: its bottom
    return last && { index: last.index, fraction: 1 };
}

/**
 * The drop target at a point, for a drag of `itemIds`: null outside the root, over the dragged
 * items, or where the model refuses the move (a middleware veto, a non-droppable parent, …).
 */
export function targetAt(
    host: EngineHost,
    itemIds: readonly string[],
    x: number,
    y: number,
): DropTarget | null {
    const root = host.root();
    if (!root) return null;
    const rootRect = rectOf(root);
    if (!containsPoint(rootRect, x, y)) return null;
    const context = dropContext(host, itemIds);
    const { visible } = context;
    let evaluated: ReturnType<typeof evaluateDrop>;
    if (visible.length === 0) {
        evaluated = evaluateDrop(context, {
            index: 0,
            offset: undefined,
            indentation: undefined,
        });
    } else {
        const row = rowAt(host, visible, y);
        if (!row) return null;
        const hovered = visible[row.index] as VisibleItem;
        const takesInside =
            context.holdsChildren(hovered.itemId) &&
            accepts(host, itemIds, {
                parentItemId: hovered.itemId,
                index: context.childIdsOf(hovered.itemId).length,
                position: "inside",
                itemId: hovered.itemId,
                level: hovered.level + 1,
            });
        const offset = hoverOffset(
            row.fraction,
            takesInside,
            row.index === visible.length - 1,
        );
        const depth = Math.floor(
            inlineOffset(rootRect, x, host.direction()) /
                host.options.indentation,
        );
        evaluated = evaluateDrop(context, {
            index: row.index,
            offset,
            indentation: Math.max(0, depth),
        });
    }
    if (evaluated === undefined || evaluated === "invalid") return null;
    return accepts(host, itemIds, evaluated) ? evaluated : null;
}

/** The last visible row of an item's subtree (itself when it shows no children). */
function lastVisibleOf(
    visible: readonly VisibleItem[],
    itemId: string,
): string {
    const start = visible.findIndex((entry) => entry.itemId === itemId);
    const level = visible[start]?.level ?? 0;
    let last = itemId;
    for (let i = start + 1; i < visible.length; i++) {
        const entry = visible[i] as VisibleItem;
        if (entry.level <= level) break;
        last = entry.itemId;
    }
    return last;
}

/** Where the indicator of a drop target goes, relative to the root (its scroll included). */
export function indicatorOf(
    host: EngineHost,
    target: DropTarget,
): DropIndicator | null {
    const root = host.root();
    if (!root) return null;
    const rootRect = rectOf(root);
    const inline = (target.level - 1) * host.options.indentation;
    if (target.itemId === null) {
        return {
            position: target.position,
            itemId: null,
            level: target.level,
            blockOffset: 0,
            blockSize: 0,
            inlineOffset: inline,
        };
    }
    const rowId =
        target.position === "after"
            ? lastVisibleOf(host.model.get("visible-items"), target.itemId)
            : target.itemId;
    const content = host.contentOf(rowId);
    if (!content) return null;
    const rect = rectOf(content);
    const top = rect.top - rootRect.top + root.scrollTop;
    return {
        position: target.position,
        itemId: target.itemId,
        level: target.level,
        blockOffset: target.position === "after" ? top + rect.height : top,
        blockSize: target.position === "inside" ? rect.height : 0,
        inlineOffset: inline,
    };
}
