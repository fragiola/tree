// The keyboard drag (React Complex Tree's programmatic drag): the same drag as the pointer's, over
// the positions a drop can stop at (`viablePositions`, filtered by `model.can`). Down and Up move
// the target, Enter drops (one `item.move`), Escape cancels with nothing committed.
import type { EngineHost } from "../engine/host";
import { type DropTarget, viablePositions } from "./drop-evaluation";
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
        const targets = viablePositions(dropContext(this.host, itemIds)).filter(
            (target) => accepts(this.host, itemIds, target),
        );
        if (targets.length === 0) return false;
        this.itemIds = [...itemIds];
        this.targets = targets;
        // start where the first dragged item is
        const first = itemIds[0];
        const here = targets.findIndex(
            (target) => target.itemId === first && target.position === "before",
        );
        this.at = here >= 0 ? here : 0;
        this.host.setDrag({
            mode: "keyboard",
            itemIds: this.itemIds,
            target: this.current(),
        });
        this.host.announce({
            type: "drag-start",
            itemIds: this.itemIds,
            keyboard: true,
        });
        this.host.announce({
            type: "drag-over",
            itemIds: this.itemIds,
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
