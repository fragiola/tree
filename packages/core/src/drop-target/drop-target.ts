// From the screen to a drop target and back: the row under the pointer (hit-testing the registered
// rows' rects), the target it gives (drop-evaluation.ts) once the tree's model accepts it
// (`model.can("item.move", …)`, or a transfer's: transfer.ts), and where the indicator of a target
// goes.

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
import { visibleIndex } from "../state/visible-items";
import {
    type DropContext,
    type DropTarget,
    evaluateDrop,
    hoverOffset,
} from "./drop-evaluation";
import type { DragHost } from "./host";
import { type DragModifiers, type Landing, NO_MODIFIERS } from "./host";

/** What the drop evaluation reads of the model, for a drag of `itemIds`. */
export function dropContext(
    host: DragHost,
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

/** The visible row under a point: its index and how far down it the point is (0 to 1). */
export function rowAt(
    host: DragHost,
    visible: readonly VisibleItem[],
    y: number,
): { index: number; fraction: number } | undefined {
    let last: { index: number; rect: Rect } | undefined;
    // a virtualized tree hit-tests the rows it renders around the view
    const rows = host.renderedRows();
    const end = Math.min(rows?.end ?? visible.length, visible.length);
    for (let index = rows?.start ?? 0; index < end; index++) {
        const entry = visible[index] as VisibleItem;
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

/** Whether a point is over a tree's root (`inView`: over the part its scroll container shows). */
export function overRoot(
    host: DragHost,
    x: number,
    y: number,
    inView = false,
): boolean {
    const root = host.root();
    if (root === undefined || !containsPoint(rectOf(root), x, y)) return false;
    if (!inView) return true;
    // a root inside a scroll container shows only the part of it in the container's view
    const container = host.scrollContainer();
    return (
        container === undefined ||
        container === root ||
        !container.contains(root) ||
        containsPoint(rectOf(container), x, y)
    );
}

/**
 * The drop target at a point of a tree, for a drag landing there as `landing` says: null outside
 * the root, over the dragged items, or where the model refuses the drop (a middleware veto, a
 * non-droppable parent, …).
 */
export function targetAt(
    host: DragHost,
    landing: Landing,
    x: number,
    y: number,
    modifiers: DragModifiers = NO_MODIFIERS,
): DropTarget | null {
    const root = host.root();
    if (!root) return null;
    const rootRect = rectOf(root);
    if (!containsPoint(rootRect, x, y)) return null;
    const accepts = (target: DropTarget) => landing.accepts(target, modifiers);
    const context = dropContext(host, landing.excludedItemIds);
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
            accepts({
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
    return accepts(evaluated) ? evaluated : null;
}

/** The last visible row of an item's subtree (itself when it shows no children). */
export function lastVisibleOf(host: DragHost, itemId: string): string {
    const visible = host.model.get("visible-items");
    const start = visibleIndex(host.model.state).get(itemId) ?? -1;
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
    host: DragHost,
    target: DropTarget,
): DropIndicator | null {
    const root = host.root();
    if (!root) return null;
    const rootRect = rectOf(root);
    const inline =
        (target.level - 1) * host.options.indentation +
        (target.position === "inside" ? 0 : host.options.indicatorInset);
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
            ? lastVisibleOf(host, target.itemId)
            : target.itemId;
    const content = host.contentOf(rowId);
    const box = content
        ? boxOf(root, rootRect, rectOf(content))
        : host.unrenderedRowBox(rowId);
    if (!box) return null;
    const { top, height } = box;
    return {
        position: target.position,
        itemId: target.itemId,
        level: target.level,
        blockOffset: target.position === "after" ? top + height : top,
        blockSize: target.position === "inside" ? height : 0,
        inlineOffset: inline,
    };
}

/** A rendered row's box, relative to the root (its scroll included). */
function boxOf(
    root: HTMLElement,
    rootRect: Rect,
    rect: Rect,
): { top: number; height: number } {
    return {
        top: rect.top - rootRect.top + root.scrollTop,
        height: rect.height,
    };
}
