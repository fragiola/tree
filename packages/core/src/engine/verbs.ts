// The typed registry of the engine's keys: what `engine.run`, `engine.get` and `engine.is` take
// and return. An engine action's key never has a dot, so it never reads as a command: commands
// change the tree through `model.run`; actions are what only the screen can do (DOM focus,
// scrolling, calling the loader, a drag). The ones that change the tree do it by running commands,
// so middleware sees them.
import type { NoPayload } from "../commands/types";
import type { DropPosition, DropTarget } from "../dnd/drop-evaluation";
import type { ScrollAlign } from "../virtual/scroll-target";
import type { VirtualWindow } from "../virtual/virtualizer";

/** Where the drop indicator goes, relative to the root's border box, in pixels and logical sides. */
export interface DropIndicator {
    readonly position: DropPosition;
    /** the item the position is relative to (`null`: an empty tree) */
    readonly itemId: string | null;
    /** the level the dropped items take (1 for the root) */
    readonly level: number;
    /** from the root's top to the line (`before`, `after`) or to the row's top (`inside`), scroll included */
    readonly blockOffset: number;
    /** the row's height (`inside`), 0 for a line */
    readonly blockSize: number;
    /**
     * from the root's inline-start edge: `(level - 1) * indentation`, plus the `indicatorInset`
     * option for a line (`before`, `after`)
     */
    readonly inlineOffset: number;
}

/** What `engine.run(action, payload)` does: each screen action's payload and result. */
export interface EngineActionMap {
    /** focuses an item's element (DOM focus) and makes it the focused item (`item.focus`) */
    focus: { payload: { itemId: string }; result: { itemId: string } };
    /**
     * scrolls an item's element into view (the nearest edge, or `align`); a virtualized tree
     * scrolls to a visible item that is not rendered, which renders it
     */
    "scroll-to": {
        payload: { itemId: string; align?: ScrollAlign | undefined };
        result: { itemId: string };
    };
    /**
     * calls the app's `loadChildren` for an item whose children come from the loader (a retry after
     * an error, or a first load); refused while it is loading
     */
    "load-children": {
        payload: { itemId: string };
        result: { itemId: string };
    };
    /**
     * starts a keyboard drag of these items: the arrows move the drop target over the valid
     * positions, Enter drops (`item.move`), Escape cancels
     */
    "start-keyboard-drag": {
        payload: { itemIds: string[] };
        result: { itemIds: string[] };
    };
    /** cancels the drag under way (pointer or keyboard): nothing is committed */
    "cancel-drag": { payload: NoPayload; result: NoPayload };
}

export type EngineActionKey = keyof EngineActionMap;
export type EngineActionPayload<K extends EngineActionKey> =
    EngineActionMap[K]["payload"];
export type EngineActionResult<K extends EngineActionKey> =
    EngineActionMap[K]["result"];

/** What `engine.get(key, payload)` reads: facts of this tree on screen. */
export interface EngineGetMap {
    /** the drop target of the drag under way (only one `model.can` accepts), or null */
    "drop-target": { payload: NoPayload; result: DropTarget | null };
    /** the items being dragged (empty when no drag) */
    "dragging-item-ids": { payload: NoPayload; result: readonly string[] };
    /** where the drop indicator goes, or null when there is no drop target */
    "drop-indicator": { payload: NoPayload; result: DropIndicator | null };
    /** the latest message the app's `announce` returned, for a live region ("" before any) */
    announcement: { payload: NoPayload; result: string };
    /** the root's writing direction: Right and Left swap in `rtl` */
    direction: { payload: NoPayload; result: "ltr" | "rtl" };
    /**
     * the rows a virtualized tree renders (the `virtual` option): each with its offset, size and
     * the spacer before it; null when the tree is not virtualized
     */
    "virtual-window": { payload: NoPayload; result: VirtualWindow | null };
    /**
     * the element under the pointer while this tree's pointer drag is outside every tree (the
     * `dropOutside` option), for the app's own targets to show it; null otherwise
     */
    "drop-outside-element": { payload: NoPayload; result: Element | null };
}

export type EngineGetKey = keyof EngineGetMap;
export type EngineGetPayload<K extends EngineGetKey> =
    EngineGetMap[K]["payload"];
export type EngineGetResult<K extends EngineGetKey> = EngineGetMap[K]["result"];

/** What `engine.is(key, payload)` asks: each question's payload. */
export interface EngineIsMap {
    /** a drag is under way (pointer or keyboard) */
    dragging: NoPayload;
    /** a keyboard drag is under way */
    "keyboard-dragging": NoPayload;
    /**
     * a drag that started in another tree of the drag group (`dragGroup`) is under way: this tree
     * shows its target when it is here
     */
    "dragging-from-other-tree": NoPayload;
    /** an item is being dragged */
    "item-dragging": { itemId: string };
    /** an item is the one the drop target is relative to */
    "item-drop-target": { itemId: string };
}

export type EngineIsKey = keyof EngineIsMap;
export type EngineIsPayload<K extends EngineIsKey> = EngineIsMap[K];
