// From Dockable (fragiola/dockable, packages/react/src/hooks/use-model-state.ts), same author and
// licence.
import type { AnyTypes, TreeModel, TreeState, TreeTypes } from "@fragiola/tree";
import * as React from "react";
import { TreeContext, typedModel } from "../context";

export interface UseTreeStateOptions<
    T extends TreeTypes = AnyTypes,
    S = unknown,
> {
    /** the model to read; default: the enclosing `Tree.Root`'s (then the hook needs one) */
    model?: TreeModel<T> | undefined;
    /** whether two selections are the same, so the component does not re-render (`Object.is`) */
    isEqual?: ((a: S, b: S) => boolean) | undefined;
}

/**
 * A value selected from the model's state, re-rendering the component only when the selection
 * changes (`isEqual`, `Object.is` by default). The selector runs once per state; keep it pure.
 * Inside a `Tree.Root` it reads the root's model; pass `model` to read one anywhere.
 *
 * ```ts
 * const count = useTreeState<Types, number>((state) => state.selectedItemIds.length);
 * const visible = useTreeState((_state, model) => model.get("visible-items").length, { model });
 * ```
 */
export function useTreeState<T extends TreeTypes = AnyTypes, S = unknown>(
    selector: (state: TreeState<T>, model: TreeModel<T>) => S,
    options: UseTreeStateOptions<T, S> = {},
): S {
    const { isEqual = Object.is } = options;
    const context = React.useContext(TreeContext)?.model;
    const model =
        options.model ?? (context ? typedModel<T>(context) : undefined);
    if (!model) {
        throw new Error(
            "useTreeState must be used inside Tree.Root, or be given a model",
        );
    }
    const latest = React.useRef({ selector, isEqual });
    latest.current = { selector, isEqual };
    // the last selection, and what it was computed from: a new state, model or selector (a closure
    // over new props) selects again
    const cache = React.useRef<
        | {
              state: TreeState<T>;
              value: S;
              model: TreeModel<T>;
              selector: typeof selector;
          }
        | undefined
    >(undefined);
    const subscribe = React.useCallback(
        (onChange: () => void) => model.subscribe(() => onChange()),
        [model],
    );
    const getSnapshot = (): S => {
        const state = model.state;
        const current = latest.current.selector;
        const previous = cache.current;
        if (
            previous?.state === state &&
            previous.model === model &&
            previous.selector === current
        ) {
            return previous.value;
        }
        const value = current(state, model);
        const kept =
            previous !== undefined &&
            previous.model === model &&
            latest.current.isEqual(previous.value, value)
                ? previous.value
                : value;
        cache.current = { state, value: kept, model, selector: current };
        return kept;
    };
    return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
