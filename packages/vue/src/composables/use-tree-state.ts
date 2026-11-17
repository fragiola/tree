// From Dockable (fragiola/dockable, packages/vue/src/composables/use-model-state.ts), same author
// and licence.
import type { AnyTypes, TreeModel, TreeState, TreeTypes } from "@fragiola/tree";
import {
    inject,
    type MaybeRefOrGetter,
    type Ref,
    shallowRef,
    toValue,
    watch,
} from "vue";
import { ModelKey, typedModel } from "../context";

export interface UseTreeStateOptions<
    T extends TreeTypes = AnyTypes,
    S = unknown,
> {
    /** the model to read (a value, a ref or a getter); default: the enclosing `Tree.Root`'s */
    model?: MaybeRefOrGetter<TreeModel<T> | undefined>;
    /** whether two selections are the same, so readers are not triggered (`Object.is`) */
    isEqual?: ((a: S, b: S) => boolean) | undefined;
}

/**
 * A value selected from the model's state, as a read-only ref that changes only when the
 * selection changes (`isEqual`, `Object.is` by default). The selector runs once per state; keep it
 * pure. Inside a `Tree.Root` it reads the root's model; pass `model` to read one anywhere.
 *
 * ```ts
 * const count = useTreeState<Types, number>((state) => state.selectedItemIds.length);
 * const visible = useTreeState((_state, model) => model.get("visible-items").length, { model });
 * ```
 */
export function useTreeState<T extends TreeTypes = AnyTypes, S = unknown>(
    selector: (state: TreeState<T>, model: TreeModel<T>) => S,
    options: UseTreeStateOptions<T, S> = {},
): Readonly<Ref<S>> {
    const isEqual = options.isEqual ?? Object.is;
    const injected = inject(ModelKey, null);
    const resolve = (): TreeModel<T> => {
        const model =
            toValue(options.model) ??
            (injected ? typedModel<T>(injected) : undefined);
        if (!model) {
            throw new Error(
                "useTreeState must be used inside Tree.Root, or be given a model",
            );
        }
        return model;
    };
    const first = resolve();
    const value = shallowRef<S>(selector(first.state, first));
    watch(
        resolve,
        (model, previous, onCleanup) => {
            const select = () => {
                const next = selector(model.state, model);
                if (!isEqual(value.value, next)) {
                    value.value = next;
                }
            };
            if (previous !== undefined) {
                // another model: its selection, whatever `isEqual` says
                value.value = selector(model.state, model);
            }
            onCleanup(model.subscribe(select));
        },
        { immediate: true, flush: "sync" },
    );
    return value;
}
