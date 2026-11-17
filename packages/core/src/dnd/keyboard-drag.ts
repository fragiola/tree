// The keyboard drag (React Complex Tree's programmatic drag): the same drag as the pointer's, over
// the positions a drop can stop at (`viablePositions`, filtered by `model.can`). Down and Up move
// the target, Enter drops (one `item.move`), Escape cancels with nothing committed. A position is
// asked of `model.can` when the drag reaches it, not all of them at the start: a tree of 100 000
// items has thousands, and each answer runs the move on a draft. In a drag group the positions go
// on through the group's trees in document order (each tree's listed when the drag reaches it), so
// Down past the last position of one tree reaches the first of the next; the keys stay the source
// tree's, and a drop in another tree lands as transfer.ts says.
import type { EngineHost } from "../engine/host";
import { GroupDrag, treeOf } from "./drag-group";
import {
    type DropContext,
    type DropTarget,
    evaluateDrop,
    viablePositions,
} from "./drop-evaluation";
import { dropContext, lastVisibleOf } from "./drop-target";
import { type DragModifiers, NO_MODIFIERS } from "./transfer";

/** One tree's positions: listed when the drag reaches the tree, each asked once. */
interface Segment {
    readonly host: EngineHost;
    targets: DropTarget[] | undefined;
    readonly valid: Map<number, boolean>;
}

export class KeyboardDrag {
    private segments: Segment[] = [];
    /** the source tree's segment */
    private home = 0;
    /** where the drag started in it */
    private startAt = 0;
    private segment = 0;
    private at = 0;
    private itemIds: readonly string[] = [];
    private drag: GroupDrag | undefined;

    constructor(private readonly host: EngineHost) {}

    get active(): boolean {
        const drag = this.host.drag();
        return drag?.mode === "keyboard" && drag.origin === undefined;
    }

    /** A tree's positions (none once it is gone). */
    private targetsOf(segment: Segment): DropTarget[] {
        const { host } = segment;
        if (host.isDestroyed() || !host.root() || !this.drag) return [];
        if (segment.targets === undefined) {
            const context = dropContext(
                host,
                this.drag.landing(host).excludedItemIds,
            );
            segment.targets =
                context.visible.length === 0
                    ? // an empty tree takes a drop at its start
                      [
                          evaluateDrop(context, {
                              index: 0,
                              offset: undefined,
                              indentation: undefined,
                          }) as DropTarget,
                      ]
                    : viablePositions(context);
        }
        return segment.targets;
    }

    /** Whether the tree's model takes a drop at its position `i` (asked once). */
    private accepts(segment: Segment, i: number): boolean {
        let answer = segment.valid.get(i);
        if (answer === undefined) {
            const target = this.targetsOf(segment)[i];
            answer =
                target !== undefined &&
                (this.drag?.landing(segment.host).accepts(target) ?? false);
            segment.valid.set(i, answer);
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
        this.itemIds = [...itemIds];
        const drag = new GroupDrag(
            this.host,
            this.itemIds,
            "keyboard",
            () => {
                // the tree of the target left: back to where the drag started
                if (this.drag !== drag) return;
                this.segment = this.home;
                this.at = this.startAt;
                this.show("drag-over");
            },
            () => this.cancel(),
        );
        this.drag = drag;
        const trees = drag.trees();
        this.segments = trees.map((host) => ({
            host,
            targets: undefined,
            valid: new Map(),
        }));
        this.home = Math.max(0, trees.indexOf(this.host));
        if (!trees.includes(this.host))
            this.segments = [
                { host: this.host, targets: undefined, valid: new Map() },
            ];
        const home = this.segments[this.home] as Segment;
        const context = dropContext(this.host, this.itemIds);
        const at = nearestStart(
            this.targetsOf(home),
            context,
            (itemId) => model.get("item-parent-by", { itemId }),
            (i) => this.accepts(home, i),
        );
        if (at < 0) {
            this.reset();
            return false;
        }
        this.segment = this.home;
        this.at = at;
        this.startAt = at;
        drag.begin(this.current());
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

    /** The tree of the target. */
    private currentHost(): EngineHost {
        return this.segments[this.segment]?.host ?? this.host;
    }

    private current(): DropTarget | null {
        const segment = this.segments[this.segment];
        return (segment && this.targetsOf(segment)[this.at]) ?? null;
    }

    /** A virtualized tree scrolls the target's row (where its line or box is) into view. */
    private reveal(): void {
        const target = this.current();
        if (!target?.itemId) return;
        const host = this.currentHost();
        host.reveal(
            target.position === "after"
                ? lastVisibleOf(host, target.itemId)
                : target.itemId,
        );
    }

    /** Shows the current target in its tree, scrolls to it and announces it. */
    private show(type: "drag-over"): void {
        const host = this.currentHost();
        const target = this.current();
        this.drag?.show(host, target);
        this.reveal();
        this.host.announce({
            type,
            itemIds: this.itemIds,
            target,
            ...treeOf(this.host, host, target),
        });
    }

    /**
     * Moves the target to the next (1) or previous (-1) position, on into the next or previous tree
     * of the group, stopping at the ends.
     */
    step(by: 1 | -1): void {
        if (!this.active) return;
        // the next valid position that way, if any: the ends stop the target
        let segment = this.segment;
        let next = this.at + by;
        for (;;) {
            const current = this.segments[segment];
            if (!current) return;
            const count = this.targetsOf(current).length;
            if (next < 0 || next >= count) {
                segment += by;
                const following = this.segments[segment];
                if (!following) return;
                next = by > 0 ? 0 : this.targetsOf(following).length - 1;
                continue;
            }
            if (this.accepts(current, next)) break;
            next += by;
        }
        this.segment = segment;
        this.at = next;
        this.show("drag-over");
    }

    /** Drops at the current target: one `item.move`, or a transfer to a tree of another model. */
    drop(modifiers: DragModifiers = NO_MODIFIERS): void {
        if (!this.active) return;
        const target = this.current();
        const host = this.currentHost();
        const itemIds = this.itemIds;
        const landing = this.drag?.landing(host);
        this.end();
        if (!target) return;
        if (!landing || host.isDestroyed()) {
            this.host.announce({ type: "drag-cancel", itemIds });
            return;
        }
        const dropped = landing.drop(target, modifiers, "keyboard-drag");
        this.host.announce(
            dropped
                ? {
                      type: "drop",
                      itemIds,
                      target,
                      ...treeOf(this.host, host, target),
                  }
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
        const active = this.active;
        this.drag?.end();
        this.reset();
        if (active) this.host.setDrag(null);
    }

    private reset(): void {
        this.segments = [];
        this.home = 0;
        this.segment = 0;
        this.at = 0;
        this.startAt = 0;
        this.itemIds = [];
        this.drag = undefined;
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
