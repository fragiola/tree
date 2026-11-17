---
"@fragiola/tree": minor
"@fragiola/tree-react": minor
"@fragiola/tree-vue": minor
"@fragiola/tree-angular": minor
---

Drag and drop and its extensions are opt-in features, each from its own entry: `dragAndDrop({
dragThreshold, autoExpandDelay, indentation, indicatorInset, autoScroll })`
(`@fragiola/tree/drag-and-drop`), `dragGroup({ name, transfer })` (`/drag-group`),
`foreignDrop({ accept, onDrop, dropEffect })` (`/foreign-drop`) and `dropOutside({ onDrop })`
(`/drop-outside`), mirrored in every adapter. A tree that never imports them does not ship them.
Breaking (nothing is released yet): without `dragAndDrop()` a tree never drags; `dragGroup()` and
`dropOutside()` need it, `foreignDrop()` does not. `createTreeForeignDrop` and
`createTreeDropOutside` are replaced by the features, and the engine's and the roots'
`dragThreshold`, `autoExpandDelay`, `indentation`, `indicatorInset`, `autoScroll`, `dragGroup`,
`transfer`, `foreignDrop` and `dropOutside` options are gone (they are the features' options; a
drag group is its model's). `Tree.DropIndicator` moves to `DropIndicator` from
`@fragiola/tree-react/drag-and-drop` and `@fragiola/tree-vue/drag-and-drop` (and `/foreign-drop`),
and `[treeDropIndicator]` (`TreeDropIndicatorDirective`) to `@fragiola/tree-angular/drag-and-drop`,
out of `TREE`. The adapters forward native drag events only with `foreignDrop()`. `item.move` and
the `movable` / `droppable` flags stay in the core.
