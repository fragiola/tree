---
"@fragiola/tree": minor
"@fragiola/tree-react": minor
"@fragiola/tree-vue": minor
"@fragiola/tree-angular": minor
---

**Breaking:** a minimal core and opt-in features. A model takes its features once,
`createTreeModel(json, { features: [selection(), virtualization(options)] })` (or a root's
`features` prop/input with `defaultTree`), each from its own entry, so a bundle that never imports a
feature does not carry it (`pnpm build` checks every package's main entry).

- **Selection is a feature**: `selection({ mode })` from `@fragiola/tree/selection` (and
  `@fragiola/tree-react/selection`, `-vue/selection`, `-angular/selection`) owns `selectedItemIds`,
  `selectionAnchorItemId`, `settings.selectionMode`, `item.select`, `tree.select`,
  `tree.select-all`, `tree.clear-selection`, `"selected-items"`, `"item-selected"`, the keys and
  clicks that select, `aria-selected`, `data-selected`, `aria-multiselectable` and the
  `selectedItemIds` prop. A tree without it selects nothing; its commands return `not_found` and
  do not compile, and a document with its fields does not load (`requires the selection
  feature`). `DEFAULT_SETTINGS` loses `selectionMode`.
- **`createTreeVirtualizer` is replaced** by `virtualization(options)` from
  `@fragiola/tree/virtualization`; the engine's and the roots' `virtual` option is gone.
  `Tree.VirtualItems`, `useTreeVirtualWindow`, `ng-template[treeVirtualItems]` and
  `injectTreeVirtualWindow` move to `@fragiola/tree-<framework>/virtualization` (`VirtualItems`,
  `typedVirtualItems<Types>()` in Vue, `TreeVirtualItemsDirective` in Angular, out of `TREE`).
- The model, the engine, the roots, the hooks, the refs and `typedTree` take the features as a type
  argument (`TreeModel<T, F>`, `useTreeState(selector, { model })` infers them); a feature's
  command, key, state field or root prop compiles only when it is installed.
- New in the core: `model.get("features")`, `engine.adapter.itemAttributes` / `rootAttributes`, the
  feature contract (`TreeFeature`, …), `TREE_ROOT_PROPS` and `FEATURE_ROOT_PROPS`. A root warns
  once when its `features` change after it created its model, or when a feature's prop is given
  without the feature.
