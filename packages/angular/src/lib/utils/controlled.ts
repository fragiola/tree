// Controlled and uncontrolled state through commands, as packages/react's `useControlledState`
// and packages/vue's (composables/internal.ts): every controlled list, the core's
// (`TREE_ROOT_PROPS`) and the installed features' (`model.get("features")`), mapped the same way.

import {
    afterNextRender,
    DestroyRef,
    effect,
    Injector,
    inject,
    type Signal,
    untracked,
} from "@angular/core";
import {
    type FeatureModel,
    type FeatureState,
    TREE_ROOT_PROPS,
    type TreeModel,
    type TreeRootProp,
} from "@fragiola/tree";

/** The `meta` of the commands that bring the model to the controlled inputs. */
export const CONTROLLED_META = Object.freeze({ source: "controlled" });

/** The controlled inputs of `[treeRoot]` (`[(expandedItemIds)]`, …), as values, by name. */
export type ControlledValues = Readonly<
    Record<string, readonly string[] | undefined>
>;

/** The controlled lists of a model: the core's and its features'. */
export function rootPropsOf(model: TreeModel): readonly TreeRootProp[] {
    return [
        ...TREE_ROOT_PROPS,
        ...model.get("features").flatMap((feature) => feature.rootProps),
    ];
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((id) => set.has(id));
}

/** The commands that bring the model's state to the controlled values. */
export function syncControlled(
    model: TreeModel,
    values: ControlledValues,
): void {
    for (const rootProp of rootPropsOf(model)) {
        const value = values[rootProp.prop];
        if (value === undefined) continue;
        rootProp.sync(model as unknown as FeatureModel, value, {
            meta: CONTROLLED_META,
        });
    }
}

/**
 * Brings the model to the controlled values whenever they change, and reports every other commit
 * that changes one of the lists (`emit(prop, itemIds)`, for its `…Change` output). After a commit
 * of its own the model is brought back to the values once the app has had its render to answer.
 */
export function bindControlledState(
    model: Signal<TreeModel>,
    values: () => ControlledValues,
    emit: (list: string, itemIds: string[]) => void,
): void {
    const injector = inject(Injector);
    const destroyRef = inject(DestroyRef);
    effect(() => {
        const current = model();
        const wanted = values();
        untracked(() => syncControlled(current, wanted));
    });
    effect((onCleanup) => {
        const current = model();
        const rootProps = rootPropsOf(current);
        let pending = false;
        onCleanup(
            current.subscribe((event) => {
                // the root is being destroyed: its engine's teardown commits (a load it drops goes
                // back to `unloaded`) while this listener is still attached, and the view can no
                // longer emit nor schedule a render
                if (destroyRef.destroyed) return;
                if (event.meta?.source === CONTROLLED_META.source) return;
                const before = event.before as FeatureState;
                const after = event.after as FeatureState;
                for (const { prop, read } of rootProps) {
                    const next = read(after);
                    if (!sameSet(read(before), next)) emit(prop, [...next]);
                }
                // once the app's answer (a new input value, or none) has reached the root
                if (pending) return;
                pending = true;
                afterNextRender(
                    () => {
                        pending = false;
                        if (
                            !destroyRef.destroyed &&
                            untracked(model) === current
                        ) {
                            syncControlled(current, untracked(values));
                        }
                    },
                    { injector },
                );
            }),
        );
    });
}
