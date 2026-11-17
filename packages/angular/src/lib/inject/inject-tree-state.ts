// From Dockable (fragiola/dockable, packages/angular/src/lib/inject/inject-model-state.ts), same
// author and licence.
import {
    computed,
    effect,
    inject,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import type {
    AnyTypes,
    TreeFeatures,
    TreeModel,
    TreeStateOf,
    TreeTypes,
} from "@fragiola/tree";
import { TREE_CONTEXT, typedModel } from "../context";

export interface InjectTreeStateOptions<
    T extends TreeTypes = AnyTypes,
    S = unknown,
    F extends TreeFeatures = readonly [],
> {
    /** the model to read (a model, or a signal of one); default: the enclosing `[treeRoot]`'s */
    model?: TreeModel<T, F> | Signal<TreeModel<T, F> | undefined> | undefined;
    /** whether two selections are the same, so readers are not notified (`Object.is`) */
    isEqual?: ((a: S, b: S) => boolean) | undefined;
}

/**
 * A value selected from the model's state, as a signal that changes only when the selection
 * changes (`isEqual`, `Object.is` by default). The selector runs once per state; keep it pure.
 * Inside a `[treeRoot]` it reads the root's model; pass `model` to read one anywhere. Call it in an
 * injection context.
 *
 * ```ts
 * readonly count = injectTreeState((state) => state.selectedItemIds.length, { model });
 * ```
 */
export function injectTreeState<
    T extends TreeTypes = AnyTypes,
    S = unknown,
    F extends TreeFeatures = readonly [],
>(
    selector: (state: TreeStateOf<T, F>, model: TreeModel<T, F>) => S,
    options: InjectTreeStateOptions<T, S, F> = {},
): Signal<S> {
    const injected = inject(TREE_CONTEXT, { optional: true });
    const given = options.model;
    const resolve = (): TreeModel<T, F> => {
        const model =
            (typeof given === "function"
                ? (given as Signal<TreeModel<T, F> | undefined>)()
                : given) ??
            (injected ? typedModel<T, F>(injected.model()) : undefined);
        if (!model) {
            throw new Error(
                "injectTreeState must be used inside [treeRoot], or be given a model",
            );
        }
        return model;
    };
    const tick = signal(0);
    effect((onCleanup) => {
        const model = resolve();
        onCleanup(
            model.subscribe(() => {
                tick.update((value) => value + 1);
            }),
        );
        untracked(() => tick.update((value) => value + 1));
    });
    return computed(
        () => {
            tick();
            const model = resolve();
            return selector(model.state, model);
        },
        { equal: options.isEqual ?? Object.is },
    );
}
