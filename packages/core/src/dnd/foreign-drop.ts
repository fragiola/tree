// Foreign drops (the engine's `foreignDrop` option, `createTreeForeignDrop`): files, links and text
// from the desktop or another window dropped on the tree. It is the one case
// ../guidelines/decisions.md#drag-and-drop allows native HTML5 drag events: receiving foreign
// content. The adapters forward the root's `dragenter`, `dragover`, `dragleave` and `drop`
// (`engine.adapter.handleDragEvent`); the target comes from the same evaluation as a tree drag
// (drop-target.ts), shows with the same state and indicator, a collapsed parent hovered long enough
// expands, and the scroll container scrolls near its edges. Only the types are readable before the
// drop, so `accept` decides from them; the data is the app's to read in `onDrop`: the package
// reads no file and makes no network call. The engine reaches this file only through the option,
// so a bundle that never imports `createTreeForeignDrop` leaves it out.
import type { EngineHost } from "../engine/host";
import { rectOf } from "../geometry/rect";
import type { TreeModel } from "../state/model";
import type { AnyTypes, TreeTypes } from "../state/types";
import type { DropTarget } from "./drop-evaluation";
import { rowAt, targetAt } from "./drop-target";
import type { Landing } from "./transfer";

/** A foreign drag over a target: what `accept` is asked. */
export interface ForeignDrag<T extends TreeTypes = AnyTypes> {
    /** the drag's `DataTransfer.types` (`"Files"`, `"text/uri-list"`, `"text/plain"`, …): its data is readable only on the drop */
    readonly types: readonly string[];
    /** the drop target (`parentItemId` and `index` are an `item.add`'s `to`) */
    readonly to: DropTarget;
    readonly model: TreeModel<T>;
}

/** A foreign drop: what `onDrop` is called with. */
export interface ForeignDrop<T extends TreeTypes = AnyTypes> {
    /** the drop's data: `files`, `getData("text/uri-list")`, `getData("text/plain")`, … */
    readonly dataTransfer: DataTransfer;
    /** the drop target (`parentItemId` and `index` are an `item.add`'s `to`) */
    readonly to: DropTarget;
    readonly model: TreeModel<T>;
}

/** Options of {@link createTreeForeignDrop}. */
export interface TreeForeignDropOptions<T extends TreeTypes = AnyTypes> {
    /**
     * whether the tree takes the drag at a target, from its types (default: every type). Asked
     * once per target and drag; a target it refuses does not show. A disabled or non-droppable
     * parent never takes a drop
     */
    accept?: ((drag: ForeignDrag<T>) => boolean) | undefined;
    /** the drop: the app reads the data and runs its commands (`item.add`, …) */
    onDrop: (drop: ForeignDrop<T>) => void;
    /** the cursor the browser shows over a target (default `"copy"`) */
    dropEffect?: "copy" | "move" | "link" | undefined;
}

/** What the engine connects a foreign drop to. */
export interface ForeignDropController {
    /** a native drag event on the root (`dragenter`, `dragover`, `dragleave`, `drop`) */
    handle(event: DragEvent): void;
    /** ends the foreign drag, if any, with nothing dropped */
    cancel(): void;
}

/** A foreign drop description: the engine's (and every root's) `foreignDrop` option. */
export interface TreeForeignDrop<T extends TreeTypes = AnyTypes> {
    readonly options: Readonly<TreeForeignDropOptions<T>>;
    /** called by the engine: this foreign drop's state for one engine */
    connect(host: EngineHost): ForeignDropController;
}

/**
 * Describes how a tree takes foreign content: files, links and text dragged from the desktop or
 * another window. The engine (or the root primitive) handles the native drag events and shows the
 * target as for a tree drag; `onDrop` reads the data and runs the app's commands.
 *
 * ```ts
 * const foreignDrop = createTreeForeignDrop({
 *     accept: ({ types }) => types.includes("Files"),
 *     onDrop: ({ dataTransfer, to: { parentItemId, index }, model }) => {
 *         for (const file of dataTransfer.files)
 *             model.run("item.add", {
 *                 item: { kind: "file", label: file.name },
 *                 to: { parentItemId, index },
 *             });
 *     },
 * });
 * const engine = createTreeEngine(model, { root, foreignDrop });
 * ```
 */
export function createTreeForeignDrop<T extends TreeTypes = AnyTypes>(
    options: TreeForeignDropOptions<T>,
): TreeForeignDrop<T> {
    const frozen = Object.freeze({ ...options });
    return Object.freeze({
        options: frozen,
        connect: (host: EngineHost) =>
            new ForeignDragSession(
                host,
                frozen as unknown as TreeForeignDropOptions,
            ),
    });
}

/** How long (ms) a foreign drag stays without a `dragover` before it is over (browsers fire one at least every 350 ms). */
const STALE = 1000;

/**
 * How long (ms) a `dragleave` with no related target (a move between children in some browsers,
 * Escape, the window left) waits for a `dragover` before it ends the drag.
 */
const LEAVE = 100;

class ForeignDragSession implements ForeignDropController {
    /** the types of the drag over the tree, while there is one */
    private types: readonly string[] | undefined;
    /** `accept`'s answers for this drag, while the model's state is `state` */
    private readonly accepted = new Map<string, boolean>();
    private state: unknown;
    private readonly landing: Landing;
    private hoveredItemId: string | undefined;
    private cancelExpand: (() => void) | undefined;
    private cancelStale: (() => void) | undefined;
    /** a `dragover` came since the stale check was scheduled */
    private seen = false;
    private cancelLeave: (() => void) | undefined;

    constructor(
        private readonly host: EngineHost,
        private readonly options: TreeForeignDropOptions,
    ) {
        this.landing = {
            excludedItemIds: [],
            accepts: (to) => this.accepts(to),
            drop: () => false,
        };
    }

    handle(event: DragEvent): void {
        const drag = this.host.drag();
        // a tree's own drag (a keyboard drag under way) takes no foreign drop, and the browser
        // does not open what is dropped either
        if (drag && drag.mode !== "foreign") {
            if (event.type !== "dragleave") refuse(event);
            return;
        }
        switch (event.type) {
            case "dragenter":
            case "dragover":
                this.over(event);
                return;
            case "dragleave":
                this.leave(event);
                return;
            case "drop":
                this.drop(event);
        }
    }

    private targetOf(event: DragEvent): DropTarget | null {
        return targetAt(this.host, this.landing, event.clientX, event.clientY);
    }

    private over(event: DragEvent): void {
        const { host } = this;
        const transfer = event.dataTransfer;
        if (!transfer || !host.root()) return;
        if (this.types === undefined) {
            this.types = Array.from(transfer.types);
            this.accepted.clear();
            this.watch();
        } else if (event.type === "dragenter") {
            // a drag that ended unseen (no dragleave, no drop) gives way to the new one
            const types = Array.from(transfer.types);
            if (types.join("\n") !== this.types.join("\n")) {
                this.types = types;
                this.accepted.clear();
            }
        }
        this.seen = true;
        this.cancelLeave?.();
        this.cancelLeave = undefined;
        const target = this.targetOf(event);
        // a cancelled dragover makes the root a drop zone: the browser never opens a file dropped
        // on it, and `none` where there is no target refuses the drop there
        event.preventDefault();
        transfer.dropEffect = target
            ? (this.options.dropEffect ?? "copy")
            : "none";
        const previous = host.drag();
        if (!previous || !sameTarget(previous.target, target)) {
            host.setDrag({ mode: "foreign", itemIds: [], target });
            host.announce({
                type: "foreign-drag-over",
                types: this.types,
                target,
            });
        }
        this.expand(event.clientY);
        this.scroll(event.clientY);
    }

    /** A `dragleave`: to another element of the root it is nothing; out of it the drag ends. */
    private leave(event: DragEvent): void {
        const root = this.host.root();
        const related = event.relatedTarget as Node | null;
        if (root && related && root.contains(related)) return;
        if (related || this.types === undefined) {
            this.cancel();
            return;
        }
        // no related target: a move between children (some browsers), Escape, or the window
        // left; the hovered folder stops expanding now, and a `dragover` soon says it goes on
        this.hoveredItemId = undefined;
        this.cancelExpand?.();
        this.cancelExpand = undefined;
        this.cancelLeave?.();
        this.cancelLeave = this.host.scheduler().setTimeout(() => {
            this.cancelLeave = undefined;
            this.cancel();
        }, LEAVE);
    }

    private drop(event: DragEvent): void {
        const transfer = event.dataTransfer;
        // the drop fired because a dragover was cancelled: the browser opens nothing
        event.preventDefault();
        if (transfer && this.types === undefined) {
            this.types = Array.from(transfer.types);
            this.accepted.clear();
        }
        const types = this.types ?? [];
        const target = transfer ? this.targetOf(event) : null;
        this.end();
        if (!transfer || !target) return;
        const { model } = this.host;
        this.options.onDrop({ dataTransfer: transfer, to: target, model });
        this.host.announce({ type: "foreign-drop", types, target });
    }

    cancel(): void {
        const types = this.types;
        const shown = this.host.drag()?.target;
        this.end();
        // the live region no longer says where the files would go
        if (types && shown)
            this.host.announce({
                type: "foreign-drag-over",
                types,
                target: null,
            });
    }

    /** Ends the foreign drag, if any. */
    private end(): void {
        this.types = undefined;
        this.cancelLeave?.();
        this.cancelLeave = undefined;
        this.hoveredItemId = undefined;
        this.cancelExpand?.();
        this.cancelExpand = undefined;
        this.cancelStale?.();
        this.cancelStale = undefined;
        if (this.host.drag()?.mode === "foreign") this.host.setDrag(null);
    }

    /** Ends a drag that left with no `dragleave` (Escape in some browsers, a lost window). */
    private watch(): void {
        this.cancelStale = this.host.scheduler().setTimeout(() => {
            if (this.seen) {
                this.seen = false;
                this.watch();
            } else this.cancel();
        }, STALE);
    }

    private accepts(to: DropTarget): boolean {
        const { model } = this.host;
        if (this.state !== model.state) {
            this.state = model.state;
            this.accepted.clear();
        }
        const key = `${to.position} ${to.index} ${to.itemId} ${to.parentItemId === null ? "" : `#${to.parentItemId}`}`;
        let accepted = this.accepted.get(key);
        if (accepted === undefined) {
            accepted =
                droppable(model, to.parentItemId) &&
                (this.options.accept?.({
                    types: this.types ?? [],
                    to,
                    model,
                }) ??
                    true);
            this.accepted.set(key, accepted);
        }
        return accepted;
    }

    /** A collapsed parent under the pointer expands after a delay (a transient `item.expand`). */
    private expand(y: number): void {
        const { host } = this;
        const { model } = host;
        const visible = model.get("visible-items");
        const row = rowAt(host, visible, y);
        const hovered = row && visible[row.index]?.itemId;
        if (hovered === this.hoveredItemId) return;
        this.hoveredItemId = hovered;
        this.cancelExpand?.();
        this.cancelExpand = undefined;
        if (
            hovered === undefined ||
            model.is("item-leaf", { itemId: hovered }) ||
            model.is("item-expanded", { itemId: hovered })
        )
            return;
        this.cancelExpand = host.scheduler().setTimeout(() => {
            this.cancelExpand = undefined;
            if (this.types === undefined || this.hoveredItemId !== hovered)
                return;
            model.run(
                "item.expand",
                { itemId: hovered },
                { transient: true, meta: { source: "drag" } },
            );
        }, host.options.autoExpandDelay);
    }

    /** Scrolls the scroll container one step while the pointer is near its top or bottom edge. */
    private scroll(y: number): void {
        const container = this.host.scrollContainer();
        if (!container) return;
        const rect = rectOf(container);
        const { threshold, speed } = this.host.options.autoScroll;
        const edge = Math.min(threshold, rect.height / 2);
        if (edge <= 0) return;
        if (y - rect.top < edge) container.scrollTop -= speed;
        else if (rect.top + rect.height - y < edge)
            container.scrollTop += speed;
    }
}

/** Refuses a native drag: the browser shows no drop and, at a drop, opens nothing. */
function refuse(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer && event.type !== "drop")
        event.dataTransfer.dropEffect = "none";
}

/** Whether a parent (`null`: the root) takes drops: enabled and droppable. */
function droppable(model: TreeModel, parentItemId: string | null): boolean {
    if (parentItemId === null) return true;
    const item = model.get("item-by", { id: parentItemId });
    return (
        item !== undefined &&
        item.disabled !== true &&
        (item.droppable ?? model.state.settings.droppable)
    );
}

const sameTarget = (a: DropTarget | null, b: DropTarget | null) =>
    a === b ||
    (a !== null &&
        b !== null &&
        a.parentItemId === b.parentItemId &&
        a.index === b.index &&
        a.position === b.position &&
        a.itemId === b.itemId);
