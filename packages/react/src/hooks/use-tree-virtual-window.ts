import type { VirtualWindow } from "@fragiola/tree";
import { useTreeContext } from "../context";

/**
 * The rows the enclosing `Tree.Root` renders when it is virtualized (its `virtual` prop): each
 * visible item in view plus the overscan, with its offset, size and the spacer before it, and the
 * space after the last one. `null` before the root is mounted, and without `virtual`.
 * `Tree.VirtualItems` renders it; read it to render the rows your own way.
 *
 * ```tsx
 * const window = useTreeVirtualWindow();
 * return <span>{window?.rows.length ?? 0} rows rendered</span>;
 * ```
 */
export function useTreeVirtualWindow(): VirtualWindow | null {
    const { engine } = useTreeContext("useTreeVirtualWindow");
    // the context's revision re-renders this hook's component when the window changes
    return engine?.get("virtual-window") ?? null;
}
