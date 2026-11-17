---
"@fragiola/tree-vue": minor
"@fragiola/tree": minor
---

The first release of `@fragiola/tree-vue`: the same `Tree` primitives as `@fragiola/tree-react`
(`Root`, `Items`, `Item`, `ItemContent`, `Group`, `Toggle`, `DropIndicator`, `LiveRegion`) as Vue 3.5 components, with the same ARIA, `data-*`,
`data-tree-part` and `data-tree-path`; `as` and a `render` scoped slot; default scoped slots for
the recursion; `v-model:expanded-item-ids`, `v-model:selected-item-ids` and
`v-model:checked-item-ids`; `typedTree<Types>()`; and the composables `useTree`, `useTreeItem`, `useTreeItemRename`,
`useTreeState`, `useTreeRef` and `createTreeRef`, with the whole core re-exported.

The core's engine gives DOM focus to the focused item's new element when it is registered while
the item's previous element still holds focus (an adapter may attach the new element of a moved
item before it removes the old one).
