---
"@fragiola/tree": minor
"@fragiola/tree-react": minor
"@fragiola/tree-vue": minor
"@fragiola/tree-angular": minor
---

Drag between trees: the engine's new `dragGroup` option (every root's `dragGroup` prop or input)
joins the trees of one document with the same group name, and items drag between them with the
pointer or the keyboard (whose Down and Up go on through the group's trees in document order). The
tree under the pointer shows its own target, indicator, auto-expansion and auto-scroll, virtualized
or not. Over one model a drop is one `item.move`; over two it is a transfer: the target model adds
the dragged subtrees (one `batch` of `item.add`, ids and expansion kept) and the source model
removes them (`item.remove`), each through its own middleware, and a target the models refuse never
shows. The new `transfer` option replaces it (copy, convert kinds, refuse; asked with `dryRun` for
each target, with the drop's modifier keys). Announcements carry `targetTree`, the engine answers
`is("dragging-from-other-tree")`, and the roots carry `data-dragging-from-other-tree` (and
`draggingFromOtherTree` in their state). A tree without a group is unchanged. New example:
`two-trees`.
