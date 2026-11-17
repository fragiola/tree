// What the drag features (drag and drop, drag groups, foreign drops, drops outside) share of one
// engine: the drag under way, the drop tuning, and the way back to the engine's DOM, scroll and
// announcements. Each engine has one `DragHost` (session.ts), made by the first drag feature that
// asks for it; the features never import each other, only this folder.
import type { BatchEntry } from "../commands/types";
import type { Scheduler } from "../dom/owner";
import type { AnnounceEvent } from "../engine/host";
import type { TreeModel } from "../state/model";
import type { TreeItem } from "../state/types";
import type { DropTarget } from "./drop-evaluation";

/** The modifier keys of a drop (the pointer's release, the keyboard drag's Enter). */
export interface DragModifiers {
    readonly altKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly shiftKey: boolean;
}

export const NO_MODIFIERS: DragModifiers = Object.freeze({
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
});

/** The modifier keys of an event. */
export function modifiersOf(event: DragModifiers): DragModifiers {
    return {
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
    };
}

/**
 * Items dropped in a tree of another model (`dragGroup({ transfer })`): what is dragged, from
 * where, to where, and the default transfer's commands for the target model.
 */
export interface TreeTransfer {
    /** the dragged items' ids in the source model: the outermost ones, in tree order */
    readonly itemIds: readonly string[];
    /** the dragged items, as the source model has them */
    readonly items: readonly TreeItem[];
    /** the source model (where the drag started) */
    readonly from: TreeModel;
    /** the target model, and where the items go in it (as `item.add`'s `to`) */
    readonly to: {
        readonly model: TreeModel;
        readonly parentItemId: string | null;
        readonly index: number;
    };
    /**
     * the default transfer's commands for the target model, for a `batch`: an `item.add` for each
     * dragged item and each of its descendants (parents first, ids kept, children not loaded yet
     * left to the loader), then an `item.expand` for each one expanded in the source. Map them to
     * copy with new ids or to convert kinds
     */
    readonly commands: readonly BatchEntry[];
    /** the modifier keys of the drop (or of the pointer's last move, when `dryRun`) */
    readonly modifiers: DragModifiers;
    /**
     * true while the drag asks whether this target takes the items: change nothing, return false to
     * refuse it (it never shows), true to accept it, nothing for the default answer (the target
     * model accepts the `commands`, the source model their removal). False for the drop: run your
     * commands and return true, false when nothing happened, nothing for the default transfer
     */
    readonly dryRun: boolean;
}

/**
 * The app's transfer of items dropped in a tree of another model: runs its own commands for the
 * drop, or answers a dry run. Returning false refuses (the target hides, the drop is cancelled).
 */
// biome-ignore lint/suspicious/noConfusingVoidType: a handler that runs its commands returns nothing
export type TransferHandler = (transfer: TreeTransfer) => boolean | void;

/** How a drop lands in one tree of the drag. */
export interface Landing {
    /** the dragged items among the tree's items (their positions are not targets) */
    readonly excludedItemIds: readonly string[];
    /** whether the tree's model takes the drop at `target` */
    accepts(target: DropTarget, modifiers?: DragModifiers): boolean;
    /** drops at `target`; false when it did not happen */
    drop(
        target: DropTarget,
        modifiers: DragModifiers,
        source: "drag" | "keyboard-drag",
    ): boolean;
}

/** How a drop target is found and shown: the options every drag feature shares. */
export interface DropTuning {
    /** how long (ms) a drag hovers a collapsed parent before it expands (default 800) */
    autoExpandDelay?: number | undefined;
    /** the indentation of one level (px): the pointer's inline offset at the end of a sublist picks the level (default 16) */
    indentation?: number | undefined;
    /**
     * how far (px) a drop line (`before`, `after`) starts past its level's inline start, for rows
     * whose label starts after a toggle, a grip or padding (default 0); the `inside` box gets no
     * inset (it starts at its child level, `(level - 1) * indentation`).
     * `engine.get("drop-indicator").inlineOffset` includes it
     */
    indicatorInset?: number | undefined;
    /** how close (px) to a scroll container's edge a drag scrolls it, and how fast (px per frame) */
    autoScroll?: { threshold?: number; speed?: number } | undefined;
}

/** The drag options, with their defaults applied. */
export interface ResolvedDragOptions {
    /** how far (px) a press moves before it is a drag */
    readonly dragThreshold: number;
    /** how long (ms) a drag hovers a collapsed parent before it expands */
    readonly autoExpandDelay: number;
    /** the indentation of one level (px), which turns the pointer's inline offset into a level */
    readonly indentation: number;
    /** how far (px) a drop line starts past its level's inline start */
    readonly indicatorInset: number;
    /** how close (px) to a scroll container's edge a drag scrolls it, and how fast (px per frame) */
    readonly autoScroll: { readonly threshold: number; readonly speed: number };
    /** the app's transfer of items dropped here from a tree of another model */
    readonly transfer: TransferHandler | undefined;
}

/** A drag under way. */
export interface DragState {
    /** `foreign`: native drag of foreign content (`foreignDrop()`), with no items */
    readonly mode: "pointer" | "keyboard" | "foreign";
    /** the dragged items (empty in another tree of the group whose model is not the source's) */
    readonly itemIds: readonly string[];
    readonly target: DropTarget | null;
    /** set in the other trees of a drag group: the drag started in another tree, which this cancels */
    readonly origin?: { cancel(): void };
}

/** A drag under way in a group, as the group sees it (drag-and-drop's `GroupDrag`). */
export interface GroupDragLike {
    /** the drag is cancelled from another tree of the group */
    cancelFromGroup(): void;
    /** a tree left the group (its root detached, its engine destroyed) */
    left(host: DragHost): void;
}

/** The trees of one drag group in one document (`dragGroup()`). */
export interface DragGroupLike {
    /** the drag under way in one of the trees */
    drag: GroupDragLike | undefined;
    /** the trees with a root, in document order */
    trees(): DragHost[];
}

/** What a drop outside every tree does (`dropOutside()`), for the pointer drag. */
export interface DropOutsideController {
    /** the element under the pointer of a drag outside every tree, or null */
    element(): Element | null;
    /** the drag's pointer is outside every tree at this point (none: it is over a tree, or ended) */
    over(x?: number, y?: number): void;
    /**
     * the drag was released outside every tree: when the app took the items, the element under
     * the pointer (null: none); undefined when it did not
     */
    drop(
        itemIds: readonly string[],
        x: number,
        y: number,
        modifiers: DragModifiers,
    ): Element | null | undefined;
}

/** One engine as its drag features see it. */
export interface DragHost {
    readonly model: TreeModel;
    readonly options: ResolvedDragOptions;
    /** the root element, once attached */
    root(): HTMLElement | undefined;
    /** an item's content element (its row: the pointer target and the hit-testing rect) */
    contentOf(itemId: string): HTMLElement | undefined;
    direction(): "ltr" | "rtl";
    scheduler(): Scheduler;
    /** the drag under way, or null */
    drag(): DragState | null;
    setDrag(drag: DragState | null): void;
    announce(event: AnnounceEvent): void;
    isDestroyed(): boolean;
    /**
     * the visible rows rendered (a virtualized tree renders a window of them, plus pinned rows);
     * undefined when every visible row is
     */
    renderedRows():
        | { readonly start: number; readonly end: number }
        | undefined;
    /**
     * a virtualized tree's row that is not rendered: its box relative to the root (its scroll
     * included), from the rows' offsets; undefined when the tree is not virtualized
     */
    unrenderedRowBox(
        itemId: string,
    ): { top: number; height: number } | undefined;
    /** the element a drag scrolls near its edges: the virtualizer's, else the nearest scrolling one */
    scrollContainer(): HTMLElement | undefined;
    /** a virtualized tree scrolls an item's row into view (a keyboard drag's target); else nothing */
    reveal(itemId: string): void;
    /** the drag group the tree is in (`dragGroup()`, once its root is attached) */
    dragGroup(): DragGroupLike | undefined;
    /** the app's drop outside every tree (`dropOutside()`), if installed */
    dropOutside(): DropOutsideController | undefined;
}
