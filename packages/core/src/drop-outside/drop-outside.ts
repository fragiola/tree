// Drops outside the tree (`dropOutside(options)`, `@fragiola/tree/drop-outside`): a pointer
// drag of the tree's items released outside every tree of its drag group (outside its own tree
// without a group) is handed to the app, for its own targets: a trash zone, a panel, a
// `@fragiola/dnd` droppable. The drag is still the Pointer Events one (rule 9): the source keeps
// the pointer capture, so the element under the pointer comes from the root's document
// (`elementFromPoint`), and `engine.get("drop-outside-element")` tells the app's targets the drag
// is over them.
import type {
    DragHost,
    DragModifiers,
    DropOutsideController,
} from "../drop-target/host";
import { dragSessionOf } from "../drop-target/session";
import type { FeatureEngine, TreeFeature } from "../features/types";
import type { TreeModel } from "../state/model";
import type { AnyTypes, TreeTypes } from "../state/types";

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

/** Options of {@link dropOutside}. */
export interface DropOutsideOptions<T extends TreeTypes = AnyTypes> {
    /**
     * the release outside every tree: the app runs its commands (`item.remove`, a panel's `add`,
     * …) and returns true when it took the items (announced as `drop-outside`); false is a cancel
     */
    onDrop: (drop: DropOutside<T>) => boolean;
}

/** The drop outside feature, as `features` holds it. */
export type DropOutsideFeature = TreeFeature<"drop-outside">;

/**
 * The drop outside feature: the tree's items dragged (by pointer) outside every tree go to
 * `onDrop`, with the element under the pointer, for the app's commands; while the drag is outside,
 * `engine.get("drop-outside-element")` is that element. It needs `dragAndDrop()`.
 *
 * ```ts
 * import { dragAndDrop } from "@fragiola/tree/drag-and-drop";
 * import { dropOutside } from "@fragiola/tree/drop-outside";
 * const trash = dropOutside({
 *     onDrop: ({ itemIds, element, model }) =>
 *         element?.closest("[data-trash]") != null &&
 *         model.run("item.remove", { itemIds: [...itemIds] }).ok,
 * });
 * const model = createTreeModel(json, { features: [dragAndDrop(), trash] });
 * ```
 */
export function dropOutside<T extends TreeTypes = AnyTypes>(
    options: DropOutsideOptions<T>,
): DropOutsideFeature {
    const frozen = Object.freeze({
        ...options,
    }) as unknown as Readonly<DropOutsideOptions>;
    return Object.freeze({
        name: "drop-outside",
        requires: ["drag-and-drop"],
        engine: (host): FeatureEngine => {
            const session = dragSessionOf(host);
            session.outside = connect(session, frozen, () => host.changed());
            return session.verbs("drop-outside");
        },
    } satisfies DropOutsideFeature);
}

function connect(
    host: DragHost,
    options: Readonly<DropOutsideOptions>,
    changed: () => void,
): DropOutsideController {
    let current: Element | null = null;
    // the root's document, or its shadow root inside a web component
    const at = (x: number, y: number) =>
        (
            host.root()?.getRootNode() as
                | Partial<DocumentOrShadowRoot>
                | undefined
        )?.elementFromPoint?.(x, y) ?? null;
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
            return options.onDrop({
                itemIds,
                model: host.model,
                element,
                x,
                y,
                modifiers,
            }) === true
                ? element
                : undefined;
        },
    };
}
