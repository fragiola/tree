import type { AnyTypes, TreeFeatures, TreeTypes } from "@fragiola/tree";
import { createTreeRef, type TreeRef } from "./create-tree-ref";

/**
 * A tree ref for this component: pass it as a `Tree.Root`'s `tree-ref`, and read `tree.value` in
 * the template (a toolbar next to the tree, which re-renders when the root mounts) or in handlers.
 * A template does not unwrap a tree ref: it reads `tree.value`, as a script does.
 *
 * ```vue
 * <script setup lang="ts">
 * const tree = useTreeRef<Types>();
 * </script>
 * <template>
 *     <button :disabled="!tree.value" @click="tree.value?.model.run('tree.collapse-all', {})">
 *         Collapse
 *     </button>
 *     <Tree.Root :tree-ref="tree" :default-tree="json">…</Tree.Root>
 * </template>
 * ```
 */
export function useTreeRef<
    T extends TreeTypes = AnyTypes,
    F extends TreeFeatures = readonly [],
>(): TreeRef<T, F> {
    return createTreeRef<T, F>();
}
