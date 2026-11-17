// The keyboard drag (React Complex Tree's programmatic drag): the same drag as the pointer's, over
// the positions a drop can stop at (`viablePositions`, filtered by `model.can`). Down and Up move
// the target, Enter drops (one `item.move`), Escape cancels with nothing committed.
import type { EngineHost } from "../engine/host";
import {
    type DropContext,
    type DropTarget,
    viablePositions,
} from "./drop-evaluation";
import { accepts, dropContext } from "./drop-target";

export class KeyboardDrag {
    private targets: DropTarget[] = [];
    private at = 0;
    private itemIds: readonly string[] = [];

    constructor(private readonly host: EngineHost) {}

    get active(): boolean {
        return this.host.drag()?.mode === "keyboard";
    }

    /** The valid positions of the drag under way (what the arrows step through). */
    positions(): readonly DropTarget[] {
        return this.targets;
    }

    /** Starts a drag of `itemIds`; false (nothing starts) when one cannot move or none can land. */
    start(itemIds: readonly string[]): boolean {
        const { model } = this.host;
        if (itemIds.length === 0) return false;
        if (!itemIds.every((itemId) => model.is("item-movable", { itemId }))) {
            return false;
        }
        const context = dropContext(this.host, itemIds);
        const targets = viablePositions(context).filter((target) =>
            accepts(this.host, itemIds, target),
        );
        if (targets.length === 0) return false;
        this.itemIds = [...itemIds];
        this.targets = targets;
        this.at = nearestStart(targets, context, (itemId) =>
            model.get("item-parent-by", { itemId }),
        );
        this.host.setDrag({
            mode: "keyboard",
            itemIds: this.itemIds,
            target: this.current(),
        });
        // one message for the start and its first target: a second one in the same tick would
        // replace it in the live region before it is read
        this.host.announce({
            type: "drag-start",
            itemIds: this.itemIds,
            keyboard: true,
            target: this.current(),
        });
        return true;
    }

    private current(): DropTarget | null {
        return this.targets[this.at] ?? null;
    }

    /** Moves the target to the next (1) or previous (-1) position, stopping at the ends. */
    step(by: 1 | -1): void {
        if (!this.active) return;
        const next = Math.min(
            this.targets.length - 1,
            Math.max(0, this.at + by),
        );
        if (next === this.at) return;
        this.at = next;
        this.host.setDrag({
            mode: "keyboard",
            itemIds: this.itemIds,
            target: this.current(),
        });
        this.host.announce({
            type: "drag-over",
            itemIds: this.itemIds,
            target: this.current(),
        });
    }

    /** Drops at the current target: one `item.move`. */
    drop(): void {
        if (!this.active) return;
        const target = this.current();
        const itemIds = this.itemIds;
        this.end();
        if (!target) return;
        const moved = this.host.model.run(
            "item.move",
            {
                itemIds: [...itemIds],
                to: { parentItemId: target.parentItemId, index: target.index },
            },
            { meta: { source: "keyboard-drag" } },
        );
        this.host.announce(
            moved.ok
                ? { type: "drop", itemIds, target }
                : { type: "drag-cancel", itemIds },
        );
    }

    cancel(): void {
        if (!this.active) return;
        const itemIds = this.itemIds;
        this.end();
        this.host.announce({ type: "drag-cancel", itemIds });
    }

    private end(): void {
        this.targets = [];
        this.at = 0;
        this.itemIds = [];
        if (this.active) this.host.setDrag(null);
    }
}

/**
 * Where a keyboard drag starts, next to the dragged items: the first of them in render order (or,
 * when none shows, the nearest shown ancestor of the first). Its own place first (its "before", or
 * the "after" of the sibling above it, the same place), then its "after", then the valid position
 * nearest to it by visible rows (the first in render order on a tie). Never the top of the tree
 * when a closer position exists.
 */
function nearestStart(
    targets: readonly DropTarget[],
    context: DropContext,
    parentOf: (itemId: string) => { readonly id: string } | undefined,
): number {
    const { visible } = context;
    const rows = new Map(visible.map((item, index) => [item.itemId, index]));
    const row = (itemId: string | null) =>
        itemId === null ? -1 : (rows.get(itemId) ?? -1);
    // the anchor: the first dragged item on screen, or the shown ancestor of a hidden one
    let from = Math.min(
        ...context.draggingItemIds.map(row).filter((index) => index >= 0),
    );
    const ownPlace = Number.isFinite(from);
    if (!ownPlace) {
        let itemId: string | undefined = context.draggingItemIds[0];
        while (itemId !== undefined && row(itemId) < 0) {
            itemId = parentOf(itemId)?.id;
        }
        if (itemId === undefined) return 0;
        from = row(itemId);
    }
    const anchor = visible[from];
    if (!anchor) return 0;
    if (ownPlace) {
        const index = context
            .childIdsOf(anchor.parentItemId)
            .indexOf(anchor.itemId);
        for (const offset of [0, 1]) {
            const found = targets.findIndex(
                (target) =>
                    target.parentItemId === anchor.parentItemId &&
                    target.index === index + offset &&
                    target.position !== "inside",
            );
            if (found >= 0) return found;
        }
    }
    // where a position is between the rows: before an item is at its top edge, after it is below
    // its last visible descendant, inside it is in its middle; the anchor is at from + 0.5
    const gap = (target: DropTarget) => {
        const start = row(target.itemId);
        if (target.position === "before") return start;
        if (target.position === "inside") return start + 0.5;
        const level = visible[start]?.level ?? 0;
        let end = start + 1;
        while ((visible[end]?.level ?? 0) > level) end++;
        return end;
    };
    let best = 0;
    let distance = Number.POSITIVE_INFINITY;
    for (const [i, target] of targets.entries()) {
        const d = Math.abs(gap(target) - (from + 0.5));
        if (d < distance) {
            best = i;
            distance = d;
        }
    }
    return best;
}
