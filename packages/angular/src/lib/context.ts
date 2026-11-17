import {
    InjectionToken,
    inject,
    type Signal,
    type TemplateRef,
} from "@angular/core";
import type {
    AnyTypes,
    ItemOf,
    TreeEngine,
    TreeFeatures,
    TreeModel,
    TreeState,
    TreeTypes,
} from "@fragiola/tree";
import type { TreeItemState } from "./utils/item-state";

/**
 * The context of a `[treeRoot]`. It holds the model and the engine with the registry erased
 * (`AnyTypes`): a child cannot infer the root's `T` through injection, so the typed surface is
 * each part's inputs and the template directives' contexts.
 */
export interface TreeContext {
    /** the root's model (its `treeRoot` input, or the one it made from `defaultTree`) */
    readonly model: Signal<TreeModel>;
    /** the engine, once the root is rendered in a browser (null before) */
    readonly engine: Signal<TreeEngine | null>;
    /** the engine as apps see it: always there, forwarding to the engine once it exists */
    readonly publicEngine: TreeEngine;
    /** the state the parts show: every part reads it, so it updates with the tree */
    readonly state: Signal<TreeState>;
    /** the engine's render revision (a drag step, an announcement) */
    readonly revision: Signal<number>;
    /** the roving tab stop of this state (`tab-stop-item`), computed once per state */
    readonly tabStopItemId: Signal<string | undefined>;
}

export const TREE_CONTEXT = new InjectionToken<TreeContext>("Tree");

/** The item of a `[treeItem]`, for the parts inside its element. */
export interface TreeItemContext {
    readonly item: Signal<ItemOf<AnyTypes>>;
    readonly state: Signal<TreeItemState>;
}

export const TREE_ITEM = new InjectionToken<TreeItemContext>("TreeItem");

/** A `[treeGroup]`: the children its `<ng-template treeItems>` renders. */
export interface TreeGroupContext {
    /** the enclosing item's children while the group is open (expanded, or `keepMounted`) */
    readonly children: Signal<readonly ItemOf<AnyTypes>[]>;
    /**
     * an `<ng-template treeItems>` inside the group (at any depth of its content, an `@if`
     * included) renders its children: the group renders none with the enclosing template. Returns
     * the release, for when that template goes away
     */
    adopt(): () => void;
}

export const TREE_GROUP = new InjectionToken<TreeGroupContext>("TreeGroup");

/** The template of an `<ng-template treeItems>`: what a group with none of its own renders with. */
export interface TreeItemsTemplate {
    readonly template: TemplateRef<unknown>;
}

export const TREE_ITEMS = new InjectionToken<TreeItemsTemplate>("TreeItems");

export function injectTreeContext(part: string): TreeContext {
    const context = inject(TREE_CONTEXT, { optional: true });
    if (!context) {
        throw new Error(`${part} must be used inside [treeRoot]`);
    }
    return context;
}

export function injectItemContext(part: string): TreeItemContext {
    const context = inject(TREE_ITEM, { optional: true });
    if (!context) {
        throw new Error(`${part} must be used inside [treeItem]`);
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
