// What the engine's parts (the drags, the loader) share of the engine: the model, the DOM it
// registered, the options, and the way back to its state and its announcements.
import type { DropTarget } from "../dnd/drop-evaluation";
import type { Scheduler } from "../dom/owner";
import type { TreeModel } from "../state/model";

/**
 * What the app's `announce` is called with: a drag's steps and a failed load. It returns the text
 * for the live region (in the app's language), or undefined for none.
 */
export type AnnounceEvent =
    | {
          readonly type: "drag-start";
          readonly itemIds: readonly string[];
          readonly keyboard: boolean;
      }
    | {
          readonly type: "drag-over";
          readonly itemIds: readonly string[];
          /** null: no valid target under the pointer */
          readonly target: DropTarget | null;
      }
    | {
          readonly type: "drop";
          readonly itemIds: readonly string[];
          readonly target: DropTarget;
      }
    | { readonly type: "drag-cancel"; readonly itemIds: readonly string[] }
    | {
          readonly type: "load-error";
          readonly itemId: string;
          readonly error: unknown;
      };

/** The engine's options, with their defaults applied. */
export interface ResolvedEngineOptions {
    /** how far (px) a press moves before it is a drag */
    readonly dragThreshold: number;
    /** how long (ms) a drag hovers a collapsed parent before it expands */
    readonly autoExpandDelay: number;
    /** the indentation of one level (px), which turns the pointer's inline offset into a level */
    readonly indentation: number;
    /** how close (px) to a scroll container's edge a drag scrolls it, and how fast (px per frame) */
    readonly autoScroll: { readonly threshold: number; readonly speed: number };
    /** how long (ms) between two typed characters keeps one type-ahead search */
    readonly typeAheadTimeout: number;
}

/** A drag under way. */
export interface DragState {
    readonly mode: "pointer" | "keyboard";
    readonly itemIds: readonly string[];
    readonly target: DropTarget | null;
}

export interface EngineHost {
    readonly model: TreeModel;
    readonly options: ResolvedEngineOptions;
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
}
