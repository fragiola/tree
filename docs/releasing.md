# Releasing

Releasing is a merge. [Changesets](https://changesets.dev) versions every package under
`packages/` (`@fragiola/tree`, `@fragiola/tree-react`, `@fragiola/tree-vue` and
`@fragiola/tree-angular`) together (one `fixed` group, `@fragiola/*`, so they always share a version) and writes their
changelogs. The release workflow, [`.github/workflows/release.yml`](../.github/workflows/release.yml),
publishes them with pnpm through npm **trusted publishing** (OIDC, with provenance): there is no
npm token anywhere. It is copied from Dockable (`fragiola/dockable`, `docs/releasing.md`).

## Status (2026-11-16): nothing is published, releases are disabled

The maintainer's npm account is suspended, so **nothing of this repository is on npm**: no `0.0.0`
stub of any package, and no trusted publisher. The pipeline is wired but does not run:
every job of `release.yml` needs the repository variable `RELEASE_ENABLED` set to `true`, and it is
not set. Without that gate, the first push to `main` would find a version npm does not have and
try to publish it.

Until npm is back, **nobody publishes**: no `npm publish`, `pnpm publish` or `changeset publish`,
no stub, no `npm trust`, and no "Version Packages" PR is merged. Changesets still accumulate in
`.changeset/` with every PR that changes what a package ships; they become the first release's
changelog.

When the npm account is back, the maintainer does these steps, in order, once:

1. **The scope.** Make sure the npm scope `@fragiola` exists and that the account owns it
   (`npm org ls fragiola`), with 2FA enabled.
2. **Let the workflow open PRs.** In the repository's *Settings → Actions → General → Workflow
   permissions*, enable **Allow GitHub Actions to create and approve pull requests** (in the
   organization's settings first, if greyed out).
3. **The `npm` environment.** In *Settings → Environments*, create an environment named exactly
   `npm`, with the deployment branch rule `main`.
4. **The stubs.** npm can only trust a publisher for a package that exists. From a clean checkout
   of `main`, with every package at `0.0.0`, publish each package once by hand:

   ```sh
   git switch main && git pull && git status   # clean, up to date
   pnpm install --frozen-lockfile
   pnpm build && pnpm --filter "./packages/*" publish --access public
   ```

   This covers `@fragiola/tree` and every adapter already merged. `pnpm build` comes first for
   every package, and is required for `@fragiola/tree-angular`: it is **published from its build
   output** (`publishConfig.directory` is `dist`, which ng-packagr builds in the Angular Package
   Format, with the published manifest written there by `packages/angular/scripts/publish-manifest.ts`),
   so pnpm packs and publishes `packages/angular/dist`, not the package folder. The release workflow
   builds before it packs too. An adapter merged later gets its
   own stub before its PR merges ("Adding a package" below). The four names are `@fragiola/tree`,
   `@fragiola/tree-react`, `@fragiola/tree-vue` and `@fragiola/tree-angular`.
5. **The trusted publishers.** With npm 11.15 or later and 2FA, for each published package:

   ```sh
   npm trust github @fragiola/tree --file release.yml --repo fragiola/tree --environment npm --allow-publish
   npm trust github @fragiola/tree-react --file release.yml --repo fragiola/tree --environment npm --allow-publish
   npm trust github @fragiola/tree-vue --file release.yml --repo fragiola/tree --environment npm --allow-publish
   npm trust github @fragiola/tree-angular --file release.yml --repo fragiola/tree --environment npm --allow-publish
   ```

   `--allow-publish` is required (Changesets does not do staged publishing). Never rename
   `release.yml` or its `npm` environment.
6. **Enable releases.** In *Settings → Secrets and variables → Actions → Variables*, add the
   repository variable `RELEASE_ENABLED` with the value `true`. The next push to `main` opens the
   **Version Packages** PR from the pending changesets.
7. **Merge the Version Packages PR.** A PR opened with the workflow's token starts no other
   workflow: close and reopen it (or run *CI* on its branch) to get the checks, then merge it. The
   release workflow publishes the first version with provenance. Merge nothing else until that run
   is over (see *While a release runs*). Then check the packages on npm, the tags and the GitHub
   releases.
8. **Lock it down.** On npm, for each package, *Settings → Publishing access*: **Require two-factor
   authentication and disallow tokens**.

The site (fragiola.com/tree) is rebuilt by the CI's *Trigger www build* job, which needs the
`WWW_DISPATCH_TOKEN` repository secret (a fine-grained token with Contents: read & write on
`fragiola/www`). The maintainer creates it; without it the job is skipped.

## How the workflow decides

On every push to `main`, once enabled, the workflow does one of three things:

- **changesets are pending:** it opens or updates the **Version Packages** PR, which bumps the
  versions, writes the `CHANGELOG.md` files and deletes the changesets;
- **no changeset, and `main`'s version is not on npm** (the Version Packages PR was just merged):
  it builds the packages, packs them with pnpm, checks those tarballs
  (`scripts/check-package.ts --tarballs`), publishes them from the `npm` environment, then pushes
  the git tags (`@fragiola/tree@0.1.0`, …) and creates the GitHub releases;
- otherwise nothing.

Packing and publishing always go through pnpm: it applies `publishConfig` (the dist-only
`exports`, and the Angular package's `directory`), npm does not. Never publish with `npm publish`.

## Later releases

- **Every PR that changes what a package ships** adds a changeset: `pnpm changeset`, pick the bump
  and write the summary for the changelog (what changed and, for a break, how to update). Commit
  the `.changeset/*.md` file with the PR. "What a package ships" is `changedFilePatterns` in
  `.changeset/config.json`: its `src`, `package.json`, `README.md`, `LICENSE` and build configs.
  A PR that touches only tests, docs, examples, the playground or the tooling needs none. CI's
  *Changesets* job fails a PR that should have one (the Version Packages PR is skipped).
- **The bump.** The packages are one `fixed` group: a changeset for any of them bumps them all. While
  Fragiola Tree is `0.x`, a breaking change is a `minor` (`0.1` → `0.2`), anything else a `patch`.
- **Releasing.** Merging such PRs keeps the Version Packages PR up to date. Merge it when you want
  to release (re-trigger its CI first, as in step 7). Never bump the versions or edit the
  changelogs by hand. `pnpm changeset status --verbose` shows what the next release contains.
- **Possible improvement.** The Version Packages PR would get its CI by itself if the version job
  pushed with a GitHub App's token (the `github-token` input of `changesets/action/version`)
  instead of the workflow's. That needs an App installed on the repository and its key as a
  secret.

## Adding a package

A new adapter (`packages/react` as `@fragiola/tree-react`, `packages/vue` as `@fragiola/tree-vue`,
`packages/angular` as `@fragiola/tree-angular`) needs nothing in the release workflow: it builds and packs
`./packages/*`, and the `fixed` group of `.changeset/config.json` is `@fragiola/*`, so the new
package is versioned with the others from its first release. What it does need:

1. **In the PR that adds it:** the package at version `0.0.0`, depending on the core with
   `workspace:*` (published as the exact version); its entry in `ADAPTERS` in
   `scripts/check-package.ts` with its smoke app (`check:package` fails on a package under
   `packages/` that is neither the core nor listed); and a changeset that names it, so the
   Version Packages PR brings it to the family's next version.
2. **Before merging that PR, the stub** (while npm is unavailable, skip this step and step 3:
   the steps of *Status* publish every package merged by then). npm trusts a publisher only for a package that exists, so
   publish the new package once by hand at `0.0.0`, as in step 4 of *Status*, but for
   that package only (`pnpm --filter @fragiola/tree-vue publish --access public`, from a clean
   checkout of the PR's branch, with 2FA). A package published from its build output
   (`@fragiola/tree-angular`: `publishConfig.directory` is `dist`) is built first: pnpm
   publishes that directory, with the manifest its build writes there.
3. **Its trusted publisher,** as in step 5: `npm trust github @fragiola/tree-vue --file
   release.yml --repo fragiola/tree --environment npm --allow-publish`.
4. **After its first release,** lock it down as in step 8.

Without steps 2 and 3, the first publish of the new package fails with `E404` or `ENEEDAUTH`
while the others publish: the release is then half published (see *When a publish fails*).

## While a release runs

From the merge of the Version Packages PR until its *Release* run has finished, merge nothing
else. Each push to `main` starts its own run, and each run decides on its own: a PR merged in the
meantime with no changeset would also be in publish mode, and could publish the same version from
a different commit. The publish of one commit is never cancelled by a later push.

## When a publish fails

After a failed publish, `main` holds the bumped version (say `0.2.0`) and no changeset, and npm
lacks that version for one package or both. The release workflow publishes it on the next run
**that finds no changeset on `main`**, so:

- **The cause was outside the repository** (npm down, the trusted publisher or the `npm`
  environment misconfigured): fix that, then open the failed run of *Release* and choose *Re-run
  all jobs* (possible for 30 days). Its select-mode job computes the plan again: only what npm
  lacks.
- **The cause is in the repository** (a build or the tarball check fails): fix it in a PR that
  **adds no changeset**. Its merge leaves `main` with no changeset, so that run publishes the
  bumped version, fix included. CI's *Changesets* job fails on that PR when it touches a package's
  shipped files; that is expected here, and the check is not required: merge it anyway. Do not
  add an empty changeset (`pnpm changeset --empty`) to quiet it: any changeset on `main` stops the
  publish, and an empty one releases nothing.
- **Until the stuck version is out, merge no PR that adds a changeset.** It would turn the next
  run into a version run, which bumps past the stuck version (`0.2.1`), and that version would
  never be published. If that is what you want (give up on the stuck version), deprecate whatever
  part of it reached npm (below) and release the next one.
- **Half published** (the core is on npm, the React package is not): any of the above publishes the
  rest. Changesets skips a version npm already has; the failed run already pushed the tags and
  created the releases of what it did publish.
- **Published, but a tag or a release is missing** (the run failed after npm): the workflow will
  not publish again, so create them by hand: the tag `<package>@<version>` on the commit the
  publish ran from, and a GitHub release from it with the changelog's section.
- **`ENEEDAUTH`, `E404` or `E403` on publish:** the trusted publisher does not match the run.
  Check `npm trust list <package>`: the repository `fragiola/tree`, the file `release.yml`,
  the environment `npm`, publishing allowed. The packages' `repository.url` must point to this
  repository.
- **A broken version went out:** npm versions cannot be reused. Deprecate it
  (`npm deprecate @fragiola/tree@<version> "<why>"`, the same for the React package) and
  release a fix with a new changeset.
