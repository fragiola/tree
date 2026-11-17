import type { VirtualWindow } from "@fragiola/tree";
import { type ComputedRef, computed } from "vue";
import { useTreeContext } from "../context";

/**
 * The rows the enclosing `Tree.Root` renders when it is virtualized (its `virtual` prop): each
 * visible item in view plus the overscan, with its offset, size and the spacer before it, and the
 * space after the last one. `null` before the root is mounted, and without `virtual`.
 * `Tree.VirtualItems` renders it; read it to render the rows your own way. Call it in `setup`.
 *
 * ```ts
 * const window = useTreeVirtualWindow();
 * // window.value?.rows
 * ```
 */
export function useTreeVirtualWindow(): ComputedRef<VirtualWindow | null> {
    const { engine, state, revision } = useTreeContext("useTreeVirtualWindow");
    return computed(() => {
        // the window changes with the tree and with the engine's revision (a scroll, a measure)
        state.value;
        revision.value;
        return engine.value?.get("virtual-window") ?? null;
    });
}
