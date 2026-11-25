# Docs decisions

Choices the docs (`site/docs/`) make where the site contract leaves room.

- **No `<InstallCommand>`.** The contract's `<InstallCommand item>` renders a shadcn registry
  install command and fails the build unless the item is in the project's `r/` registry. Tree
  exports no registry, so `getting-started/installation.mdx` uses `<Tabs>` with the pnpm, npm and
  yarn commands for `@fragiola/tree-react`.
