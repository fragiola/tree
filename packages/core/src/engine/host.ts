// What the engine tells the app: the announcements' events (a drag's steps, a failed load), and
// the other tree of a drag group an announcement names.

import type { DropTarget } from "../drop-target/drop-evaluation";
import type { TreeModel } from "../state/model";

/**
 * Another tree of the drag group (the `dragGroup` option), as an announcement names it: its root
 * (its `aria-label` names it for the app's text) and its model.
 */
export interface DragTree {
    readonly root: HTMLElement;
    readonly model: TreeModel;
}

/**
 * What the app's `announce` is called with: a drag's steps and a failed load. It returns the text
 * for the live region (in the app's language), or undefined for none.
 */
export type AnnounceEvent =
    | {
          readonly type: "drag-start";
          readonly itemIds: readonly string[];
          readonly keyboard: boolean;
          /**
           * where the drag starts: a keyboard drag's first target, announced with its start in
           * one message (no `drag-over` follows in the same tick); null for a pointer drag, whose
           * targets come with the pointer's moves
           */
          readonly target: DropTarget | null;
          /** the tree of `target` when it is another tree of the drag group (absent: this one) */
          readonly targetTree?: DragTree;
      }
    | {
          readonly type: "drag-over";
          readonly itemIds: readonly string[];
          /** null: no valid target under the pointer */
          readonly target: DropTarget | null;
          /** the tree of `target` when it is another tree of the drag group (absent: this one) */
          readonly targetTree?: DragTree;
      }
    | {
          readonly type: "drop";
          readonly itemIds: readonly string[];
          readonly target: DropTarget;
          /** the tree of `target` when it is another tree of the drag group (absent: this one) */
          readonly targetTree?: DragTree;
      }
    | { readonly type: "drag-cancel"; readonly itemIds: readonly string[] }
    | {
          /** a pointer drag released outside every tree, taken by the app's `dropOutside` */
          readonly type: "drop-outside";
          readonly itemIds: readonly string[];
          /** the element under the pointer, or null */
          readonly element: Element | null;
      }
    | {
          /** a foreign drag (`foreignDrop`: files, links, text) over the tree: its target changed */
          readonly type: "foreign-drag-over";
          /** the drag's `DataTransfer.types` */
          readonly types: readonly string[];
          /** null: no target the tree takes under the pointer */
          readonly target: DropTarget | null;
      }
    | {
          /** foreign content dropped on the tree, handed to the app's `onDrop` */
          readonly type: "foreign-drop";
          readonly types: readonly string[];
          readonly target: DropTarget;
      }
    | {
          readonly type: "load-error";
          readonly itemId: string;
          readonly error: unknown;
      };
