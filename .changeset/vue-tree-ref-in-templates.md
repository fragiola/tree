---
"@fragiola/tree-vue": patch
---

`<Tree.Root :tree-ref="tree">` works in a template. A Vue template unwraps a top-level ref, so the
root received the handle (or `null`) instead of the tree ref and failed once mounted. `TreeRef<T>`
is no longer a Vue `ShallowRef`: it is a plain object whose read-only `value` is reactive (the
root's `TreeHandle` while it is mounted, `null` otherwise), so a template passes it as it is and
reads `tree.value`, as a script does. `createTreeRef` and `useTreeRef` keep their names; a ref of
the app's own given as `tree-ref` is refused with an error naming them.
