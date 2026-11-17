---
"@fragiola/tree": minor
"@fragiola/tree-react": minor
"@fragiola/tree-vue": minor
"@fragiola/tree-angular": minor
---

Checks and rename without elements of the package's own. `Tree.Checkbox` and `Tree.RenameInput`
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
