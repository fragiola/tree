// The rename feature: `rename()` gives a tree inline renaming: the renaming item, the `renamable`
// flag and default, `item.start-rename`, `item.rename`, `item.cancel-rename`, F2, the engine's
// `commit-rename` / `cancel-rename` (the app's own editor confirms or cancels through them) and
// `data-renaming`. A tree without it never renames: its labels change only through a new document.

import type { CommandDefinition } from "../commands/define";
import { ok } from "../commands/define";
import type { CommandResult } from "../commands/types";
import type {
    FeatureEngine,
    FeatureEngineHost,
    FeatureState,
    TreeFeature,
} from "../features/types";
import type { KeyAction } from "../keyboard/key-map";
import type { ValidationIssue } from "../schema/types";
import { itemOf } from "../state/structure";
import type { TreeItem } from "../state/types";
import { itemCancelRename, itemRename, itemStartRename } from "./commands";
import {
    isRenamable,
    type RenameState,
    renamingOf,
    setRenaming,
    stopIfNotRenamable,
} from "./state";

/** Options of {@link rename}. */
export interface RenameOptions {
    /** whether items can be renamed when neither they nor the document say (default true) */
    renamable?: boolean | undefined;
}

/** The rename feature, as `features` holds it. */
export type RenameFeature = TreeFeature<"rename", RenameState>;

const COMMANDS: readonly CommandDefinition[] = [
    itemStartRename,
    itemRename,
    itemCancelRename,
] as readonly unknown[] as readonly CommandDefinition[];

function documentIssues(
    json: { readonly [key: string]: unknown },
    at: (path: string) => string,
    has: (id: string) => boolean,
): ValidationIssue[] {
    const id = json.renamingItemId;
    return typeof id === "string" && !has(id)
        ? [{ path: at("/renamingItemId"), message: `"${id}" is not an item` }]
        : [];
}

function renameEngine(host: FeatureEngineHost): FeatureEngine {
    const { model } = host;
    /** the renaming item as of the last model change, to find its editor once the rename ends */
    let renaming = renamingOf(model.state);
    const finish = (
        command: "item.rename" | "item.cancel-rename",
        payload: { itemId: string; label?: string },
        focus: boolean | undefined,
        dryRun: boolean,
    ): CommandResult<unknown> => {
        const result = dryRun
            ? model.check(command, payload)
            : model.run(command, payload);
        if (!result.ok) return result;
        if (!dryRun && focus !== false) host.focusElement(payload.itemId);
        return ok({ itemId: payload.itemId });
    };
    return {
        keyAction(action: KeyAction, { current }): boolean | undefined {
            if (action !== "rename") return undefined;
            return model.run("item.start-rename", { itemId: current }).ok;
        },
        run: {
            "commit-rename": (payload, dryRun) => {
                const { itemId, label, focus } = payload as {
                    itemId: string;
                    label: string;
                    focus?: boolean;
                };
                return finish("item.rename", { itemId, label }, focus, dryRun);
            },
            "cancel-rename": (payload, dryRun) => {
                const { itemId, focus } = payload as {
                    itemId: string;
                    focus?: boolean;
                };
                return finish("item.cancel-rename", { itemId }, focus, dryRun);
            },
        },
        modelChanged(active: Element): boolean {
            // the item whose rename this change ended (a commit, a cancel, another command): its
            // editor goes away, so focus goes back to the item; while a rename goes on, focus stays
            const previous = renaming;
            renaming = renamingOf(model.state);
            if (previous === renaming || previous === null) return false;
            const item = host.itemElement(previous);
            return (
                item !== undefined && item !== active && item.contains(active)
            );
        },
        pinnedItemId: () => renamingOf(model.state),
    };
}

const NO_ATTRIBUTES = Object.freeze({});
const RENAMING = Object.freeze({ "data-renaming": "" });

/**
 * The rename feature: the renaming item, `item.start-rename` (F2), `item.rename`,
 * `item.cancel-rename`, the `renamable` flag and default, the engine's `commit-rename` and
 * `cancel-rename` for the app's own editor, and `data-renaming`.
 *
 * ```ts
 * import { rename } from "@fragiola/tree/rename";
 * const model = createTreeModel(json, { features: [rename()] });
 * ```
 */
export function rename(options: RenameOptions = {}): RenameFeature {
    const renamable = options.renamable ?? true;
    return Object.freeze({
        name: "rename",
        settings: Object.freeze({ renamable }),
        issues: (json, { at, has }) => documentIssues(json, at, has),
        load: (json, items: { readonly [id: string]: TreeItem }) => {
            const id = json.renamingItemId as string | null | undefined;
            // a disabled item is never renamed
            return {
                renamingItemId:
                    id != null && items[id]?.disabled !== true ? id : null,
            };
        },
        toJson: (state) => ({ renamingItemId: renamingOf(state) }),
        commands: COMMANDS,
        is: {
            "item-renaming": (
                state: FeatureState,
                { itemId }: { itemId: string },
            ) => renamingOf(state) === itemId,
            "item-renamable": (
                state: FeatureState,
                { itemId }: { itemId: string },
            ) => {
                const item = itemOf(state, itemId);
                return (
                    item !== undefined &&
                    item.disabled !== true &&
                    isRenamable(state.settings, item)
                );
            },
        },
        forget: (draft, removed) => {
            const id = renamingOf(draft.state);
            if (id !== null && removed.has(id)) setRenaming(draft, null);
        },
        disabled: (draft, itemId) => stopIfNotRenamable(draft, itemId),
        flagsChanged: (draft, itemId) => stopIfNotRenamable(draft, itemId),
        configured: (draft) => {
            const id = renamingOf(draft.state);
            if (id !== null) stopIfNotRenamable(draft, id);
        },
        itemAttributes: (state, itemId) =>
            renamingOf(state) === itemId ? RENAMING : NO_ATTRIBUTES,
        engine: renameEngine,
    } satisfies RenameFeature);
}
