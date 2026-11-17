import type { CommandResult } from "../commands/types";
import type { KeyEventLike } from "../keyboard/key-map";
import type { TreeModel } from "../state/model";
import type { AnyTypes, TreeTypes } from "../state/types";

/** A key event as the engine handles it: it prevents the default of a key it uses. */
export interface KeyEventInput extends KeyEventLike {
    readonly target: EventTarget | null;
    preventDefault(): void;
}

/** A press as the engine reads it: its modifiers decide the selection. */
export interface PressInput {
    readonly shiftKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
}

/**
 * What only an adapter (React, Vue, Angular) calls on an engine: the root and item elements, the
 * events it forwards, the rename input, and the revision it re-renders on. An app never needs it:
 * it uses `run`, `can`, `check`, `get` and `is`. The adapter forwards events; the core decides.
 */
export interface TreeEngineAdapter<T extends TreeTypes = AnyTypes> {
    /** the model this engine draws */
    readonly model: TreeModel<T>;

    /** attaches the root element (`Tree.Root`); another element replaces it */
    attachRoot(element: HTMLElement): void;
    /** detaches the root element, cancelling a drag under way */
    detachRoot(): void;
    /** registers (or, with `null`, unregisters) an item's element (`Tree.Item`, the one DOM focus goes to) */
    registerItem(itemId: string, element: HTMLElement | null): void;
    /** registers (or unregisters) an item's content element (`Tree.ItemContent`: the pointer target and the row the drag hit-tests) */
    registerContent(itemId: string, element: HTMLElement | null): void;

    /** a key on the tree (the root's `keydown`): true when the engine used it (its default is prevented) */
    handleKeyDown(event: KeyEventInput): boolean;
    /** a pointer pressed an item's content: it may become a drag */
    handlePointerDown(itemId: string, event: PointerEvent): void;
    /** a click on an item's content: focus, select (Shift extends, Ctrl/Cmd toggles), and expand with `expandOnClick` */
    handleClick(itemId: string, event: PressInput): void;
    /** a press on an item's toggle (`Tree.Toggle`): expand or collapse */
    handleToggleClick(itemId: string): void;
    /** a press on an item's checkbox (`Tree.Checkbox`): toggle its check */
    handleCheckboxClick(itemId: string): void;
    /** DOM focus entered an item's element: it becomes the focused item */
    handleFocus(itemId: string): void;
    /** the rename input committed a label (Enter, blur): `item.rename`, then focus goes back to the item */
    commitRename(itemId: string, label: string): CommandResult<unknown>;
    /** the rename input was cancelled (Escape): `item.cancel-rename`, then focus goes back to the item */
    cancelRename(itemId: string): void;

    /** calls `listener` when adapters should re-render (a commit, a drag step, an announcement); returns its remover */
    subscribe(listener: () => void): () => void;
    /** the render revision: a number that changes whenever adapters should re-render */
    getSnapshot(): number;
}
