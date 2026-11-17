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
| `packages/react` | `@fragiola/tree-react` | the `Tree.*` primitives and hooks over the core, and the core re-exported (Epic #8) | the core (`workspace:*`, published as the exact version); peer `react`, `react-dom` (^19) |
| `packages/vue` | `@fragiola/tree-vue` | the same primitives in Vue 3 (Epic #11) | the core; peer `vue` (^3.5) |
| `packages/angular` | `@fragiola/tree-angular` | the same primitives as Angular directives (Epic #14) | the core; peer `@angular/core` |
| `site` | private | the pages fragiola.com/tree serves (`site/docs`), the repository's script tests | |

Only the core exists today; the adapters, the examples apps, the playground and the site export
come with their Epics, each adding its scripts, its CI job and its entry in `ADAPTERS`
(`scripts/check-package.ts`).

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
| `pnpm typecheck` | `pnpm -r typecheck` (TypeScript 7, no emit) |
| `pnpm test` | Vitest: `core` (node; the engine's files opt into jsdom), `site` (the scripts' tests) |
| `pnpm build` | `pnpm -r build` (tsdown), then `scripts/check-dts.ts` (no `any` in the built declarations) |
| `pnpm check:package` | builds the packages, packs them with pnpm, checks the packed `exports` are the repo's without the source condition, runs `publint` and `attw --profile esm-only` on the tarballs, then the smoke app of each adapter in `ADAPTERS` (none yet) |
| `pnpm changeset` | adds a changeset (`.changeset/*.md`): every PR that changes what a package ships (`changedFilePatterns` in `.changeset/config.json`) carries one, and CI's Changesets job fails one that does not; every package is in one `fixed` group (`@fragiola/*`) |
| `pnpm release:version` | `changeset version`: only the release workflow runs it (the Version Packages PR); never commit a version bump by hand |

`pnpm e2e`, `pnpm dev`, `pnpm site:export` and `pnpm site:dev` come with the playground, the
examples apps and the site (Epic #8).

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
site/               docs/               the pages fragiola.com/tree serves (docs/api/commands.mdx is generated)
                    tests/              the repository scripts' tests (check-layout.test.ts)
scripts/            check-layout.ts, check-dts.ts, check-package.ts, source-condition.ts, exported-names.ts
docs/               releasing.md, reports
```

In dev, the packages resolve to their sources through the `@fragiola/source` export condition
(`SOURCE_CONDITION` in `scripts/source-condition.ts`, the tsconfigs' `customConditions`, the
Vitest configs); production builds use `dist`. The published `exports` (`publishConfig.exports`)
are dist-only, and only pnpm applies them: the packages are packed and published through pnpm,
never npm.

## The site (fragiola.com)

The docs and examples are served by `fragiola.com/tree`, built by the `www` repo from this repo's
site export (`../www/CONTRACT.md`). This repo provides the pages (`site/docs`), the gallery
configuration and one examples app per framework; the export, the examples apps and the
registration in `www` come with Epic #8 and fragiola/www#32. The JSON model is documented in
`site/docs/api/json-model.mdx`, the commands in the generated `site/docs/api/commands.mdx`.

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
