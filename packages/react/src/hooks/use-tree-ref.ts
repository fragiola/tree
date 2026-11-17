import type { AnyTypes, TreeTypes } from "@fragiola/tree";
import * as React from "react";
import {
    createTreeRef,
    subscribeTreeRef,
    type TreeRef,
} from "./create-tree-ref";

/**
 * A tree ref kept by this component, which re-renders when the `Tree.Root` it is given to mounts
 * or unmounts: read `tree.current` in render (a toolbar next to the tree) or in handlers.
 *
 * ```tsx
 * const tree = useTreeRef<Types>();
 * <button onClick={() => tree.current?.model.run("tree.collapse-all", {})}>Collapse</button>
 * <Tree.Root treeRef={tree} defaultTree={json}>…</Tree.Root>
 * ```
 */
export function useTreeRef<T extends TreeTypes = AnyTypes>(): TreeRef<T> {
    const [ref] = React.useState(() => createTreeRef<T>());
    const subscribe = React.useCallback(
        (onChange: () => void) => subscribeTreeRef(ref, onChange),
        [ref],
    );
    const snapshot = () => ref.current;
    React.useSyncExternalStore(subscribe, snapshot, () => null);
    return ref;
}
