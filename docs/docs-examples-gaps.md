# Docs and examples: workarounds and gaps

What the examples (`examples/react/src/examples/`) and the docs (`site/docs/`) work around today,
because the packages do not do it (yet). Every workaround is commented in the example's code with
a `Workaround:` line pointing here; the reader-facing list is `site/docs/limitations.mdx` ("Known
gaps"). When a gap is fixed in a package, drop the workaround from the example, its entry here and
its bullet on the limitations page.

## 1. The keyboard drag's `drag-start` announcement is replaced at once

- **What happens.** `engine.run("start-keyboard-drag", …)` (and Ctrl/Cmd+Shift+D) announces
  `drag-start` and then the first `drag-over` in the same tick (`KeyboardDrag.start`,
  `packages/core/src/dnd/keyboard-drag.ts`). The live region keeps only the latest text, so the
  start ("Picked up …, Up and Down choose a place…") is never read.
- **Workaround.** `keyboard/index.tsx` and `drag-and-drop/index.tsx` (`announcer`): the
  `drag-start` text is remembered and prepended to the next `drag-over` message.
- **Fix.** In the core: announce the start and the first target as one event, or give
  `drag-start` the first target.

## 2. The keyboard drag may start at the top of the tree

- **What happens.** A keyboard drag starts on the position `before` the first dragged item when
  that position is among the valid ones; when it is not, it starts on the first valid position (`this.at = 0`), which can be the top of the
  tree, far from the item.
- **Workaround.** None in the examples; documented in `limitations.mdx`.
- **Fix.** In the core: start on the valid position nearest to the dragged item.

## 3. The drop indicator ignores the rows' leading padding

- **What happens.** `engine.get("drop-indicator").inlineOffset` is `(level - 1) * indentation`
  from the root's inline start. Rows that start with padding, a grip or a toggle before their
  label put the line too far towards the start.
- **Workaround.** Each example's `dropIndicator` style shifts it with a margin
  (`drag-and-drop/styles.ts`: `ms-11`, past the grip and the toggle; `keyboard`, `undo-redo`,
  `save-restore`: "The line starts at the icon, past the toggle"). The docs say so
  (`getting-started/depth.mdx`, "Keeping drops in line"; `api/drop-indicator.mdx`).
- **Fix.** An option for a constant inline offset (or the indicator reading the row's content
  start), in the core and `Tree.DropIndicator`.

## Docs decisions

- **No `<InstallCommand>`.** The contract's `<InstallCommand item>` renders a shadcn registry
  install command and fails the build unless the item is in the project's `r/` registry. Tree
  exports no registry, so `getting-started/installation.mdx` uses `<Tabs>` with the pnpm, npm and
  yarn commands for `@fragiola/tree-react`, with a `<Callout>` saying the packages are not on npm
  yet.
