import type {
    AnyTypes,
    TreeEngine,
    TreeFeatures,
    TreeModel,
    TreeTypes,
} from "@fragiola/tree";

/** What a tree ref gives once its `Tree.Root` is mounted: the root's model and engine. */
export interface TreeHandle<
    T extends TreeTypes = AnyTypes,
    F extends TreeFeatures = readonly [],
> {
    model: TreeModel<T, F>;
    engine: TreeEngine<T, F>;
}

/**
 * Access to a `Tree.Root` from outside it (a toolbar, a menu, a test): pass it as the root's
 * `treeRef`; `current` is the root's model and engine while it is mounted, `null` otherwise.
 */
export interface TreeRef<
    T extends TreeTypes = AnyTypes,
    F extends TreeFeatures = readonly [],
> {
    readonly current: TreeHandle<T, F> | null;
}

interface RefSlot {
    handle: TreeHandle | null;
    readonly listeners: Set<() => void>;
}

const slots = new WeakMap<object, RefSlot>();

function slotOf(ref: object): RefSlot {
    const slot = slots.get(ref);
    if (!slot) throw new Error("not a tree ref: create it with createTreeRef");
    return slot;
}

/**
 * Creates a tree ref outside React (a module, a test). In a component, `useTreeRef` keeps one and
 * re-renders when it attaches.
 *
 * ```tsx
 * const tree = createTreeRef<Types>();
 * <Tree.Root treeRef={tree} defaultTree={json}>…</Tree.Root>;
 * tree.current?.model.run("tree.expand-all", {});
 * ```
 */
export function createTreeRef<
    T extends TreeTypes = AnyTypes,
    F extends TreeFeatures = readonly [],
>(): TreeRef<T, F> {
    const slot: RefSlot = { handle: null, listeners: new Set() };
    const ref: TreeRef<T, F> = Object.freeze({
        get current() {
            return slot.handle as unknown as TreeHandle<T, F> | null;
        },
    });
    slots.set(ref, slot);
    return ref;
}

/** @internal what `Tree.Root` calls: attaches (or, with `null`, detaches) its handle */
export function setTreeRef<T extends TreeTypes, F extends TreeFeatures>(
    ref: TreeRef<T, F>,
    handle: TreeHandle<T, F> | null,
): void {
    const slot = slotOf(ref);
    if ((slot.handle as unknown) === handle) return;
    slot.handle = handle as unknown as TreeHandle | null;
    for (const listener of [...slot.listeners]) listener();
}

/** @internal calls `listener` when the ref attaches or detaches; returns its remover */
export function subscribeTreeRef<T extends TreeTypes, F extends TreeFeatures>(
    ref: TreeRef<T, F>,
    listener: () => void,
): () => void {
    const { listeners } = slotOf(ref);
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
