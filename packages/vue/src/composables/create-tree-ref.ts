import type {
    AnyTypes,
    TreeEngine,
    TreeModel,
    TreeTypes,
} from "@fragiola/tree";
import { type ShallowRef, shallowRef } from "vue";

/** What a tree ref gives once its `Tree.Root` is mounted: the root's model and engine. */
export interface TreeHandle<T extends TreeTypes = AnyTypes> {
    model: TreeModel<T>;
    engine: TreeEngine<T>;
}

/**
 * Access to a `Tree.Root` from outside it (a toolbar, a menu, a test): pass it as the root's
 * `tree-ref`; `value` is the root's model and engine while it is mounted, `null` otherwise. It is
 * a read-only shallow ref, so a render that reads it re-renders when the root mounts or unmounts.
 */
export type TreeRef<T extends TreeTypes = AnyTypes> = Readonly<
    ShallowRef<TreeHandle<T> | null>
>;

/**
 * Creates a tree ref anywhere (a module, a test, `setup`, where `useTreeRef` says the same).
 *
 * ```ts
 * const tree = createTreeRef<Types>();
 * // <Tree.Root :tree-ref="tree" :default-tree="json">…</Tree.Root>
 * tree.value?.model.run("tree.expand-all", {});
 * ```
 */
export function createTreeRef<T extends TreeTypes = AnyTypes>(): TreeRef<T> {
    return shallowRef<TreeHandle<T> | null>(null);
}

/** @internal what `Tree.Root` calls: attaches (or, with `null`, detaches) its handle */
export function setTreeRef<T extends TreeTypes>(
    ref: TreeRef<T>,
    handle: TreeHandle<T> | null,
): void {
    (ref as ShallowRef<TreeHandle<T> | null>).value = handle;
}
