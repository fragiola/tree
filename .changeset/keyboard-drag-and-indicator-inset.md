---
"@fragiola/tree": minor
"@fragiola/tree-react": minor
"@fragiola/tree-vue": minor
"@fragiola/tree-angular": minor
---

The known gaps of the drag are fixed. A keyboard drag announces its start and its first target in
one message: the `drag-start` event carries the `target` it starts on (`null` for a pointer drag),
and no `drag-over` follows it in the same tick. It starts next to the dragged item (its own place,
then the place after it, then the nearest valid one), never at the top of the tree when a closer
place exists. And the new `indicatorInset` option (px, on the engine and on every root:
`Tree.Root`, `[treeRoot]`) starts a drop line past its level's inline start, at the label after a
toggle, a grip or padding, with no margin in the indicator's styles.
