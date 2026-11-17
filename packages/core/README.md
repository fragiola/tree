# @fragiola/tree

The framework-free core of [Fragiola Tree](https://fragiola.com/tree): a headless, accessible tree
view. It holds the tree model (a versioned JSON document, its commands with JSON Schemas, queries,
middleware and events) and the engine that runs one tree on screen (DOM focus, the WAI-ARIA
keyboard model, announcements).

The core is a minimal tree and opt-in features, each from its own entry, installed in the
model's features: `selection()` from `@fragiola/tree/selection`, `checkboxes()` (`/checkboxes`),
`rename()` (`/rename`), `asyncChildren()` (`/async-children`), `typeAhead()` (`/type-ahead`),
`virtualization()` (a window of
the rows in view, for trees of hundreds of thousands of rows) from
`@fragiola/tree/virtualization`, `dragAndDrop()` (Pointer Events and keyboard drag,
`/drag-and-drop`), `dragGroup()` (`/drag-group`), `foreignDrop()` (`/foreign-drop`) and
`dropOutside()` (`/drop-outside`). A bundle that never imports a feature does not carry it.

Zero runtime dependencies; no framework; no CSS, icons or text. The React, Vue and Angular
adapters render it.

Documentation: <https://fragiola.com/tree>. MIT licensed, see [LICENSE](LICENSE).
