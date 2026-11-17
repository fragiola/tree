import type {
    AnyTypes,
    TreeEngine,
    TreeModel,
    TreeTypes,
} from "@fragiola/tree";
import { markRaw, type ShallowRef, shallowRef, toRaw } from "vue";

/** What a tree ref gives once its `Tree.Root` is mounted: the root's model and engine. */
export interface TreeHandle<T extends TreeTypes = AnyTypes> {
    model: TreeModel<T>;
    engine: TreeEngine<T>;
}

declare const treeRefBrand: unique symbol;

/**
 * Access to a `Tree.Root` from outside it (a toolbar, a menu, a test): pass it as the root's
 * `tree-ref`; `value` is the root's model and engine while it is mounted, `null` otherwise.
 * `value` is reactive, so a render that reads it re-renders when the root mounts or unmounts.
 *
 * It is not a Vue ref: a template does not unwrap it, so `:tree-ref="tree"` passes the tree ref
 * itself, and the template reads `tree.value`, as a script does.
 */
export interface TreeRef<T extends TreeTypes = AnyTypes> {
    /** the root's model and engine while it is mounted, `null` otherwise */
    readonly value: TreeHandle<T> | null;
    /** only `createTreeRef` and `useTreeRef` make a tree ref */
    readonly [treeRefBrand]: true;
}

/** the reactive value behind each tree ref, which only `Tree.Root` sets */
const handles = new WeakMap<object, ShallowRef<TreeHandle | null>>();

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
    const handle = shallowRef<TreeHandle | null>(null);
    // a plain object, never made reactive: a template neither unwraps it nor wraps it in a proxy
    const tree = markRaw({
        get value() {
            return handle.value;
        },
    });
    handles.set(tree, handle);
    return tree as unknown as TreeRef<T>;
}

/** @internal what `Tree.Root` calls: attaches (or, with `null`, detaches) its handle */
export function setTreeRef<T extends TreeTypes>(
    tree: TreeRef<T>,
    handle: TreeHandle<T> | null,
): void {
    const current = handles.get(toRaw(tree));
    if (!current) {
        throw new TypeError(
            "Tree.Root: `tree-ref` takes a tree ref from useTreeRef or createTreeRef",
        );
    }
    current.value = handle as TreeHandle | null;
}
