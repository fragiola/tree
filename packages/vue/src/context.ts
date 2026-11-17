import type {
    AnyTypes,
    ItemOf,
    TreeEngine,
    TreeModel,
    TreeState,
    TreeTypes,
} from "@fragiola/tree";
import {
    type ComputedRef,
    type InjectionKey,
    inject,
    type Ref,
    type ShallowRef,
} from "vue";
import type { TreeItemState } from "./composables/use-tree-item";

/**
 * The context of a `Tree.Root`. It holds the model and the engine with the registry erased
 * (`AnyTypes`): a child cannot infer the root's `T` through injection, so the typed surface is each
 * part's props and `typedTree<T>()`.
 */
export interface TreeContextValue {
    /** the root's model (another model remounts the root) */
    readonly model: TreeModel;
    /** the engine, once the root is mounted (null before, and on the server) */
    readonly engine: Readonly<ShallowRef<TreeEngine | null>>;
    /** the engine as apps see it: always there, forwarding to the engine once it exists */
    readonly publicEngine: TreeEngine;
    /** the state the parts show: every part reads it in its render, so it re-renders with the tree */
    readonly state: Readonly<Ref<TreeState>>;
    /** the engine's render revision (a drag step, an announcement) */
    readonly revision: Readonly<Ref<number>>;
    /** the roving tab stop of this state (`tab-stop-item`), computed once per state */
    readonly tabStopItemId: ComputedRef<string | undefined>;
    /** the items carry `aria-checked` and Space toggles the check (`checkboxes` on the root) */
    readonly checkboxes: ComputedRef<boolean>;
}

export const TreeKey: InjectionKey<TreeContextValue> = Symbol("Tree");

/** The item a subtree renders (`Tree.Item`): what its parts read, computed once per render. */
export interface ItemContextValue {
    item: ItemOf<AnyTypes>;
    state: TreeItemState;
}

export const ItemKey: InjectionKey<ComputedRef<ItemContextValue>> =
    Symbol("TreeItem");

/** The model alone, for `useTreeState` (another model remounts the root). */
export const ModelKey: InjectionKey<TreeModel> = Symbol("TreeModel");

export function useTreeContext(part: string): TreeContextValue {
    const context = inject(TreeKey, null);
    if (!context) {
        throw new Error(`Tree.${part} must be rendered inside Tree.Root`);
    }
    return context;
}

export function useItemContext(part: string): ComputedRef<ItemContextValue> {
    const context = inject(ItemKey, null);
    if (!context) {
        throw new Error(`Tree.${part} must be rendered inside Tree.Item`);
    }
    return context;
}

/**
 * A model of any registry, seen as `TreeModel<AnyTypes>`. `TreeModel<T>` takes `T` in its
 * commands' payloads, so it is not assignable to the erased type; the adapter only passes it on.
 */
export function eraseModel<T extends TreeTypes>(
    model: TreeModel<T>,
): TreeModel {
    return model as unknown as TreeModel;
}

/** The erased model seen with the registry `T` the caller declares. */
export function typedModel<T extends TreeTypes>(
    model: TreeModel,
): TreeModel<T> {
    return model as unknown as TreeModel<T>;
}

/** The erased engine seen with the registry `T` the caller declares. */
export function typedEngine<T extends TreeTypes>(
    engine: TreeEngine,
): TreeEngine<T> {
    return engine as unknown as TreeEngine<T>;
}
