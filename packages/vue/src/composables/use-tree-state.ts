// From Dockable (fragiola/dockable, packages/vue/src/composables/use-model-state.ts), same author
// and licence.
import type {
    AnyTypes,
    TreeFeatures,
    TreeModel,
    TreeStateOf,
    TreeTypes,
} from "@fragiola/tree";
import {
    computed,
    inject,
    type MaybeRefOrGetter,
    type Ref,
    shallowRef,
    toValue,
    watch,
} from "vue";
import { ModelKey, typedModel } from "../context";
import { onClient } from "../utils/render";

export interface UseTreeStateOptions<
    T extends TreeTypes = AnyTypes,
    S = unknown,
    F extends TreeFeatures = readonly [],
> {
    /** the model to read (a value, a ref or a getter); default: the enclosing `Tree.Root`'s */
    model?: MaybeRefOrGetter<TreeModel<T, F> | undefined>;
    /** whether two selections are the same, so readers are not triggered (`Object.is`) */
    isEqual?: ((a: S, b: S) => boolean) | undefined;
}

/**
 * A value selected from the model's state, as a read-only ref that changes only when the
 * selection changes (`isEqual`, `Object.is` by default). The selector runs once per state; keep it
 * pure. Inside a `Tree.Root` it reads the root's model; pass `model` to read one anywhere.
 *
 * ```ts
 * const count = useTreeState((state) => state.selectedItemIds.length, { model });
 * const visible = useTreeState((_state, model) => model.get("visible-items").length, { model });
 * ```
 */
export function useTreeState<
    T extends TreeTypes = AnyTypes,
    S = unknown,
    F extends TreeFeatures = readonly [],
>(
    selector: (state: TreeStateOf<T, F>, model: TreeModel<T, F>) => S,
    options: UseTreeStateOptions<T, S, F> = {},
): Readonly<Ref<S>> {
    const isEqual = options.isEqual ?? Object.is;
    const injected = inject(ModelKey, null);
    const resolve = (): TreeModel<T, F> => {
        const model =
            toValue(options.model) ??
            (injected ? typedModel<T, F>(injected) : undefined);
        if (!model) {
            throw new Error(
                "useTreeState must be used inside Tree.Root, or be given a model",
            );
        }
        return model;
    };
    resolve();
    // the model's commits, on the client only (a server render subscribes to nothing)
    const tick = shallowRef(0);
    onClient(() => {
        watch(
            resolve,
            (model, _previous, onCleanup) => {
                const bump = () => {
                    tick.value++;
                };
                bump();
                onCleanup(model.subscribe(bump));
            },
            { immediate: true, flush: "sync" },
        );
    });
    // selected again on a commit, another model, or a reactive value the selector reads (a prop)
    let last: { model: TreeModel<T, F>; value: S } | undefined;
    return computed(() => {
        tick.value;
        const model = resolve();
        const value = selector(model.state, model);
        if (last?.model === model && isEqual(last.value, value)) {
            return last.value;
        }
        last = { model, value };
        return value;
    });
}
