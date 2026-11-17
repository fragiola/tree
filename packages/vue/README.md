# @fragiola/tree-vue

Composable Vue 3 primitives for **Fragiola Tree**, a headless, accessible tree view: file
explorers, outlines, navigation, nested settings and permission pickers, with expand and collapse,
single and multiple selection, the WAI-ARIA keyboard model with type-ahead, drag and drop, async
children, inline rename and tri-state checkboxes.

Fragiola Tree is **headless**. It ships the behaviour, the accessibility and the primitives
(`Tree.Root`, `Items`, `Item`, `ItemContent`, `Group`, `Toggle`, `Checkbox`, `RenameInput`,
`DropIndicator`, `LiveRegion`), and **no CSS, no icons and no text**: you style every part with
`class`, `style` and the `data-*` attributes it exposes, and every visible word and accessible name
comes from you. The primitives, their ARIA and their `data-*` are the same as
`@fragiola/tree-react`'s.

Documentation, guides and live examples: **<https://fragiola.com/tree>**.

> The packages are not on npm yet: the documentation describes the upcoming first release.

## Install

```sh
pnpm add @fragiola/tree-vue
```

This one package is all a Vue app installs: it re-exports the whole core (`@fragiola/tree`: the
model, its types, the commands, the engine), so everything is imported from `@fragiola/tree-vue`.
It depends on the core at the exact same version. `vue` **^3.5** is a peer dependency. ESM only.

## A minimal tree

```ts title="tree.ts"
import { typedTree } from "@fragiola/tree-vue";

// what each kind of item holds
export type Types = { items: { folder: undefined; file: { size: number } } };
// the primitives typed by the registry: a slot's `item.data` narrows on `item.kind`
export const Tree = typedTree<Types>();
```

```vue title="file-item.vue"
<script setup lang="ts">
import type { ItemOf } from "@fragiola/tree-vue";
import { Tree, type Types } from "./tree";

defineProps<{ item: ItemOf<Types> }>();
</script>

<template>
    <!-- you own the recursion: an item renders its row, then its group of children -->
    <Tree.Item :item="item">
        <Tree.ItemContent class="row">
            <Tree.Toggle>▸</Tree.Toggle>
            {{ item.label }}
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }">
            <FileItem :item="child" />
        </Tree.Group>
    </Tree.Item>
</template>
```

```vue title="app.vue"
<script setup lang="ts">
import type { TreeJson } from "@fragiola/tree-vue";
import FileItem from "./file-item.vue";
import { Tree, type Types } from "./tree";

const json: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["src", "readme"],
    items: {
        src: { kind: "folder", label: "src", childItemIds: ["app"] },
        app: { kind: "file", label: "app.ts", data: { size: 120 } },
        readme: { kind: "file", label: "README.md", data: { size: 3 } },
    },
};
</script>

<template>
    <Tree.Root :default-tree="json" aria-label="Files">
        <Tree.Items v-slot="{ item }"><FileItem :item="item" /></Tree.Items>
    </Tree.Root>
</template>
```

Indent the rows with the depth every part carries: `padding-inline-start: calc(var(--tree-depth) * 1rem)`.

## The model and the engine

`Tree.Root` takes a `model` (`createTreeModel<Types>(json)`; another model remounts the tree) or a
`default-tree` it keeps. Expansion, selection and checks can be controlled with
`v-model:expanded-item-ids`, `v-model:selected-item-ids` and `v-model:checked-item-ids`. Every
change is a command through the model (`model.run("item.expand", { itemId })`), so middleware
(`model.use`) and listeners (`model.subscribe`) see what a key, a click or a drop does. The engine
of the tree on screen (DOM focus, keys, drags, the async loader) is the root's. Keep the model out
of Vue's reactivity: never put it in `ref()` or `reactive()`.

- `useTree<Types>()`: `{ model, engine }` of the enclosing root.
- `useTreeItem(item)`: `{ state, props }` of an item, as computed refs, to build one on any element.
- `useTreeState(selector, { model? })`: a read-only ref of a value of the state.
- `useTreeRef<Types>()` / `createTreeRef<Types>()`: the root's `{ model, engine }` from outside it
  (`<Tree.Root :tree-ref="tree">`, then `tree.value`).

## The primitive contract

Every primitive takes `as` (a tag or a component) and a `render` scoped slot
(`#render="{ props, state, children }"`; never `asChild`), and forwards every other attribute to
its element (listeners are composed, the primitive's first; `class` and `style` are merged under
its structural style). Collection parts render their default scoped slot per item
(`v-slot="{ item }"`). State is exposed through ARIA and `data-*` attributes, present or absent
(`data-expanded`, `data-selected`, `data-checked`, `data-indeterminate`, `data-renaming`,
`data-loading`, `data-dragging`, `data-drop-target`, …). Every element carries `data-tree-part`
(`root`, `item`, `content`, `group`, …), and every item `data-tree-path` (`/0/2`), for tests and
tooling.

MIT licensed, see [LICENSE](LICENSE).
