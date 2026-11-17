---
"@fragiola/tree": minor
"@fragiola/tree-react": minor
"@fragiola/tree-vue": minor
"@fragiola/tree-angular": minor
---

Checkboxes, rename, async children and type-ahead are opt-in features, each from its own entry:
`checkboxes({ mode, space })` (`@fragiola/tree/checkboxes`), `rename({ renamable })` (`/rename`),
`asyncChildren()` (`/async-children`) and `typeAhead({ timeout })` (`/type-ahead`), mirrored in
every adapter. A tree that never imports them does not ship them. Breaking (nothing is released
yet): without them a tree has no checks, never renames, has no children from a loader and leaves
typed characters alone, and a document with their fields (`checkedItemIds`, `settings.checkMode`,
`renamingItemId`, `settings.renamable`, an item's `renamable` or `childrenStatus`) loads only with
the feature installed. The engine's and the roots' `checkboxes` and `typeAheadTimeout` options are
gone (Space checks with `checkboxes()` when the tree has no `selection()`, or with
`space: "check"`; the delay is `typeAhead({ timeout })`); `checkedItemIds` and `loadChildren` are
the features' root props, typed only when they are installed. `useTreeItemRename` moves to
`@fragiola/tree-react/rename` and `@fragiola/tree-vue/rename`, and `input[treeItemRename]`
(`TreeItemRenameDirective`) to `@fragiola/tree-angular/rename`, out of `TREE`.
