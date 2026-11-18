# Docs and examples: workarounds and gaps

What the examples (`examples/react/src/examples/`) and the docs (`site/docs/`) work around today,
because the packages do not do it (yet). Every workaround is commented in the example's code with
a `Workaround:` line pointing here; the reader-facing list is `site/docs/limitations.mdx` ("Known
gaps"). When a gap is fixed in a package, drop the workaround from the example, its entry here and
its bullet on the limitations page.

## Open workarounds

- **The cascade does not skip disabled items** (`permissions-admin`). In `cascade` mode,
  `item.check` / `item.toggle-check` on a parent set every descendant, disabled ones included, so a
  locked action would be unchecked with its resource. The example unbinds Space (`keyMap:
  { toggle: [] }`), handles Space and its check control with the app's `toggle` (one `batch` of
  `item.check` on the subtree's unlocked actions), and refuses, in a middleware (`lockRule`), any
  check that would uncheck a locked action. The fix in the package: the cascade leaves a disabled
  descendant as it is. Listed on `site/docs/limitations.mdx` ("Known gaps").

Earlier workarounds, the keyboard drag's first announcement, where it starts and the drop
indicator's inline offset, were fixed in the packages (fragiola/tree#24).

## Docs decisions

- **No `<InstallCommand>`.** The contract's `<InstallCommand item>` renders a shadcn registry
  install command and fails the build unless the item is in the project's `r/` registry. Tree
  exports no registry, so `getting-started/installation.mdx` uses `<Tabs>` with the pnpm, npm and
  yarn commands for `@fragiola/tree-react`, with a `<Callout>` saying the packages are not on npm
  yet.
