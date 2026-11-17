// Drops outside the tree (the engine's `dropOutside` option, `createTreeDropOutside`): a pointer
// drag of the tree's items released outside every tree of its drag group (outside its own tree
// without a group) is handed to the app, for its own targets: a trash zone, a panel, a
// `@fragiola/dnd` droppable. The drag is still the Pointer Events one (rule 9): the source keeps
// the pointer capture, so the element under the pointer comes from the root's document
// (`elementFromPoint`), and `engine.get("drop-outside-element")` tells the app's targets the drag
// is over them. The engine reaches this file only through the option, so a bundle that never
// imports `createTreeDropOutside` leaves it out.
import type { EngineHost } from "../engine/host";
import type { TreeModel } from "../state/model";
import type { AnyTypes, TreeTypes } from "../state/types";
import type { DragModifiers } from "./transfer";

/** A drag released outside every tree: what `onDrop` is called with. */
export interface DropOutside<T extends TreeTypes = AnyTypes> {
    /** the dragged items, in the order of the drag */
    readonly itemIds: readonly string[];
    readonly model: TreeModel<T>;
    /** the element under the pointer (in the root's document), or null */
    readonly element: Element | null;
    /** the pointer's client point */
    readonly x: number;
    readonly y: number;
    /** the modifier keys held at the release */
    readonly modifiers: DragModifiers;
}

/** Options of {@link createTreeDropOutside}. */
export interface TreeDropOutsideOptions<T extends TreeTypes = AnyTypes> {
    /**
     * the release outside every tree: the app runs its commands (`item.remove`, a panel's `add`,
     * …) and returns true when it took the items (announced as `drop-outside`); false is a cancel
     */
    onDrop: (drop: DropOutside<T>) => boolean;
}

/** What the engine connects a drop outside to. */
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

/** A drop outside description: the engine's (and every root's) `dropOutside` option. */
export interface TreeDropOutside<T extends TreeTypes = AnyTypes> {
    readonly options: Readonly<TreeDropOutsideOptions<T>>;
    /** called by the engine: this drop outside's state for one engine */
    connect(host: EngineHost, changed: () => void): DropOutsideController;
}

/**
 * Describes what happens to the tree's items dragged (by pointer) outside every tree: `onDrop`
 * gets them with the element under the pointer, and runs the app's commands.
 *
 * ```ts
 * const dropOutside = createTreeDropOutside({
 *     onDrop: ({ itemIds, element, model }) =>
 *         element?.closest("[data-trash]") != null &&
 *         model.run("item.remove", { itemIds: [...itemIds] }).ok,
 * });
 * const engine = createTreeEngine(model, { root, dropOutside });
 * ```
 */
export function createTreeDropOutside<T extends TreeTypes = AnyTypes>(
    options: TreeDropOutsideOptions<T>,
): TreeDropOutside<T> {
    const frozen = Object.freeze({ ...options });
    return Object.freeze({
        options: frozen,
        connect: (
            host: EngineHost,
            changed: () => void,
        ): DropOutsideController => {
            let current: Element | null = null;
            const at = (x: number, y: number) =>
                host.root()?.ownerDocument.elementFromPoint?.(x, y) ?? null;
            return {
                element: () => current,
                over: (x, y) => {
                    const element =
                        x === undefined || y === undefined ? null : at(x, y);
                    if (element === current) return;
                    current = element;
                    changed();
                },
                drop: (itemIds, x, y, modifiers) => {
                    const element = at(x, y);
                    return (frozen as unknown as TreeDropOutsideOptions).onDrop(
                        {
                            itemIds,
                            model: host.model,
                            element,
                            x,
                            y,
                            modifiers,
                        },
                    ) === true
                        ? element
                        : undefined;
                },
            };
        },
    });
}
