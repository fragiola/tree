---
"@fragiola/tree-react": minor
"@fragiola/tree": minor
---

The first release of `@fragiola/tree-react`: the `Tree` namespace of headless, composable
primitives (`Root`, `Items`, `Item`, `ItemContent`, `Group`, `Toggle`, `Checkbox`, `RenameInput`,
`DropIndicator`, `LiveRegion`) under the Fragiola primitive contract, and the hooks below them
(`useTree`, `useTreeItem`, `useTreeState`, `useTreeRef`, `createTreeRef`), with the whole core
re-exported. `Tree.Root` takes a model or a `defaultTree`, controlled or uncontrolled expansion,
selection and checks (mapped onto commands), and the engine's options.

The core's engine takes `resetLoadsOnDestroy`: `destroy()` puts the items it was loading back to
`unloaded`, so a tree that remounts loads them again.

A control inside an item's row (a button, a link, an input: the `DRAG_EXEMPT` elements) keeps its
keys: the engine no longer selects or toggles the item when Enter or Space is pressed on it.
