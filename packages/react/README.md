# @fragiola/tree-react

Composable React 19 primitives for **Fragiola Tree**, a headless, accessible tree view: file
explorers, outlines, navigation, nested settings and permission pickers, with expand and collapse,
single and multiple selection, the WAI-ARIA keyboard model with type-ahead, drag and drop, async
children, inline rename and tri-state checkboxes.

Fragiola Tree is **headless**. It ships the behaviour, the accessibility and the primitives
(`Tree.Root`, `Items`, `Item`, `ItemContent`, `Group`, `Toggle`, `DropIndicator`, `LiveRegion`,
and `VirtualItems` with the virtualization feature) and the hooks below them (`useTreeItem`, `useTreeItemRename`, …), and **no CSS, no
icons and no text**: you style every part with
`className`, `style` and the `data-*` attributes it exposes, and every visible word and accessible
name comes from you.

Documentation, guides and live examples: **<https://fragiola.com/tree>**.

> The packages are not on npm yet: the documentation describes the upcoming first release.

## Install

```sh
pnpm add @fragiola/tree-react
```

This one package is all a React app installs: it re-exports the whole core (`@fragiola/tree`: the
model, its types, the commands, the engine), so everything is imported from
`@fragiola/tree-react`. It depends on the core at the exact same version. `react` and `react-dom`
**^19** are peer dependencies. ESM only.

## A minimal tree

```tsx
import { type ItemOf, Tree, type TreeJson } from "@fragiola/tree-react";

// what each kind of item holds
type Types = { items: { folder: undefined; file: { size: number } } };

const json: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["src", "readme"],
    items: {
        src: { kind: "folder", label: "src", childItemIds: ["app"] },
        app: { kind: "file", label: "app.ts", data: { size: 120 } },
        readme: { kind: "file", label: "README.md", data: { size: 3 } },
    },
};

// you own the recursion: an item renders its row, then its group of children
function FileItem({ item }: { item: ItemOf<Types> }) {
    return (
        <Tree.Item item={item}>
            <Tree.ItemContent className="row">
                <Tree.Toggle>▸</Tree.Toggle>
                {item.label}
            </Tree.ItemContent>
            <Tree.Group<Types>>{(child) => <FileItem item={child} />}</Tree.Group>
        </Tree.Item>
    );
}

export function App() {
    return (
        <Tree.Root<Types> defaultTree={json} aria-label="Files">
            <Tree.Items<Types>>{(item) => <FileItem item={item} />}</Tree.Items>
        </Tree.Root>
    );
}
```

Indent the rows with the depth every part carries: `padding-inline-start: calc(var(--tree-depth) * 1rem)`.

## Features

The package is a minimal tree and opt-in features, each from its own entry: an app that does not
import a feature does not ship it.

| feature | entry |
| --- | --- |
| `selection(options?)`: the selected items, the selection keys and clicks, `aria-selected` | `@fragiola/tree-react/selection` |
| `virtualization(options?)`: a window of the rows in view, rendered by `VirtualItems` | `@fragiola/tree-react/virtualization` |

```ts
import { createTreeModel } from "@fragiola/tree-react";
import { selection } from "@fragiola/tree-react/selection";

const features = [selection()] as const;
const model = createTreeModel<Types, typeof features>(json, { features });
```

The guide is <https://fragiola.com/tree/docs/concepts/features>.

## The model and the engine

`Tree.Root` takes a `model` (`createTreeModel<Types>(json)`) or a `defaultTree` it keeps. Every
change is a command through the model (`model.run("item.expand", { itemId })`), so middleware
(`model.use`) and listeners (`model.subscribe`) see what a key, a click or a drop does. The engine
of the tree on screen (DOM focus, keys, drags, the async loader) is the root's.

- `useTree<Types>()`: `{ model, engine }` of the enclosing root.
- `useTreeItem(item)`: `{ state, props }` of an item, to build one on any element.
- `useTreeState(selector, { model? })`: a value of the state, re-rendering when it changes.
- `useTreeRef<Types>()` / `createTreeRef<Types>()`: the root's `{ model, engine }` from outside it
  (`<Tree.Root treeRef={tree}>`).

## The primitive contract

Every primitive takes `render` (an element, or `(props, state) => element`; never `asChild`), a
`ref` as a plain prop, any other prop of its element (handlers are composed, the primitive's
first), and `className` / `style` as a value or a function of its state. State is exposed through
ARIA and `data-*` attributes, present or absent (`data-expanded`, `data-selected`, `data-checked`,
`data-indeterminate`, `data-renaming`, `data-loading`, `data-dragging`, `data-drop-target`, …).
Every element carries `data-tree-part` (`root`, `item`, `content`, `group`, …), and every item
`data-tree-path` (`/0/2`), for tests and tooling.

MIT licensed, see [LICENSE](LICENSE).
