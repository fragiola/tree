// The checkboxes feature: `checkboxes({ mode })` gives a tree tri-state checks (`checkedItemIds`,
// `cascade` or `independent`), `item.check` and `item.toggle-check`, `aria-checked` on its items,
// Space to toggle the focused item's check and the `checkedItemIds` root prop. The check control is
// the app's own element: it reads the item's state and runs `item.toggle-check`. A tree without it
// has no checks and says nothing about them.
import type { CommandDefinition } from "../commands/define";
import type { RunOptions } from "../commands/types";
import type {
    FeatureEngine,
    FeatureEngineHost,
    FeatureModel,
    FeatureState,
    TreeFeature,
    TreeRootProp,
} from "../features/types";
import type { KeyAction } from "../keyboard/key-map";
import type { ValidationIssue } from "../schema/types";
import type { CheckMode, CheckState } from "../state/types";
import { itemCheck, itemToggleCheck } from "./commands";
import {
    type CheckboxesState,
    cascadeOf,
    checkedOf,
    checkedSet,
    checkModeOf,
    checkStateOf,
    forgetChecks,
    inheritCheck,
    normalizeChecks,
    settleAncestors,
} from "./state";

/** Options of {@link checkboxes}. */
export interface CheckboxesOptions {
    /**
     * how checkboxes relate when the document says nothing (`settings.checkMode`): `cascade` (the
     * default: an item's descendants follow it, a parent is checked when all its children are) or
     * `independent`
     */
    mode?: CheckMode | undefined;
    /**
     * what Space does on the focused item: `check` toggles its check, `select` leaves Space to the
     * selection. Default: `select` when `selection()` is installed, else `check`
     */
    space?: "check" | "select" | undefined;
}

/** The root props the checkboxes feature ships: the controlled checks. */
export interface CheckboxesRootProps {
    /** controlled checkboxes: the checked items (with `onCheckedItemIdsChange`) */
    checkedItemIds?: readonly string[] | undefined;
    /** called with the checked items after every command that changes them */
    onCheckedItemIdsChange?: ((itemIds: string[]) => void) | undefined;
}

/** The checkboxes feature, as `features` holds it. */
export type CheckboxesFeature = TreeFeature<
    "checkboxes",
    CheckboxesState,
    CheckboxesRootProps
>;

const COMMANDS: readonly CommandDefinition[] = [
    itemCheck,
    itemToggleCheck,
] as readonly unknown[] as readonly CommandDefinition[];

type Entry = { command: string; payload: Record<string, unknown> };

/**
 * Runs `entries` as one batch; when the batch is refused (an id the tree does not have, a disabled
 * item), runs each one the model accepts on its own.
 */
function runAll(
    model: FeatureModel,
    entries: Entry[],
    options: RunOptions,
): void {
    if (entries.length === 0) return;
    if (model.run("batch", { commands: entries }, options).ok) return;
    for (const { command, payload } of entries) {
        model.run(command as "item.check", payload, options);
    }
}

const rootProps: readonly TreeRootProp[] = [
    {
        prop: "checkedItemIds",
        changeProp: "onCheckedItemIdsChange",
        read: (state) => checkedOf(state),
        sync: (model, itemIds, options) => {
            const now = checkedOf(model.state);
            const current = new Set(now);
            const wanted = new Set(itemIds);
            if (
                now.length === itemIds.length &&
                itemIds.every((id) => current.has(id))
            )
                return;
            const unchecked = now.filter((itemId) => !wanted.has(itemId));
            // what the unchecks take with them (cascade): checked again when the list wants it
            const lost = new Set(
                checkModeOf(model.state) === "cascade"
                    ? unchecked.flatMap((itemId) =>
                          cascadeOf(model.state, itemId),
                      )
                    : [],
            );
            // unchecks first: unchecking a parent (cascade) must not undo a check of its children
            runAll(
                model,
                [
                    ...unchecked.map((itemId) => ({
                        command: "item.check",
                        payload: { itemId, checked: false },
                    })),
                    ...itemIds
                        .filter(
                            (itemId) =>
                                !current.has(itemId) || lost.has(itemId),
                        )
                        .map((itemId) => ({
                            command: "item.check",
                            payload: { itemId, checked: true },
                        })),
                ],
                options,
            );
        },
    },
];

function documentIssues(
    json: { readonly [key: string]: unknown },
    at: (path: string) => string,
    has: (id: string) => boolean,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const checked =
        (json.checkedItemIds as readonly string[] | undefined) ?? [];
    checked.forEach((id, i) => {
        if (!has(id))
            issues.push({
                path: at(`/checkedItemIds/${i}`),
                message: `"${id}" is not an item`,
            });
    });
    return issues;
}

function checkboxesEngine(
    host: FeatureEngineHost,
    space: CheckboxesOptions["space"],
): FeatureEngine {
    const { model } = host;
    const spaceChecks = () =>
        space === "check" ||
        (space === undefined &&
            !(
                model.get("features") as readonly { readonly name: string }[]
            ).some((feature) => feature.name === "selection"));
    return {
        firstKeyAction(action: KeyAction, { current }): boolean | undefined {
            if (action !== "toggle" || !spaceChecks()) return undefined;
            return model.run("item.toggle-check", { itemId: current }).ok;
        },
    };
}

const NO_ATTRIBUTES = Object.freeze({});
const ATTRIBUTES: Readonly<
    Record<CheckState, Readonly<Record<string, string>>>
> = Object.freeze({
    checked: Object.freeze({ "aria-checked": "true", "data-checked": "" }),
    unchecked: Object.freeze({ "aria-checked": "false" }),
    mixed: Object.freeze({
        "aria-checked": "mixed",
        "data-indeterminate": "",
    }),
});

/**
 * The checkboxes feature: tri-state checks (`checkedItemIds`; `cascade` derives a parent's
 * `mixed` state from its children), `item.check`, `item.toggle-check`, `aria-checked` on every
 * item, Space to toggle the check and the `checkedItemIds` root prop. The control is the app's.
 *
 * ```ts
 * import { checkboxes } from "@fragiola/tree/checkboxes";
 * const model = createTreeModel(json, { features: [checkboxes()] });
 * ```
 */
export function checkboxes(options: CheckboxesOptions = {}): CheckboxesFeature {
    const defaultMode = options.mode ?? "cascade";
    const space = options.space;
    return Object.freeze({
        name: "checkboxes",
        settings: Object.freeze({ checkMode: defaultMode }),
        issues: (json, { at, has }) => documentIssues(json, at, has),
        load: (json) => ({
            checkedItemIds: [
                ...((json.checkedItemIds as readonly string[] | undefined) ??
                    []),
            ],
        }),
        loaded: normalizeChecks,
        toJson: (state) => ({ checkedItemIds: [...checkedOf(state)] }),
        commands: COMMANDS,
        get: {
            "check-state-by": (
                state: FeatureState,
                { itemId }: { itemId: string },
            ) => checkStateOf(state, itemId),
        },
        is: {
            "item-checked": (
                state: FeatureState,
                { itemId }: { itemId: string },
            ) => checkedSet(state).has(itemId),
        },
        forget: forgetChecks,
        configured: (draft, before) => {
            // switching to cascade makes the checks consistent
            if (
                checkModeOf(draft.state) === "cascade" &&
                (before as { checkMode?: CheckMode }).checkMode !== "cascade"
            )
                normalizeChecks(draft);
        },
        childrenChanged: (draft, parentItemId, addedItemIds) => {
            if (addedItemIds.length > 0)
                inheritCheck(draft, parentItemId, addedItemIds);
            settleAncestors(draft, parentItemId);
        },
        itemAttributes: (state, itemId) =>
            ATTRIBUTES[checkStateOf(state, itemId)] ?? NO_ATTRIBUTES,
        engine: (host) => checkboxesEngine(host, space),
        rootProps,
    } satisfies CheckboxesFeature);
}
