import type {
    AnyTypes,
    ItemOf,
    TreeEngine,
    TreeFeatures,
    TreeModel,
    TreeState,
    TreeTypes,
} from "@fragiola/tree";
import * as React from "react";
import type { TreeItemState } from "./hooks/use-tree-item";

/**
 * The context of a `Tree.Root`. It holds the model and the engine with the registry erased
 * (`AnyTypes`): a child cannot infer the root's `T` through context, so the typed surface is each
 * part's props and type argument.
 */
export interface TreeContextValue {
    model: TreeModel;
    /** the engine, once the root is mounted (null on the first render and on the server) */
    engine: TreeEngine | null;
    /** the engine as apps see it: always there, forwarding to the engine once it exists */
    publicEngine: TreeEngine;
    /** the state this render shows */
    state: TreeState;
    /** the engine's render revision (a drag step, an announcement) */
    revision: number;
    /** the roving tab stop of this state (`tab-stop-item`), computed once per render */
    tabStopItemId: string | undefined;
    /** the items carry `aria-checked` and Space toggles the check (`checkboxes` on the root) */
    checkboxes: boolean;
}

export const TreeContext = React.createContext<TreeContextValue | null>(null);

/** The item a subtree renders (`Tree.Item`): what its parts read, computed once per render. */
export interface ItemContextValue {
    item: ItemOf<AnyTypes>;
    state: TreeItemState;
}

export const ItemContext = React.createContext<ItemContextValue | null>(null);

export function useTreeContext(part: string): TreeContextValue {
    const context = React.useContext(TreeContext);
    if (!context) {
        throw new Error(`Tree.${part} must be rendered inside Tree.Root`);
    }
    return context;
}

export function useItemContext(part: string): ItemContextValue {
    const context = React.useContext(ItemContext);
    if (!context) {
        throw new Error(`Tree.${part} must be rendered inside Tree.Item`);
    }
    return context;
}

/**
 * A model of any registry, seen as `TreeModel<AnyTypes>`. `TreeModel<T>` takes `T` in its
 * commands' payloads, so it is not assignable to the erased type; the adapter only passes it on.
 */
export function eraseModel<T extends TreeTypes, F extends TreeFeatures>(
    model: TreeModel<T, F>,
): TreeModel {
    return model as unknown as TreeModel;
}

/** The erased model seen with the registry `T` the caller declares. */
export function typedModel<
    T extends TreeTypes,
    F extends TreeFeatures = readonly [],
>(model: TreeModel): TreeModel<T, F> {
    return model as unknown as TreeModel<T, F>;
}

/** The erased engine seen with the registry `T` the caller declares. */
export function typedEngine<
    T extends TreeTypes,
    F extends TreeFeatures = readonly [],
>(engine: TreeEngine): TreeEngine<T, F> {
    return engine as unknown as TreeEngine<T, F>;
}
