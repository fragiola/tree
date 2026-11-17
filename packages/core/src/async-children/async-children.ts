// The async children feature: `asyncChildren()` gives a tree parents whose children come from the
// app's loader (an item's `childrenStatus`: unloaded, loading, loaded, error), the commands of that
// lifecycle, the engine's loader (the `loadChildren` engine option, every root's prop) and
// `load-children`, and `aria-busy` / `data-loading` / `data-load-error`. The package itself never
// loads anything: the app's `loadChildren` does. A tree without it holds every child itself.

import type { CommandDefinition } from "../commands/define";
import { fail, ok } from "../commands/define";
import type { LoadChildren } from "../engine/load-children";
import type {
    FeatureEngine,
    FeatureEngineHost,
    FeatureState,
    TreeFeature,
} from "../features/types";
import { itemOf } from "../state/structure";
import type { ChildrenStatus } from "../state/types";
import {
    itemResetChildren,
    itemSetChildren,
    itemSetChildrenStatus,
} from "./commands";
import { ChildrenLoader } from "./loader";

/** The root props the async children feature ships: the app's loader. */
export interface AsyncChildrenRootProps {
    /** the app's loader of the children of an item with a `childrenStatus` */
    loadChildren?: LoadChildren | undefined;
}

/** The async children feature, as `features` holds it. */
export type AsyncChildrenFeature = TreeFeature<
    "async-children",
    object,
    AsyncChildrenRootProps
>;

const COMMANDS: readonly CommandDefinition[] = [
    itemSetChildrenStatus,
    itemSetChildren,
    itemResetChildren,
] as readonly unknown[] as readonly CommandDefinition[];

function asyncChildrenEngine(host: FeatureEngineHost): FeatureEngine {
    const loader = new ChildrenLoader(
        host,
        host.options.loadChildren as LoadChildren | undefined,
    );
    return {
        run: {
            "load-children": (payload, dryRun) => {
                const { itemId } = payload as { itemId: string };
                if (!host.model.get("item-by", { id: itemId })) {
                    return fail(
                        "not_found",
                        `"${itemId}" is not an item`,
                        "/itemId",
                    );
                }
                if (!loader.canLoad(itemId)) {
                    return fail(
                        "refused",
                        loader.enabled
                            ? `"${itemId}" has no children to load now (none from the loader, or a load is under way)`
                            : "the engine has no loadChildren",
                        "/itemId",
                    );
                }
                if (!dryRun) loader.load(itemId);
                return ok({ itemId });
            },
        },
        settled: () => loader.scan(),
        destroy: () =>
            loader.destroy(host.options.resetLoadsOnDestroy === true),
    };
}

const NO_ATTRIBUTES = Object.freeze({});
const ATTRIBUTES: Readonly<
    Partial<Record<ChildrenStatus, Readonly<Record<string, string>>>>
> = Object.freeze({
    loading: Object.freeze({ "aria-busy": "true", "data-loading": "" }),
    error: Object.freeze({ "data-load-error": "" }),
});

/**
 * The async children feature: an item with a `childrenStatus` gets its children from the app's
 * `loadChildren(item, { signal })` when it is expanded and visible; `item.set-children-status`,
 * `item.set-children`, `item.reset-children`, the engine's `load-children` (a retry) and
 * `aria-busy`.
 *
 * ```ts
 * import { asyncChildren } from "@fragiola/tree/async-children";
 * const model = createTreeModel(json, { features: [asyncChildren()] });
 * const engine = createTreeEngine(model, { root, loadChildren });
 * ```
 */
export function asyncChildren(): AsyncChildrenFeature {
    return Object.freeze({
        name: "async-children",
        commands: COMMANDS,
        get: {
            "children-status-by": (
                state: FeatureState,
                { itemId }: { itemId: string },
            ) => itemOf(state, itemId)?.childrenStatus,
        },
        is: {
            "item-loading": (
                state: FeatureState,
                { itemId }: { itemId: string },
            ) => itemOf(state, itemId)?.childrenStatus === "loading",
        },
        itemAttributes: (state, itemId) => {
            const status = itemOf(state, itemId)?.childrenStatus;
            return (status && ATTRIBUTES[status]) ?? NO_ATTRIBUTES;
        },
        engine: asyncChildrenEngine,
    } satisfies AsyncChildrenFeature);
}
