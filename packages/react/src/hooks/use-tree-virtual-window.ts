import type { VirtualWindow } from "@fragiola/tree";
import { useTreeContext } from "../context";

/**
 * The rows the enclosing `Tree.Root` renders when its model has the virtualization feature
 * (`virtualization(options)`): each visible item in view plus the overscan, with its offset, size
 * and the spacer before it, and the space after the last one. `null` before the root is mounted,
 * and without the feature.
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
    // the virtualization feature's key: undefined on an engine without it
    const virtual = engine as {
        get(key: "virtual-window"): VirtualWindow | null | undefined;
    } | null;
    return virtual?.get("virtual-window") ?? null;
}
