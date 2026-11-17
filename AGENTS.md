# Fragiola Tree

A **headless**, accessible tree view (file explorers, outlines, navigation, nested settings,
permission pickers). It ships behaviour, accessibility and composable primitives. It ships **no
CSS, no icons, no rendered menus and no text**. Styling belongs 100% to the consuming developer;
the package never assumes Tailwind, shadcn or anything else.

Its architecture is Fragiola's (`../guidelines`), with **Dockable (`../dockable`) as the
reference implementation**: a framework-free core, a typed model of commands, an engine per tree
on screen, and primitives for React, Vue and Angular under the Fragiola primitive contract. Each
framework has an adapter, so **every piece of logic that isn't rendering lives in the core**.

| package | name | contains | depends on |
|---|---|---|---|
| `packages/core` | `@fragiola/tree` | the tree model (JSON document v1 and its JSON Schema, the command bus, commands with JSON Schemas, `get`/`is` queries, middleware, events), and the engine (DOM focus, the WAI-ARIA keyboard model with type-ahead, Pointer Events drag and drop with keyboard drag, the async children loader, announcements) | DOM only, zero runtime deps |
| `packages/react` | `@fragiola/tree-react` | the `Tree.*` primitives (`Root`, `Items`, `Item`, `ItemContent`, `Group`, `Toggle`, `Checkbox`, `RenameInput`, `DropIndicator`, `LiveRegion`) and hooks (`useTree`, `useTreeItem`, `useTreeState`, `useTreeRef`, `createTreeRef`) over the core, and the core re-exported | the core (`workspace:*`, published as the exact version); peer `react`, `react-dom` (^19) |
| `packages/vue` | `@fragiola/tree-vue` | the same `Tree.*` primitives as Vue 3.5 components (plain `.ts` render functions, `as` and a `render` scoped slot, default scoped slots for the recursion, `v-model:*-item-ids`), `typedTree<Types>()`, the composables (`useTree`, `useTreeItem`, `useTreeState`, `useTreeRef`, `createTreeRef`), and the core re-exported | the core (`workspace:*`, published as the exact version); peer `vue` (^3.5) |
| `packages/angular` | `@fragiola/tree-angular` | the same primitives as Angular standalone attribute directives on the consumer's elements (`[treeRoot]`, `ng-template[treeItems]` for the recursion, `[treeItem]`, `[treeItemContent]`, `[treeGroup]`, `[treeToggle]`, `[treeCheckbox]`, `input[treeRenameInput]`, `[treeDropIndicator]`, `[treeLiveRegion]`, the `TREE` array; signals, `host` bindings, zoneless), the injection functions (`injectTree`, `injectTreeItem`, `injectTreeState`), and the core re-exported. Built by ng-packagr (Angular Package Format, partial compilation, ESM only) on TypeScript 6.0.3, pinned in this package (the Angular compiler supports `>=6.0 <6.1`); published from its `dist` (`publishConfig.directory`, its manifest written by `scripts/publish-manifest.ts`) | the core (`workspace:*`, published as the exact version); peer `@angular/core` (^22) |
| `examples/shared` | `examples-shared`, private | what every framework's examples share: the metadata (`src/meta/<id>.ts`), the five example themes (`light`, `dark`, `ide`, `paper`, `terminal`: Dockable's, each changing the tree's shape as well as its colours, read by every example of every framework through the `--tr-*` tokens), the embed protocol, the manifest builder and loader generator, every Playwright spec | no framework |
| `examples/react` | `examples-react`, private | the 13 React examples (`src/examples/<id>/`), the vendored Fragiola UI (`src/components`, `scripts/vendor-fragiola.ts`), the embed app | `@fragiola/tree-react`, Fragiola UI's stack |
| `examples/vue` | `examples-vue`, private | the 13 examples in Vue (`src/examples/<id>/index.vue`, `styles.ts` copied from React's), the Vue kit (Dockable's, over Reka UI, with the React kit's classes; `src/styles` and `src/lib/cn.ts` copied from examples/react, `tests/vendored.test.ts`), the embed app; single-file components checked by `vue-tsc` on TypeScript 6.0.3, pinned in this app only | `@fragiola/tree-vue`, Vue 3.5, Reka UI, `@lucide/vue` |
| `examples/angular` | `examples-angular`, private | the 13 examples in Angular (`src/examples/<id>/index.ts`, a default-exported standalone component with an inline template, and `styles.ts` copied from Vue's), the Angular kit (Dockable's clickable and switch, with the React kit's classes; `src/styles` and `src/lib/cn.ts` copied from examples/react, `tests/vendored.test.ts`), the embed app (Vite + `@analogjs/vite-plugin-angular`, zoneless); typechecked by `ngc` (strict templates) on TypeScript 6.0.3, pinned in this app only | `@fragiola/tree-angular`, Angular 22, `@lucide/angular` |
| `apps/playground` | `playground`, private | every example live, dev-only scenarios (`src/scenarios/<area>/<id>.tsx`), unstyled fixtures for Playwright (`fixtures/<name>/`), the Inspector | `@fragiola/tree-react` |
| `site` | `site`, private | the site export (`export.ts`, `contract.ts`, `dev.ts`, `dev-proxy.ts`, `sources.ts`), the pages fragiola.com/tree serves (`site/docs`), the repository's script tests | |

Vue came with Epic #11 and Angular with Epic #14: each adapter has its package, its examples app
(the 13 examples with the same ids, passing the shared specs unchanged), its CI e2e job (one per
`examples/*/playwright.config.ts`), its entry in `ADAPTERS` (`scripts/check-package.ts`), its
framework in `site/project.json` and in `COMPLETE_FRAMEWORKS` (`examples/shared/e2e/available.ts`):
React, Vue and Angular all ship every example.

**The Vue adapter** follows Dockable's (`../dockable/packages/vue`): the same primitive file
names as `packages/react` (`root.ts`, `item.ts`, …), `utils/render.ts` / `primitive.ts` /
`registration.ts` from Dockable, behaviour parity with React (`packages/vue/tests/parity.test.ts`
renders one document with both adapters and compares every element's ARIA, `data-*` and style).
No function form of `class`/`style` (Dockable's choice): state looks go through `data-*` or the
`render` slot. The engine is created once mounted; a server render neither subscribes to the
model nor runs a command on it (`onClient` in `utils/render.ts`). Another `model` remounts the
root. Biome's React hook rule (`useHookAtTopLevel`) is off for Vue code.

**The Angular adapter** follows Dockable's (`../dockable/packages/angular`): one standalone
attribute directive per primitive, in a file named as React's plus `.directive.ts`
(`root.directive.ts`, `item.directive.ts`, …; `templates.directive.ts` holds the template
contexts), classes with the `Directive` suffix (`TreeRootDirective`: the core already exports a
`TreeItem` type), signal inputs, `host` bindings for the ARIA, `data-*` and listeners, the
structural style applied by an effect (it wins over a static `style`), each part's `state()`
through `exportAs`. `<ng-template [treeItems]="model" let-item>` replaces children functions (typed
by the model or the JSON through `ngTemplateContextGuard`); a `[treeGroup]` with no template of
its own renders its children with the enclosing one (detached views placed in the group,
`utils/views.ts`), so the recursion is one template. The controlled lists are inputs plus
`…Change` outputs, so `[(expandedItemIds)]` binds both ways and a one-way binding reverts (as
React's controlled props). Behaviour parity: `packages/angular/tests/parity.test.ts` renders one
document with React and Angular. The one difference: a directive is on the app's element, which
exists where React renders nothing (a collapsed item's group, the rename input of an item not
renaming, the drop indicator without a target); the directive empties and hides it
(`display: none`), and an app that needs it out of the DOM wraps it in `@if` (examples/angular's
drag-and-drop: `@if (tree.state().dragging)`). The engine is created after the first render
(`afterNextRender`), the element registration runs after each render (`afterRenderEffect`).
No zone.js anywhere.

## Non-negotiable rules

Do not "fix" these. A change that breaks one is a decision for the maintainer.

1. **Headless.** No CSS, no icons, no text, no rendered menus. State goes out only through ARIA and
   `data-*` attributes, present or absent (never `"false"`). The only inline style a primitive
   sets is structural (the drop indicator's position, `--tree-depth`).
2. **The model is the source of truth.** Every change is a command (`model.run` /
   `model.dispatch`) through the middleware chain (`model.use`); the state is plain, frozen,
   JSON-shaped data, and a command shares every item it does not touch
   (`before.items.x === after.items.x`).
3. **Model vs engine.** Expansion, selection, checks, the focused item (the roving tab stop),
   renaming, children status and the structure are **model** state: the same answer with no
   screen. DOM focus, key handling, pointer drags, drop targets, scrolling and calling the app's
   loader are the **engine**'s (`createTreeEngine(model, { root, ... })`, one per tree on screen).
4. **One pattern on the model and the engine** (`../guidelines/architecture/model-api.md`). Both
   have the same verbs, each taking a key and a payload: `run` (do), `can` (a boolean), `check`
   (the dry-run result), `get` (read), `is` (yes/no). Keys are kebab-case and typed by a registry
   (`src/state/queries.ts`, `src/engine/verbs.ts`); a command name has a dot (`item.move`), an
   engine action never does (`load-children`). Only `model.run` changes the tree. Everything only
   an adapter calls is under `engine.adapter`; an app (and every example) never touches it. A new
   read or question is a new key, not a new method; guard tests keep both surfaces exact.
   **Names say what they take.** A field holding an id is `<entity>Id` (`itemId`, `parentItemId`;
   a list `itemIds`), in every payload and result; only `to` (a placement target) and an item's
   own `id` are exempt. A key and its payload read as one sentence
   (`model.can("item.move", { itemIds, to: { parentItemId, index } })`). A `get` key names its
   result; one that takes an id ends in `-by` (`item-by { id }`, `item-parent-by { itemId }`); an
   `is` key is `<entity>-<state>` (`item-expanded { itemId }`).
5. **Rules live in the commands.** The permission flags (`disabled`, `movable`, `renamable`,
   `droppable`, defaults in `settings`) are enforced by the commands themselves, so `model.can` /
   `model.check` answer the same rules a drag, a key or a menu asks. A drag is not special: the
   engine asks `model.can("item.move", …)` for every drop target, and a refusal hides it.
6. **Core rules** (`packages/core/tests/guard.test.ts`). The core never imports a framework (React,
   Vue, Angular), has **zero runtime dependencies**, never touches global `document`, `window`,
   `requestAnimationFrame`, `ResizeObserver` or `crypto` (all DOM access goes through the root's
   `ownerDocument` / `defaultView`; ids come from an injectable `createId`), and has no `any` in its
   exported declarations. The package makes no network call: the app's `loadChildren` does.
7. **The primitive contract** is the ecosystem's (`../guidelines/components/primitives.md`, Dockable's
   `AGENTS.md`). One namespace, `Tree`: `Tree.Root` (`role="tree"`), `Tree.Items`, `Tree.Item`
   (`role="treeitem"` with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded`,
   `aria-selected`, `aria-checked`, `aria-disabled`, `aria-busy` and the roving `tabindex`),
   `Tree.ItemContent`, `Tree.Group` (`role="group"`), `Tree.Toggle`, `Tree.Checkbox`,
   `Tree.RenameInput`, `Tree.DropIndicator`, `Tree.LiveRegion`, with the same file names in every
   adapter. `render`, never `asChild`; the developer owns the recursion (children functions over
   the model's items); no text and no `aria-label` of their own.
8. **Part and path attributes** (decided by the maintainer on 2026-11-16,
   `../guidelines/decisions.md`). Every element carries **`data-tree-part`** (`root`, `item`,
   `content`, `group`, `toggle`, `checkbox`, `rename-input`, `drop-indicator`, `live-region`), and
   every item **`data-tree-path`**, its position from the root (`/0/2`: the third child of the
   first root item, `model.get("item-path-by", { itemId })`). e2e selectors and tooling use them,
   never class names. State attributes: `data-expanded`, `data-selected`, `data-focused`,
   `data-checked`, `data-indeterminate`, `data-renaming`, `data-loading`, `data-load-error`,
   `data-disabled`, `data-leaf`, `data-dragging`, `data-drop-target`, `data-drop-position`,
   `data-depth`, and `--tree-depth` for the indentation.
9. **Drag and drop uses Pointer Events** (`../guidelines/decisions.md#drag-and-drop`): pointer
   capture on the item content, a movement threshold, one path for mouse, touch and pen, and the
   keyboard drag on the same machine. A drop runs one `item.move`. Native HTML5 drag and drop is
   not used (foreign content and drags between two trees are out of scope for now).
10. **App policy stays in the app.** No undo/redo, no persistence, no translations, no announcement
    text in the packages. Labels are raw model data no primitive reads or renders. The examples
    show those features as copyable code.
11. **No virtualization in this release.** `model.get("visible-items")` is the flat render order a
    virtualizer will consume later without an API break.

## The engine (`createTreeEngine(model, options)`)

- **Verbs** (`src/engine/verbs.ts`): `run` `focus`, `scroll-to`, `load-children`,
  `start-keyboard-drag`, `cancel-drag`; `get` `drop-target`, `dragging-item-ids`,
  `drop-indicator`, `announcement`, `direction`; `is` `dragging`, `keyboard-dragging`,
  `item-dragging`, `item-drop-target`. The engine object is exactly the verbs plus `adapter`,
  `subscribe` and `destroy` (a guard test).
- **`engine.adapter`** (`src/engine/adapter.ts`): the root and item element registration, the
  forwarded events (`handleKeyDown`, `handlePointerDown`, `handleClick`, `handleToggleClick`,
  `handleCheckboxClick`, `handleFocus`), the rename input (`commitRename`, `cancelRename`) and the
  render revision (`subscribe` / `getSnapshot`). An adapter forwards events; the core decides.
- **Keys** (`src/keyboard/key-map.ts`): the APG Tree View model with type-ahead, overridable
  through the `keyMap` option; Right and Left swap in `rtl`. Adapters never hard-code a key.
- **Drag and drop** (`src/dnd/`): Pointer Events with pointer capture and a threshold; the target
  comes from `drop-evaluation.ts` (ported from React Complex Tree: thirds of a row, the pointer's
  inline offset for the level at the end of a sublist) and shows only when
  `model.can("item.move", …)` accepts it; a hovered collapsed parent auto-expands (a transient
  `item.expand`); the nearest scroll container auto-scrolls; a drop runs one `item.move`. The
  keyboard drag steps through the same positions.
- **Async children** (`src/engine/children-loader.ts`): the app's `loadChildren(item, { signal })`
  runs when an `unloaded` item is expanded and visible; `destroy()` aborts it, and an aborted or
  stale load runs no command. With `resetLoadsOnDestroy` (every adapter sets it), `destroy()` puts
  the items it was loading back to `unloaded`, so the next engine on the model (a remount,
  React's StrictMode) loads them again.
- **Controls inside a row** (a button, a link, an input: `DRAG_EXEMPT`) keep their presses and
  their keys: the engine neither selects nor drags from them, nor handles their keys.
- **Announcements**: the app's `announce(event)` returns the live region's text; the engine keeps
  the latest one (`get("announcement")`). No text is built in.

## Glossary

The words never swap meaning, in code, docs and examples.

- An **item** is a node of the tree. It is a **leaf** when it has neither `childItemIds` nor
  `childrenStatus`; otherwise it is a parent. A parent whose children come from the app's loader
  has a **children status**: `unloaded`, `loading`, `loaded` or `error`.
- An item is **expanded** (its children are shown), **selected** (part of the selection; the
  selection mode is `none`, `single` or `multiple`), **checked**, **unchecked** or **mixed** (its
  checkbox; in `cascade` mode a parent is mixed when only some of its descendants are checked),
  **focused** (the roving tab stop: model data, not DOM focus), **renaming** (its label is being
  edited), **loading** (its children are being loaded) or **disabled** (focusable, not
  actionable).
- A drag has **dragging items** and a **drop target**: a parent, an index among its children, and
  a **position** relative to the hovered item: `before`, `after` or `inside`.
- **Visible items** are the items in render order whose ancestors are all expanded, each with its
  `level` (1 for a root item), `posinset` and `setsize`.

## Commands

| command | does |
|---|---|
| `pnpm install` | install dependencies |
| `pnpm check` | Biome lint + format + assist (non-mutating), then the source layout over `git ls-files` (`check:layout`, `scripts/check-layout.ts`), then builds the core and checks that `site/docs/api/commands.mdx` matches the registry (`check:commands`) |
| `pnpm check:fix` | Biome check with auto-fix |
| `pnpm typecheck` | `pnpm -r typecheck` (TypeScript 7, no emit; `examples/vue` runs `vue-tsc` on its own TypeScript 6.0.3; `packages/angular` and `examples/angular` run `ngc` with strict templates on their own TypeScript 6.0.3) |
| `pnpm test` | Vitest: `core` (node; the engine's files opt into jsdom), `react` (jsdom, Testing Library), `vue` (jsdom, `@vue/test-utils`; `parity.test.ts` renders React too), `angular` (jsdom, `@analogjs/vitest-angular`, zoneless TestBed; `parity.test.ts` renders React too), `playground`, `examples-shared`, `examples-react`, `examples-vue`, `examples-angular`, `site` (the export, the contract, `docs-reference.test.ts`, the scripts' tests) |
| `pnpm build` | `pnpm -r build` (tsdown; ng-packagr for the Angular package), then `scripts/check-dts.ts` (no `any` in the built declarations; the Angular compiler's `ɵ` metadata is ignored) |
| `pnpm check:package` | builds the packages, packs them with pnpm, checks the packed `exports` are the repo's without the source condition, runs `publint` and `attw --profile esm-only` on the tarballs, then the smoke app of each adapter in `ADAPTERS` (React: a Vite + React app that installs only the tarball, typechecks, builds and loads its dev server; Vue: a Vite + Vue app of single-file components checked by `vue-tsc` on examples/vue's TypeScript; Angular: a Vite + `@analogjs/vite-plugin-angular` app with a standalone component checked by `ngc` (strict templates) on packages/angular's TypeScript 6.0.3). The Angular package is packed from its `dist` (`publishConfig.directory`): its packed `exports` are the repo's relative to it |
| `pnpm changeset` | adds a changeset (`.changeset/*.md`): every PR that changes what a package ships (`changedFilePatterns` in `.changeset/config.json`) carries one, and CI's Changesets job fails one that does not; every package is in one `fixed` group (`@fragiola/*`) |
| `pnpm release:version` | `changeset version`: only the release workflow runs it (the Version Packages PR); never commit a version bump by hand |
| `pnpm dev` | the playground (`apps/playground`) on http://localhost:5173 (`PLAYGROUND_PORT` moves it): every example, the scenarios, the fixtures, the Inspector |
| `pnpm e2e` | Playwright: the playground's suite (fixtures, shell, scenarios), then each examples app's run of the shared specs (`examples/shared/e2e`) against its production embed; build the packages first (`pnpm build`) |
| `pnpm site:export --base /tree --out <dir>` | the site export (contract v1.2, `../www/CONTRACT.md`): pages, `examples.json`, `project.json` and the React, Vue and Angular embeds, validated by `site/contract.ts` |
| `pnpm site:dev --base /tree --port 5190` | every framework's embed with hot reload under `/tree/embed/<framework>/`, for `www`'s dev server |

**Dev ports.** The playground is 5173. The React embed alone (`pnpm --filter examples-react dev`)
and `pnpm site:dev` default to **5190**, the port `www` registers for `tree` (ui 5174, dockable
5180, data-grid 5181, grid-layout 5182, dnd 5183 and splitter 5184 are taken; 5190 leaves room
for the projects in between); fragiola/www#32 adds
`{ "slug": "tree", "devUrl": "http://localhost:5190" }` to `../www/projects.json`. The Vue embed
alone (`pnpm --filter examples-vue dev`) defaults to 5191; `site:dev` runs each framework's embed
on a free port behind its one port. The Angular embed alone (`pnpm --filter examples-angular dev`)
defaults to 5192.

**Releasing is a merge, and it is disabled today.** `.github/workflows/release.yml` is Dockable's
(Version Packages PR, then npm trusted publishing with pnpm), gated on the repository variable
`RELEASE_ENABLED`, which is not set: the maintainer's npm account is suspended and nothing is on
npm. **Never** run `npm publish`, `pnpm publish` or `changeset publish`, create a `0.0.0` stub, run
`npm trust`, or merge a "Version Packages" PR. The maintainer's steps for when npm is back are in
[`docs/releasing.md`](docs/releasing.md) ("Status").

## Repository layout

```
packages/core/      @fragiola/tree      src/index.ts (the entry), and one folder per domain:
                    src/state/          the document, loading, ids, the draft, queries, visible items, the model
                    src/commands/       define, catalogue, rules, one file per entity
                    src/schema/         the document and command schemas, the validator
                    src/engine/         the tree engine, its verbs registry, the adapter surface
                    src/keyboard/       the key map, type-ahead
                    src/dnd/            the drag machine, drop evaluation, keyboard drag, auto-scroll
                    src/geometry/       rect math
                    src/dom/            owner document / window helpers
                    tests/              mirrors src/; tests/types/ (type fixtures); guard.test.ts
                    scripts/            generate-command-docs.ts
packages/react/     @fragiola/tree-react  src/index.ts, parts.ts (the Tree namespace), context.ts, and
                    src/components/     one primitive per file (root.tsx, item.tsx, item-content.tsx, …)
                    src/hooks/          one hook per file; internal.ts for those only the primitives call
                    src/utils/          merge-props.ts, use-render.ts (from Dockable), engine-facade.ts
                    tests/              named after behaviour (aria, contract, keyboard, dnd, …)
packages/angular/   @fragiola/tree-angular  src/public-api.ts, and src/lib/: tree.ts (the TREE array), context.ts (the tokens),
                    src/lib/directives/ one directive per file (root.directive.ts, item.directive.ts, …, templates.directive.ts)
                    src/lib/inject/     one injection function per file
                    src/lib/utils/      helpers.ts, views.ts, signals.ts (from Dockable), item-state.ts, controlled.ts, engine-facade.ts
                    scripts/            publish-manifest.ts (dist/package.json)
                    tests/              the React adapter's behaviour files, parity.test.ts, inject.test.ts, types/
packages/vue/       @fragiola/tree-vue  src/index.ts, parts.ts, typed.ts (typedTree), context.ts, and
                    src/components/     one primitive per file, named as in React (root.ts, item.ts, …)
                    src/composables/    one composable per file; internal.ts for those only the primitives call
                    src/utils/          render.ts, primitive.ts, registration.ts (from Dockable), engine-facade.ts
                    tests/              the React adapter's behaviour files, parity.test.ts, ssr.test.ts, types/
examples/shared/    src/meta/, src/themes/, src/embed/, scripts/, e2e/ (every spec), tests/
examples/react/     src/examples/<id>/ (index.tsx, styles.ts), src/examples/_kit/, src/components/ (vendored), src/embed/
examples/vue/       src/examples/<id>/ (index.vue, tree.ts, *.vue, styles.ts), src/examples/_kit/ (React's), src/components/ (Vue kit), src/embed/
examples/angular/   src/examples/<id>/ (index.ts, *.ts, styles.ts), src/examples/_kit/ (React's), src/components/ (Angular kit), src/embed/
apps/playground/    src/shell/, src/scenarios/<area>/, src/inspector/, src/fixture/, fixtures/<name>/, e2e/
site/               export.ts, contract.ts, dev.ts, dev-proxy.ts, sources.ts, project.json
                    docs/               the pages fragiola.com/tree serves (docs/api/commands.mdx is generated)
                    tests/              the export, the contract, the docs reference, the scripts' tests
scripts/            check-layout.ts, check-dts.ts, check-package.ts, source-condition.ts, exported-names.ts
docs/               releasing.md, docs-examples-gaps.md, reports
```

In dev, the packages resolve to their sources through the `@fragiola/source` export condition
(`SOURCE_CONDITION` in `scripts/source-condition.ts`, the tsconfigs' `customConditions`, the
Vitest configs); production builds use `dist`. The published `exports` (`publishConfig.exports`)
are dist-only, and only pnpm applies them: the packages are packed and published through pnpm,
never npm.

## The site (fragiola.com)

The docs and examples are served by `fragiola.com/tree`, built by the `www` repo from this repo's
site export (`../www/CONTRACT.md` v1.2, `pnpm site:export`). This repo provides the pages
(`site/docs`, sidebar `site/docs/config.json`), `site/project.json` (`frameworks: ["react", "vue", "angular"]`), the gallery configuration (built from `examples/shared`) and one
examples app per framework; the registration in `www` is fragiola/www#32.

- Pages follow the contract: titles <= 60 characters, descriptions 50-160 characters, no `#` in
  bodies, only the v1.2 MDX vocabulary, base-free links. `site/tests/contract.test.ts` validates
  them, and `site/tests/docs-reference.test.ts` fails when an export, a prop, a key or a command
  field is not documented.
- The packages are **not on npm yet**: the installation page and the landing say so in a
  `Callout` (fragiola.com/tree goes live before npm, the maintainer's decision). Remove it with
  the first release.
- The JSON model is documented in `site/docs/api/json-model.mdx`, the commands in the generated
  `site/docs/api/commands.mdx`. The examples' workarounds, when there are any, are listed in
  `docs/docs-examples-gaps.md`; what the packages leave out is on `site/docs/limitations.mdx`.
- **The examples** (`examples/react/src/examples/README.md`): 13 ids, final, that Vue and
  Angular port in full: `hello-tree`, `file-explorer`, `multi-select`, `checkboxes`, `async-loading`,
  `rename`, `drag-and-drop`, `keyboard`, `controlled`, `save-restore`, `undo-redo`,
  `command-console`, `rtl`. The shared specs reach them only through `data-tree-part`,
  `data-tree-path`, roles, accessible names and test ids. Fragiola UI is vendored into the
  examples (committed copies), never a dependency of a package.
- **Every framework in the docs**: every page that shows framework code has a
  `<Framework name="react">`, a `<Framework name="vue">` and a `<Framework name="angular">` block
  (Epic #14), each written from (and typechecked like) that framework's examples. `site/docs/api/vue.mdx`
  and `site/docs/api/angular.mdx` map every React prop of the API pages onto Vue and Angular
  (`docs-reference.test.ts` checks they list every export and part of their package).

## Provenance

Both upstream checkouts are **read-only: never modify them, never copy them wholesale**. The model
and the view are Fragiola's own.

- **React Complex Tree** (`../references/react-complex-tree/packages/core`, v2.6.4, MIT, © 2023
  Lukas Bach) is the behaviour reference: the linear (visible) items, the drop position
  evaluation, the key bindings, search (type-ahead), the interaction modes and rename. A ported
  file starts with a header naming React Complex Tree, its copyright and the MIT licence;
  `packages/core/tests/guard.test.ts` lists those files (`PORTED`), and the root `LICENSE` (copied
  into each package) carries its notice.
- **Blueprint Tree** (`../references/blueprint/packages/core/src/components/tree`, Apache-2.0,
  © Palantir Technologies) is the reference for the controlled nested-node API and disabled items.
  No code is ported from it; if some ever is, it keeps its Apache-2.0 header and the `NOTICE`
  requirements apply.
- Code reused from another Fragiola project carries the lighter header
  `// From Dockable (fragiola/dockable, <path>), same author and licence.` (or Grid Layout's).

## Conventions

- Biome: 4-space indent, double quotes, LF, trailing newline, organized imports.
- **Source layout** (`../guidelines/repository.md#source-layout`; `pnpm check:layout` enforces it):
  every file and folder name is kebab-case; the files are grouped in folders by responsibility, and
  the root of a package's `src/` holds only its entries (`index.ts`, `parts.ts`, `typed.ts`,
  `context.ts`, `public-api.ts`). The core has one folder per domain, and its `tests/` mirror
  `src/`. An entry imports each module directly: no barrel files.
- A util must earn its existence: a helper lives in the domain folder that uses it, and moves to a
  shared folder only when two domains need it.
- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`. Do not relax it; a
  blanket `!` on every index access is not a fix.
- Pin dependencies to exact versions published at least 7 days ago (`npm view <pkg> time`).
  TypeScript 7.0.2, Vitest 5.0.2, Biome 2.5.14, tsdown 0.23.0, Vite 8.3.0, pnpm 11, Node ≥ 24.
  TypeScript is 7.0.2 everywhere but `examples/vue`, `packages/angular` and `examples/angular`, which
  pin 6.0.3 (vue-tsc and the Angular compiler do not run on TypeScript 7); in the Angular folders
  `@analogjs/vite-plugin-angular` gets it through a `packageExtensions` peer (`pnpm-workspace.yaml`).
  Angular is Dockable's stack: Angular 22.2.5, `@angular/build` and ng-packagr 22.2.6, Analog's
  plugins 2.9.6, `@lucide/angular` 1.70.0. The root pins Vite 8.3.0 too, so Vitest never picks
  `@angular/build`'s Vite 8.3.5.
- Commits are gitmoji-conventional: `✨ feat(core): …`, `🐛 fix(react): …`, `✅ test(core): …`,
  `🔧 chore: …`, `📝 docs: …`. Branches `<type>/epic-<n>-…`, worktrees under `.worktrees/`.
- Code, docs, commit messages, issues and pull requests in English.

## Type safety

- **No `any` in public types.** A guard test checks the core's exported declarations, and
  `pnpm build` checks every package's emitted `.d.ts` (`scripts/check-dts.ts`).
- **Data is typed by the registry.** An app declares `Types` (`{ items: { file: { size: number };
  folder: undefined } }`) and `createTreeModel<Types>(json)`; `item.data` narrows on `item.kind`,
  and `item.add` / `item.set-data` payloads are checked against it. No casts on item data or kinds,
  in the packages or the examples.
- **Schemas and types are tested together.** Every command's payload and result schema, and the
  document schema, is checked equal to its TypeScript type (`packages/core/tests/types/schemas.ts`).
- **Type fixtures** go in `tests/types/` (checked by `tsc`, not run): `@ts-expect-error` marks what
  must not compile.
- `site/docs/api/commands.mdx` is generated from the registry
  (`packages/core/scripts/generate-command-docs.ts`); `pnpm check` fails when it drifts.
