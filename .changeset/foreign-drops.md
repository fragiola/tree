---
"@fragiola/tree": minor
"@fragiola/tree-react": minor
"@fragiola/tree-vue": minor
"@fragiola/tree-angular": minor
---

Foreign drops and drops outside the tree, both opt-in. `createTreeForeignDrop({ accept, onDrop })`
is the engine's new `foreignDrop` option (every root's `foreignDrop` prop or input): files, links
and text dragged on the tree from the desktop or another window show their target as a tree drag
does (indicator, `data-drop-target`, auto-expansion, auto-scroll, virtualized or not); `accept`
decides from the drag's types, once per target, and `onDrop` gets the `DataTransfer` and the target
to run the app's commands (the package reads no file and makes no network call). The roots forward
the native `dragenter`, `dragover`, `dragleave` and `drop` events (`engine.adapter.handleDragEvent`).
`createTreeDropOutside({ onDrop })` is the new `dropOutside` option: a pointer drag of the tree's
items released outside every tree of its group goes to `onDrop` with the element under the pointer,
and `engine.get("drop-outside-element")` lets the app's own targets show the drag. New
announcements `foreign-drag-over`, `foreign-drop` and `drop-outside`. Both are tree-shaken out of an
app that does not import their factories. New example: `file-drop`.
