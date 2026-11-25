# @fragiola/tree-angular

## 0.1.1

### Patch Changes

- Updated dependencies [[`680fba9`](https://github.com/fragiola/tree/commit/680fba9c06decbdea6c4724b8b0856bfd4e39c17)]:
  - @fragiola/tree@0.1.1

## 0.1.0

### Minor Changes

- [#18](https://github.com/fragiola/tree/pull/18) [`b63e3fc`](https://github.com/fragiola/tree/commit/b63e3fc30037895ee4801f71a6e6294a36e95a47) Thanks [@maurodesouza](https://github.com/maurodesouza)! - `@fragiola/tree-angular`: the Tree primitives as Angular standalone directives on your own elements (`[treeRoot]`, `ng-template[treeItems]`, `[treeItem]`, `[treeItemContent]`, `[treeGroup]`, `[treeToggle]`, `input[treeItemRename]`, `[treeDropIndicator]`, `[treeLiveRegion]`, the `TREE` array), the injection functions (`injectTree`, `injectTreeItem`, `injectTreeState`) and the whole core re-exported. Signals, zoneless, two-way `[(expandedItemIds)]`, `[(selectedItemIds)]` and `[(checkedItemIds)]`; the same ARIA and `data-*` as the React and Vue adapters.

- [#63](https://github.com/fragiola/tree/pull/63) [`f3f5599`](https://github.com/fragiola/tree/commit/f3f559938f0f5386d9e6d78c2d0161e9342ee8c4) Thanks [@maurodesouza](https://github.com/maurodesouza)! - Checks and rename without elements of the package's own. `Tree.Checkbox` and `Tree.RenameInput`
  (`[treeCheckbox]` and `input[treeRenameInput]` in Angular) are gone. An item's check is your own
  control: it reads the item's state (`useTreeItem(item).state.checked`, `indeterminate`) and runs
  `model.run("item.toggle-check", { itemId })`, while the item keeps `aria-checked`, Space and
  `data-checked` / `data-indeterminate`. A native `button` or `input` never starts a drag or a
  selection; any other element needs `data-tree-no-drag`. An item's label editor is your own input,
  wired by the part hook `useTreeItemRename(item)` (React and Vue; `input[treeItemRename]` in
  Angular), which returns `{ state, props }` with the old input's behaviour. You can also wire it by
  hand with the engine's new public actions `engine.run("commit-rename", { itemId, label, focus? })`
  and `engine.run("cancel-rename", { itemId, focus? })`. Both return focus to the item.
  `engine.adapter` loses `commitRename`, `cancelRename` and `handleCheckboxClick`, and
  `data-tree-part` loses `checkbox` and `rename-input`.

- [#37](https://github.com/fragiola/tree/pull/37) [`6a681f6`](https://github.com/fragiola/tree/commit/6a681f6a5657e7b67ea82e038a6adcc2b3c1a3e7) Thanks [@maurodesouza](https://github.com/maurodesouza)! - Drag between trees: the engine's new `dragGroup` option (every root's `dragGroup` prop or input)
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

- [#66](https://github.com/fragiola/tree/pull/66) [`5d5bcc5`](https://github.com/fragiola/tree/commit/5d5bcc570b4d85272733e373efd5e65948858f0d) Thanks [@maurodesouza](https://github.com/maurodesouza)! - Drag and drop and its extensions are opt-in features, each from its own entry: `dragAndDrop({
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

- [#38](https://github.com/fragiola/tree/pull/38) [`297bcef`](https://github.com/fragiola/tree/commit/297bcefd927de6faab77c83d308dee2ec883dbbd) Thanks [@maurodesouza](https://github.com/maurodesouza)! - Foreign drops and drops outside the tree, both opt-in. `createTreeForeignDrop({ accept, onDrop })`
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

- [#35](https://github.com/fragiola/tree/pull/35) [`5b7a2ff`](https://github.com/fragiola/tree/commit/5b7a2ffb6e365c21be74086c081f7a977643aa32) Thanks [@maurodesouza](https://github.com/maurodesouza)! - The known gaps of the drag are fixed. A keyboard drag announces its start and its first target in
  one message: the `drag-start` event carries the `target` it starts on (`null` for a pointer drag),
  and no `drag-over` follows it in the same tick. This changes what `announce` receives: an app that
  read a keyboard drag's first place from the `drag-over` right after the start now reads `drag-
  start`'s `target`. A keyboard drag starts next to the dragged items (the first of them on screen:
  its own place, then the place after it, then the nearest valid one), never at the top of the tree
  when a closer place exists. And the new `indicatorInset` option (px, on the engine and on every
  root: `Tree.Root`, `[treeRoot]`) starts a drop line past its level's inline start, at the label
  after a toggle, a grip or padding, with no margin in the indicator's styles.

- [#64](https://github.com/fragiola/tree/pull/64) [`c826903`](https://github.com/fragiola/tree/commit/c826903d6647684cc6d895889e33057345daf84a) Thanks [@maurodesouza](https://github.com/maurodesouza)! - **Breaking:** a minimal core and opt-in features. A model takes its features once,
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
  - New in the core: `model.get("features")`, `model.get("item-attributes-by")` / `get("root-attributes")` (the features' ARIA and `data-*`, model state), the
    feature contract (`TreeFeature`, …), `TREE_ROOT_PROPS` and `FEATURE_ROOT_PROPS`. A root warns
    once when its `features` change after it created its model, or when a feature's prop is given
    without the feature.

- [#65](https://github.com/fragiola/tree/pull/65) [`fc23656`](https://github.com/fragiola/tree/commit/fc23656eedb3c054369112abd8772da0e48fd76e) Thanks [@maurodesouza](https://github.com/maurodesouza)! - Checkboxes, rename, async children and type-ahead are opt-in features, each from its own entry:
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

- [#36](https://github.com/fragiola/tree/pull/36) [`ac68405`](https://github.com/fragiola/tree/commit/ac68405d0d2c87df03dfdd5a43451db7c4dbee38) Thanks [@maurodesouza](https://github.com/maurodesouza)! - Virtualization: a tree renders only the visible items in view, so hundreds of thousands of rows
  scroll, move the focus and drag like a few. The virtualization feature, `virtualization({ rowSize | estimateRowSize,
  overscan, scrollElement, initialViewportSize })` from `@fragiola/tree/virtualization`, installed in
  the model's features; `engine.get("virtual-window")` is the window, rendered flat (each item with its
  `aria-level`, `aria-posinset` and `aria-setsize`) between `data-tree-part="spacer"` elements by
  `VirtualItems` (React, Vue) and `ng-template[treeVirtualItems]` (Angular), from each adapter's
  `/virtualization` entry, and read by `useTreeVirtualWindow` / `injectTreeVirtualWindow`. Rows can be measured through the root
  window's `ResizeObserver`. Focus, End, type-ahead, the new PageDown and PageUp (virtualized trees
  only) and `scroll-to` (which now takes an `align`) reach rows outside the window; a pointer drag
  auto-scrolls to them and a keyboard drag scrolls its target into view. The virtualizer is in the
  core with no dependency, and a tree without it is unchanged: a bundle that never imports the
  feature's entry leaves it out. A focus or a selection on a large tree no longer rebuilds the
  visible items and the structure reads.

### Patch Changes

- Updated dependencies [[`f3f5599`](https://github.com/fragiola/tree/commit/f3f559938f0f5386d9e6d78c2d0161e9342ee8c4), [`6a681f6`](https://github.com/fragiola/tree/commit/6a681f6a5657e7b67ea82e038a6adcc2b3c1a3e7), [`5d5bcc5`](https://github.com/fragiola/tree/commit/5d5bcc570b4d85272733e373efd5e65948858f0d), [`19c0c27`](https://github.com/fragiola/tree/commit/19c0c2716e2314207c159ade93d1d016636d0137), [`297bcef`](https://github.com/fragiola/tree/commit/297bcefd927de6faab77c83d308dee2ec883dbbd), [`5b7a2ff`](https://github.com/fragiola/tree/commit/5b7a2ffb6e365c21be74086c081f7a977643aa32), [`c826903`](https://github.com/fragiola/tree/commit/c826903d6647684cc6d895889e33057345daf84a), [`2ea8ccb`](https://github.com/fragiola/tree/commit/2ea8ccb9fb67a6dbaf1ed329256f927b02e03106), [`fc23656`](https://github.com/fragiola/tree/commit/fc23656eedb3c054369112abd8772da0e48fd76e), [`ac68405`](https://github.com/fragiola/tree/commit/ac68405d0d2c87df03dfdd5a43451db7c4dbee38), [`f944e91`](https://github.com/fragiola/tree/commit/f944e91b0feed8c1b0b6ff49832cd6b4291c343c)]:
  - @fragiola/tree@0.1.0
