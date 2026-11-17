# Examples

Each folder is one example of the site's gallery (`fragiola.com/tree/examples/<folder>`), rendered
alone by this app at `index.html?id=<folder>`.

```
src/examples/
  <slug>/index.tsx     the example (default export, "use client")
  <slug>/styles.ts     how it looks: one class string (or state function) per part
  <slug>/*.ts(x)       optional sibling files, shown in the code panel
  _kit/                shared demo content and app logic (the demo trees, the fake loader,
                       persistence, undo/redo); no tree assembly, no styles
```

What every framework's examples share, and no reader copies, lives once in `examples/shared`
(`examples-shared`, private), so a Vue or Angular app of the same examples reuses it:

```
examples/shared/
  src/meta/<slug>.ts   each example's metadata: title, description, category, order, features,
                       docs link, layout, height (one file per example, for every framework)
  src/meta-types.ts    its shape, the categories and the default heights
  src/themes/          the two themes, light and dark (one CSS file each, values only) and their list
  src/embed/messages.ts  the embed's messages to the site (`fragiola:example:*`)
  scripts/             the examples finder, the manifest builder, the loader generator
  e2e/                 every Playwright spec (smoke, themes, iframe, examples/<slug>.spec.ts),
                       run against each framework's embed (`examplesE2eConfig`)
  tests/               the metadata, themes, contrast and e2e-helper checks
```

## The examples

The ids are final: Vue and Angular port every one, with the same id.

| category | examples |
|---|---|
| `getting-started` | `hello-tree` (the smallest tree), `file-explorer` |
| `selection` | `multi-select`, `checkboxes` |
| `editing` | `rename`, `drag-and-drop` |
| `data` | `async-loading`, `controlled`, `save-restore` |
| `model-api` | `undo-redo`, `command-console` |
| `accessibility` | `keyboard`, `rtl` |

## Adding an example

1. Create `src/examples/<slug>/index.tsx` and `styles.ts`, and its metadata in
   `examples/shared/src/meta/<slug>.ts` (see `meta-types.ts`).
2. `pnpm dev` at the root lists it in the playground (`apps/playground`), with hot reload, both
   themes and its source: `http://localhost:5173/?example=<slug>`. The embed alone is
   `pnpm --filter examples-react dev` (`http://localhost:5183/?id=<slug>`);
   `pnpm site:dev --base /tree --port 5183` serves it the way the site proxies it.
3. The smoke e2e visits it in both themes, and inside an iframe. Add a spec for its main behaviour
   in `examples/shared/e2e/examples/<slug>.spec.ts`: it reaches the example only through
   `data-tree-part`, `data-tree-path`, roles, accessible names and test ids, so every framework's
   embed runs it unchanged.

## Anatomy of an example

A reader opens `index.tsx` and sees the logic first: the tree's JSON, how the primitives are
assembled, which commands run. How it looks is one click away, in `styles.ts`. `hello-tree` is the
reference: the recursion (`Item`, which renders `Tree.Group` with itself) is a function in the
same file, below the default export.

- **`index.tsx` renders `<Tree.Root>`** and the items under it. Parts may be components in the
  same file or in sibling files of the same folder, never in a shared module: `_kit/` holds no
  tree assembly (`tests/examples.test.ts`).
- **Classes in `styles.ts`**, beside `index.tsx`: one `const` per styled part, named after it
  (`root`, `item`, `row`, `toggle`, `checkbox`, `dropIndicator`, …), a class string or a function
  of the part's state. No `.tsx` file of an example holds a class string or calls `cn()`.
- **Classes are complete literals**: Tailwind reads the source, so map a value to a full class.
- **The indentation** is `--tree-depth` (set on every part of an item) times the theme's
  `--tr-indent`: `ps-[calc(var(--tree-depth)*var(--tr-indent)+0.25rem)]`.
- **State through `data-*` and ARIA**: style a row's own state (`data-selected:`), never an
  ancestor's (`in-data-selected:` would also match every nested row).

## Rules

- **Copyable imports only**: `react`, `@fragiola/tree-react` (the core included: an app installs
  that one package), `lucide-react`, Fragiola UI (`#/components/ui/*`, `#/components/atoms/*`,
  `#/lib/cn`, `#/hooks/*`), and relative files inside `src/examples/`. `tests/examples.test.ts`
  enforces it.
- **Theme-agnostic**: palette roles (`bg-palette-base`, …) and the theme tokens (`--tr-*`), never
  fixed colours, so the example works in both themes.
- **Through the model**: every change is a command (`model.run("item.rename", …)`), which
  middleware (`model.use`) can veto or rewrite; screen actions are the engine's
  (`engine.run("focus", { itemId })`). An example never reaches `engine.adapter`.
- **Typed data**: each example declares its `Types` registry and reads `item.data` narrowed by
  `item.kind`; no casts on item data or kinds.
- **Accessible names**: the tree, every button and every input has a name; the package renders
  none.
- **Workarounds are commented** in the code and listed in `docs/docs-examples-gaps.md`.
