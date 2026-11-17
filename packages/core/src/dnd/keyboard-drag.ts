// The keyboard drag (React Complex Tree's programmatic drag): the same drag as the pointer's, over
// the positions a drop can stop at (`viablePositions`, filtered by `model.can`). Down and Up move
// the target, Enter drops (one `item.move`), Escape cancels with nothing committed. A position is
// asked of `model.can` when the drag reaches it, not all of them at the start: a tree of 100 000
// items has thousands, and each answer runs the move on a draft.
import type { EngineHost } from "../engine/host";
import {
    type DropContext,
    type DropTarget,
    viablePositions,
} from "./drop-evaluation";
import { accepts, dropContext, lastVisibleOf } from "./drop-target";

export class KeyboardDrag {
    /** the positions, valid or not yet asked */
    private targets: DropTarget[] = [];
    /** what `model.can` answered for each position asked so far */
    private readonly valid = new Map<number, boolean>();
    private at = 0;
    private itemIds: readonly string[] = [];

    constructor(private readonly host: EngineHost) {}

    get active(): boolean {
        return this.host.drag()?.mode === "keyboard";
    }

    /** The valid positions of the drag under way (what the arrows step through). */
    positions(): readonly DropTarget[] {
        return this.targets.filter((_target, i) => this.accepts(i));
    }

    /** Whether the model takes a drop at position `i` (asked once). */
    private accepts(i: number): boolean {
        let answer = this.valid.get(i);
        if (answer === undefined) {
            const target = this.targets[i];
            answer =
                target !== undefined &&
                accepts(this.host, this.itemIds, target);
            this.valid.set(i, answer);
        }
        return answer;
    }

    /** Starts a drag of `itemIds`; false (nothing starts) when one cannot move or none can land. */
    start(itemIds: readonly string[]): boolean {
        const { model } = this.host;
        if (itemIds.length === 0) return false;
        if (!itemIds.every((itemId) => model.is("item-movable", { itemId }))) {
            return false;
        }
        const context = dropContext(this.host, itemIds);
        this.itemIds = [...itemIds];
        this.targets = viablePositions(context);
        this.valid.clear();
        const at = nearestStart(
            this.targets,
            context,
            (itemId) => model.get("item-parent-by", { itemId }),
            (i) => this.accepts(i),
        );
        if (at < 0) {
            this.targets = [];
            this.valid.clear();
            this.itemIds = [];
            return false;
        }
        this.at = at;
        this.host.setDrag({
            mode: "keyboard",
            itemIds: this.itemIds,
            target: this.current(),
        });
        this.reveal();
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

    /** A virtualized tree scrolls the target's row (where its line or box is) into view. */
    private reveal(): void {
        const target = this.current();
        if (!target?.itemId) return;
        this.host.reveal(
            target.position === "after"
                ? lastVisibleOf(this.host, target.itemId)
                : target.itemId,
        );
    }

    private current(): DropTarget | null {
        return this.targets[this.at] ?? null;
    }

    /** Moves the target to the next (1) or previous (-1) position, stopping at the ends. */
    step(by: 1 | -1): void {
        if (!this.active) return;
        // the next valid position that way, if any: the ends stop the target
        let next = this.at + by;
        while (next >= 0 && next < this.targets.length && !this.accepts(next)) {
            next += by;
        }
        if (next < 0 || next >= this.targets.length) return;
        this.at = next;
        this.host.setDrag({
            mode: "keyboard",
            itemIds: this.itemIds,
            target: this.current(),
        });
        this.reveal();
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
        this.valid.clear();
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
 * when a closer position exists. -1 when no position is valid (`valid` is asked lazily, nearest
 * first).
 */
function nearestStart(
    targets: readonly DropTarget[],
    context: DropContext,
    parentOf: (itemId: string) => { readonly id: string } | undefined,
    valid: (i: number) => boolean,
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
        if (itemId === undefined) return firstValid(targets, valid);
        from = row(itemId);
    }
    const anchor = visible[from];
    if (!anchor) return firstValid(targets, valid);
    if (ownPlace) {
        const index = context
            .childIdsOf(anchor.parentItemId)
            .indexOf(anchor.itemId);
        for (const offset of [0, 1]) {
            const found = targets.findIndex(
                (target, i) =>
                    target.parentItemId === anchor.parentItemId &&
                    target.index === index + offset &&
                    target.position !== "inside" &&
                    valid(i),
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
    // nearest first, the first in render order on a tie: the first valid one of them
    const order = targets
        .map((target, i) => ({ i, d: Math.abs(gap(target) - (from + 0.5)) }))
        .sort((a, b) => a.d - b.d || a.i - b.i);
    return order.find(({ i }) => valid(i))?.i ?? -1;
}

/** The first valid position, or -1. */
function firstValid(
    targets: readonly DropTarget[],
    valid: (i: number) => boolean,
): number {
    return targets.findIndex((_target, i) => valid(i));
}
