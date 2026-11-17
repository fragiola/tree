---
"@fragiola/tree": minor
"@fragiola/tree-react": minor
"@fragiola/tree-vue": minor
"@fragiola/tree-angular": minor
---

Virtualization: a tree renders only the visible items in view, so hundreds of thousands of rows
scroll, move the focus and drag like a few. `createTreeVirtualizer({ rowSize | estimateRowSize,
overscan, scrollElement, initialViewportSize })` is the engine's new `virtual` option and every
root's `virtual` prop or input; `engine.get("virtual-window")` is the window, rendered flat (each
item with its `aria-level`, `aria-posinset` and `aria-setsize`) between `data-tree-part="spacer"`
elements by `Tree.VirtualItems` (React, Vue) and `ng-template[treeVirtualItems]` (Angular), and read
by `useTreeVirtualWindow` / `injectTreeVirtualWindow`. Rows can be measured through the root
window's `ResizeObserver`. Focus, End, type-ahead, the new PageDown and PageUp (virtualized trees
only) and `scroll-to` (which now takes an `align`) reach rows outside the window; a pointer drag
auto-scrolls to them and a keyboard drag scrolls its target into view. The virtualizer is in the
core with no dependency, and a tree without it is unchanged: a bundle that never imports
`createTreeVirtualizer` leaves it out. A focus or a selection on a large tree no longer rebuilds the
visible items and the structure reads.
