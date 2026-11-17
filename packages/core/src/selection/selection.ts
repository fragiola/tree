// The selection feature: `selection({ mode })` gives a tree its selected items, their commands and
// keys, the clicks and keys that select, `aria-selected` / `aria-multiselectable` and the
// `selectedItemIds` root prop. A tree without it selects nothing and says nothing about selection.
import type { CommandDefinition } from "../commands/define";
import type { PressInput } from "../engine/adapter";
import type {
    FeatureEngine,
    FeatureEngineHost,
    FeatureKeyContext,
    FeatureState,
    TreeFeature,
    TreeRootProp,
} from "../features/types";
import type { KeyAction } from "../keyboard/key-map";
import type { ValidationIssue } from "../schema/types";
import type { Draft } from "../state/draft";
import { itemOf } from "../state/structure";
import type { SelectionMode, TreeItem } from "../state/types";
import {
    itemSelect,
    treeClearSelection,
    treeSelect,
    treeSelectAll,
} from "./commands";
import {
    anchorOf,
    draftSlice,
    modeOf,
    type SelectionSlice,
    type SelectionState,
    selectedOf,
    setAnchor,
    setSelected,
} from "./state";

/** Options of {@link selection}. */
export interface SelectionOptions {
    /**
     * how many items can be selected when the document says nothing (`settings.selectionMode`):
     * `single` (the default), `multiple` or `none`
     */
    mode?: SelectionMode | undefined;
}

/** The root props the selection feature ships: the controlled selection. */
export interface SelectionRootProps {
    /** controlled selection: the selected items (with `onSelectedItemIdsChange`) */
    selectedItemIds?: readonly string[] | undefined;
    /** called with the selection after every command that changes it */
    onSelectedItemIdsChange?: ((itemIds: string[]) => void) | undefined;
}

/** The selection feature, as `features` holds it. */
export type SelectionFeature = TreeFeature<
    "selection",
    SelectionState,
    SelectionRootProps
>;

const COMMANDS: readonly CommandDefinition[] = [
    itemSelect,
    treeSelect,
    treeSelectAll,
    treeClearSelection,
] as readonly unknown[] as readonly CommandDefinition[];

const slice = (state: FeatureState) => state as unknown as SelectionSlice;

function documentIssues(
    json: { readonly [key: string]: unknown },
    at: (path: string) => string,
    has: (id: string) => boolean,
    defaultMode: SelectionMode,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const selected =
        (json.selectedItemIds as readonly string[] | undefined) ?? [];
    selected.forEach((id, i) => {
        if (!has(id))
            issues.push({
                path: at(`/selectedItemIds/${i}`),
                message: `"${id}" is not an item`,
            });
    });
    const anchor = json.selectionAnchorItemId;
    if (typeof anchor === "string" && !has(anchor)) {
        issues.push({
            path: at("/selectionAnchorItemId"),
            message: `"${anchor}" is not an item`,
        });
    }
    const settings = json.settings as
        | { selectionMode?: SelectionMode }
        | undefined;
    const mode = settings?.selectionMode ?? defaultMode;
    if (mode === "none" && selected.length > 0) {
        issues.push({
            path: at("/selectedItemIds"),
            message: 'must be empty when the selection mode is "none"',
        });
    }
    if (mode === "single" && selected.length > 1) {
        issues.push({
            path: at("/selectedItemIds"),
            message:
                'must hold at most one item when the selection mode is "single"',
        });
    }
    return issues;
}

function forgetIn(draft: Draft, gone: (id: string) => boolean): void {
    const state = draftSlice(draft);
    const selected = selectedOf(state);
    const kept = selected.filter((id) => !gone(id));
    if (kept.length !== selected.length) setSelected(draft, kept);
    const anchor = anchorOf(state);
    if (anchor !== null && gone(anchor)) setAnchor(draft, null);
}

const rootProps: readonly TreeRootProp[] = [
    {
        prop: "selectedItemIds",
        changeProp: "onSelectedItemIdsChange",
        read: (state) => selectedOf(slice(state)),
        sync: (model, itemIds, options) => {
            // an id the tree does not have (removed, not loaded yet) cannot be selected
            const known = itemIds.filter(
                (id) => itemOf(model.state, id) !== undefined,
            );
            const current = selectedOf(slice(model.state));
            const same =
                known.length === current.length &&
                known.every((id) => current.includes(id));
            if (!same) model.run("tree.select", { itemIds: known }, options);
        },
    },
];

function selectionEngine(host: FeatureEngineHost): FeatureEngine {
    const { model } = host;
    const mode = () => modeOf(slice(model.state));
    const select = (itemId: string, how: "replace" | "toggle" | "extend") =>
        mode() !== "none" && model.run("item.select", { itemId, mode: how }).ok;
    const extendTo = (itemId: string | undefined) => {
        if (itemId === undefined || mode() !== "multiple") return false;
        // extend from the anchor (or the item focused now) before the focus moves
        model.run("item.select", { itemId, mode: "extend" });
        host.focus(itemId);
        return true;
    };
    return {
        keyAction(
            action: KeyAction,
            { current, visible, at }: FeatureKeyContext,
        ): boolean | undefined {
            switch (action) {
                case "select":
                    return select(current, "replace");
                case "toggle":
                    return select(
                        current,
                        mode() === "multiple" ? "toggle" : "replace",
                    );
                case "toggle-selection":
                    return select(current, "toggle");
                case "extend-next":
                    return extendTo(visible[at + 1]?.itemId);
                case "extend-previous":
                    return extendTo(visible[at - 1]?.itemId);
                case "extend-to-focused":
                    return mode() === "multiple" && select(current, "extend");
                case "extend-to-first":
                    return extendTo(visible[0]?.itemId);
                case "extend-to-last":
                    return extendTo(visible.at(-1)?.itemId);
                case "select-all":
                    return model.run("tree.select-all", {}).ok;
                default:
                    return undefined;
            }
        },
        click(itemId: string, event: PressInput): void {
            if (mode() === "none") return;
            const how = event.shiftKey
                ? "extend"
                : event.ctrlKey || event.metaKey
                  ? "toggle"
                  : "replace";
            model.run("item.select", { itemId, mode: how });
        },
        itemAttributes(itemId: string) {
            const state = slice(model.state);
            if (modeOf(state) === "none") return NO_ATTRIBUTES;
            return selectedOf(state).includes(itemId) ? SELECTED : UNSELECTED;
        },
        rootAttributes() {
            return mode() === "multiple" ? MULTISELECTABLE : NO_ATTRIBUTES;
        },
    };
}

const NO_ATTRIBUTES = Object.freeze({});
const SELECTED = Object.freeze({
    "aria-selected": "true",
    "data-selected": "",
});
const UNSELECTED = Object.freeze({ "aria-selected": "false" });
const MULTISELECTABLE = Object.freeze({ "aria-multiselectable": "true" });

/**
 * The selection feature: selected items (`selectedItemIds`, in the order they were selected), the
 * selection mode (`none`, `single`, `multiple`), `item.select`, `tree.select`, `tree.select-all`,
 * `tree.clear-selection`, the keys and clicks that select, `aria-selected` and the
 * `selectedItemIds` root prop.
 *
 * ```ts
 * import { selection } from "@fragiola/tree/selection";
 * const model = createTreeModel(json, { features: [selection({ mode: "multiple" })] });
 * ```
 */
export function selection(options: SelectionOptions = {}): SelectionFeature {
    const defaultMode = options.mode ?? "single";
    return Object.freeze({
        name: "selection",
        settings: Object.freeze({ selectionMode: defaultMode }),
        issues: (json, { at, has }) =>
            documentIssues(json, at, has, defaultMode),
        load: (json, items: { readonly [id: string]: TreeItem }) => ({
            // a disabled item is never selected
            selectedItemIds: (
                (json.selectedItemIds as readonly string[] | undefined) ?? []
            ).filter((id) => items[id]?.disabled !== true),
            selectionAnchorItemId:
                (json.selectionAnchorItemId as string | null | undefined) ??
                null,
        }),
        toJson: (state) => ({
            selectedItemIds: [...selectedOf(slice(state))],
            selectionAnchorItemId: anchorOf(slice(state)),
        }),
        commands: COMMANDS,
        get: {
            "selected-items": (state: FeatureState) =>
                selectedOf(slice(state)).flatMap((id) => {
                    const item = itemOf(state, id);
                    return item ? [item] : [];
                }),
        },
        is: {
            "item-selected": (
                state: FeatureState,
                { itemId }: { itemId: string },
            ) => selectedOf(slice(state)).includes(itemId),
        },
        forget: (draft, removed) => forgetIn(draft, (id) => removed.has(id)),
        disabled: (draft, itemId) => forgetIn(draft, (id) => id === itemId),
        configured: (draft) => {
            const state = draftSlice(draft);
            const mode = modeOf(state);
            const selected = selectedOf(state);
            if (mode === "none") {
                if (selected.length > 0) setSelected(draft, []);
                setAnchor(draft, null);
            } else if (mode === "single" && selected.length > 1) {
                setSelected(draft, selected.slice(0, 1));
            }
        },
        tabStop: (state) => selectedOf(slice(state)),
        engine: selectionEngine,
        rootProps,
    } satisfies SelectionFeature);
}
