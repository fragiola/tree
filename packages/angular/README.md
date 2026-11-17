# @fragiola/tree-angular

Composable Angular directives for **Fragiola Tree**, a headless, accessible tree view: file
explorers, outlines, navigation, nested settings and permission pickers, with expand and collapse,
single and multiple selection, the WAI-ARIA keyboard model with type-ahead, drag and drop, async
children, inline rename and tri-state checkboxes.

Fragiola Tree is **headless**. It ships the behaviour, the accessibility and the primitives, here
standalone attribute directives you put on your own elements (`[treeRoot]`, `treeItems`,
`[treeItem]`, `treeItemContent`, `treeGroup`, `treeToggle`, `treeCheckbox`, `treeRenameInput`,
`treeDropIndicator`, `treeLiveRegion`), and **no CSS, no icons and no text**: you style every
element with `class`, `style` and the `data-*` attributes the directives set, and every visible
word and accessible name comes from you. The ARIA and the `data-*` are the same as
`@fragiola/tree-react`'s and `@fragiola/tree-vue`'s.

Documentation, guides and live examples: **<https://fragiola.com/tree>**.

> The packages are not on npm yet: the documentation describes the upcoming first release.

## Install

```sh
pnpm add @fragiola/tree-angular
```

This one package is all an Angular app installs: it re-exports the whole core (`@fragiola/tree`:
the model, its types, the commands, the engine), so everything is imported from
`@fragiola/tree-angular`. It depends on the core at the exact same version. `@angular/core`
**^22** is a peer dependency. Signals, zoneless, ESM only (the Angular Package Format).

## A minimal tree

```ts
import { Component } from "@angular/core";
import { createTreeModel, TREE, type TreeJson } from "@fragiola/tree-angular";

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

@Component({
    selector: "app-files",
    imports: [TREE],
    template: `
        <div [treeRoot]="model" aria-label="Files">
            <!-- you own the recursion: one template renders an item, its row and its group -->
            <ng-template [treeItems]="model" let-item>
                <div [treeItem]="item">
                    <div treeItemContent class="row">
                        <span treeToggle>▸</span>
                        {{ item.label }}
                    </div>
                    <!-- a group with no template of its own renders with this one -->
                    <div treeGroup></div>
                </div>
            </ng-template>
        </div>
    `,
})
export class Files {
    readonly model = createTreeModel<Types>(json);
}
```

Indent the rows with the depth every part carries: `padding-inline-start: calc(var(--tree-depth) * 1rem)`.

## The model and the engine

`[treeRoot]` takes a model (`createTreeModel<Types>(json)`; another model makes another engine) or
a `[defaultTree]` it keeps. Expansion, selection and checks can be controlled with
`[(expandedItemIds)]`, `[(selectedItemIds)]` and `[(checkedItemIds)]` (a one-way binding the app
does not update reverts the change). Every change is a command through the model
(`model.run("item.expand", { itemId })`), so middleware (`model.use`) and listeners
(`model.subscribe`) see what a key, a click or a drop does. The engine of the tree on screen (DOM
focus, keys, drags, the async loader) is the root's.

- `injectTree<Types>()`: `{ model, engine }` of the enclosing root (`model` is a signal).
- `injectTreeItem<Types>()`: `{ item, state }` of the enclosing `[treeItem]`, as signals.
- `injectTreeState(selector, { model? })`: a signal of a value of the state.
- `#tree="treeRoot"`: the root's `model()` and `engine` from anywhere in the template (or
  `viewChild(TreeRootDirective)`); `#node="treeItem"`: an item's `state()`.

## The primitive contract

Each directive goes on your element (the element replaces React's `render`, never `asChild`):
it sets its role, ARIA, `data-*` and listeners through host bindings, and only structural inline
style (`--tree-depth`, the drop indicator's position, `display: none` on what is not shown), which
wins over your static `style` and leaves its other keys alone. `<ng-template treeItems let-item>`
replaces children functions; `[treeItems]="model"` types the template's `item` by the registry
(`item.data` narrows on `item.kind`). State is exposed through ARIA and `data-*` attributes,
present or absent (`data-expanded`, `data-selected`, `data-checked`, `data-indeterminate`,
`data-renaming`, `data-loading`, `data-dragging`, `data-drop-target`, …), and each directive's
`state()` through `exportAs`. Every element carries `data-tree-part` (`root`, `item`, `content`,
`group`, …), and every item `data-tree-path` (`/0/2`), for tests and tooling.

MIT licensed, see [LICENSE](LICENSE).
