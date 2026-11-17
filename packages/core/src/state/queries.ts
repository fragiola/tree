// The typed registry of `model.get` and `model.is` keys. Shape from Dockable (fragiola/dockable,
// packages/core/src/state/queries.ts), same author and licence.
import { COMMANDS } from "../commands/catalogue";
import type { CommandDefinition } from "../commands/define";
import { resolveFlags } from "../commands/rules";
import type { CommandInfo, NoPayload } from "../commands/types";
import { FEATURE_KEYS, type OwnedBy } from "../features/keys";
import type { ComposedFeatures } from "../features/registry";
import type { FeatureState, TreeFeatureInfo } from "../features/types";
import { checkedSet, checkStateOf } from "./check-state";
import { deepFreeze } from "./draft";
import { stateToJson, type TreeJson } from "./json";
import {
    childIdsOf,
    expandedSet,
    isDescendantOf,
    isLeaf,
    isVisible,
    itemOf,
    parentOf,
    pathOf,
} from "./structure";
import type {
    AnyTypes,
    CheckState,
    ChildrenStatus,
    ItemOf,
    TreeSettings,
    TreeState,
    TreeTypes,
    VisibleItem,
} from "./types";
import { visibleIndex, visibleItems } from "./visible-items";

/**
 * The payload argument of a query: optional when the payload has no required field
 * (`model.get("visible-items")`), required otherwise (`model.get("item-by", { id })`).
 */
export type QueryArgs<P> = NoPayload extends P ? [payload?: P] : [payload: P];

/**
 * What `model.get(key, payload)` reads: each key's payload and result. A key names what it
 * returns; one that takes an id ends in `-by`, and the payload's field completes it: `id` when it is
 * the id of what the key returns (`item-by { id }`), `<entity>Id` otherwise
 * (`item-parent-by { itemId }`). A key that takes nothing has a plain name (`visible-items`).
 */
export interface ModelGetMap<T extends TreeTypes = AnyTypes> {
    /** the document of the current state (version 1): a copy, every field written */
    "tree-json": { payload: NoPayload; result: TreeJson<T> };
    /** every command, with its description and JSON Schemas: ready to become tool definitions */
    commands: { payload: NoPayload; result: readonly CommandInfo[] };
    /** the installed features, each with its controlled root props (for the adapters) */
    features: { payload: NoPayload; result: readonly TreeFeatureInfo[] };
    /**
     * the ARIA and `data-*` the installed features give an item (`selection()`: `aria-selected`,
     * `data-selected`), from the state alone: each a string, `undefined` when absent
     */
    "item-attributes-by": {
        payload: { itemId: string };
        result: Readonly<Record<string, string | undefined>>;
    };
    /** the ARIA and `data-*` the installed features give the root (`aria-multiselectable`) */
    "root-attributes": {
        payload: NoPayload;
        result: Readonly<Record<string, string | undefined>>;
    };
    /** the tree's settings: its modes and the item flags' defaults */
    settings: { payload: NoPayload; result: TreeSettings };
    /** an item by its id */
    "item-by": { payload: { id: string }; result: ItemOf<T> | undefined };
    /** an item's parent (undefined for a root item) */
    "item-parent-by": {
        payload: { itemId: string };
        result: ItemOf<T> | undefined;
    };
    /** an item's children, in order (empty for a leaf or a parent not loaded) */
    "child-items-by": { payload: { itemId: string }; result: ItemOf<T>[] };
    /** the root items, in order */
    "root-items": { payload: NoPayload; result: ItemOf<T>[] };
    /**
     * the items whose ancestors are all expanded, in render order, each with its level, position
     * and set size (the base of keyboard navigation, and of a virtualizer)
     */
    "visible-items": { payload: NoPayload; result: readonly VisibleItem[] };
    /** an item's position from the root, `/0/2` (its `data-tree-path`); undefined for an unknown item */
    "item-path-by": { payload: { itemId: string }; result: string | undefined };
    /** an item's checkbox: checked, unchecked or mixed */
    "check-state-by": { payload: { itemId: string }; result: CheckState };
    /** the selected items, in the order they were selected (`selection()`) */
    "selected-items": { payload: NoPayload; result: ItemOf<T>[] };
    /** where an item's children come from: its status, undefined when it holds them itself */
    "children-status-by": {
        payload: { itemId: string };
        result: ChildrenStatus | undefined;
    };
    /**
     * type-ahead: the next visible item after `fromItemId` (wrapping; from the top without it)
     * whose label starts with `text`, ignoring case
     */
    "type-ahead-match": {
        payload: { text: string; fromItemId?: string | null };
        result: ItemOf<T> | undefined;
    };
    /**
     * the roving tab stop: the focused item, else the first visible selected item (`selection()`),
     * else the first visible item (the one item with `tabindex` 0)
     */
    "tab-stop-item": { payload: NoPayload; result: ItemOf<T> | undefined };
}

/** A key of `model.get`. */
export type ModelGetKey = keyof ModelGetMap;

/** The payload of `model.get(K)`. */
export type ModelGetPayload<
    T extends TreeTypes,
    K extends ModelGetKey,
> = ModelGetMap<T>[K]["payload"];

/** The result of `model.get(K)`. */
export type ModelGetResult<
    T extends TreeTypes,
    K extends ModelGetKey,
> = ModelGetMap<T>[K]["result"];

/**
 * What `model.is(key, payload)` asks: each question's payload. A key reads as the question after
 * "is" (`item-expanded`: is the item expanded?) and takes the id of the item it names.
 */
export interface ModelIsMap {
    /** an item is expanded */
    "item-expanded": { itemId: string };
    /** an item is selected (`selection()`) */
    "item-selected": { itemId: string };
    /** an item is the focused item (the roving tab stop as stored; see `item-tab-stop`) */
    "item-focused": { itemId: string };
    /** an item's checkbox is checked (not mixed) */
    "item-checked": { itemId: string };
    /** an item's label is being edited */
    "item-renaming": { itemId: string };
    /** an item's children are being loaded */
    "item-loading": { itemId: string };
    /** an item is disabled: focusable, not actionable */
    "item-disabled": { itemId: string };
    /** an item can be moved now: movable (its flag or the default) and not disabled */
    "item-movable": { itemId: string };
    /** an item can be renamed now: renamable (its flag or the default) and not disabled */
    "item-renamable": { itemId: string };
    /** an item is a leaf: no children and no children status */
    "item-leaf": { itemId: string };
    /** an item's ancestors are all expanded */
    "item-visible": { itemId: string };
    /** an item is the roving tab stop (`tab-stop-item`) */
    "item-tab-stop": { itemId: string };
    /** an item is inside another one's subtree (itself excluded) */
    "item-descendant-of": { itemId: string; ancestorItemId: string };
}

/** A key of `model.is`. */
export type ModelIsKey = keyof ModelIsMap;

/** The payload of `model.is(K)`. */
export type ModelIsPayload<K extends ModelIsKey> = ModelIsMap[K];

/** Commands as `get("commands")` describes them. */
function commandInfo(
    definitions: readonly CommandDefinition[],
): readonly CommandInfo[] {
    return Object.freeze(
        definitions.map((definition) =>
            Object.freeze({
                name: definition.name,
                description: definition.description,
                // the validator's own schemas: frozen, so no caller can change what validation means
                payloadSchema: deepFreeze(definition.payloadSchema),
                resultSchema: deepFreeze(definition.resultSchema),
                transient: definition.transient,
            }),
        ),
    );
}

type State = TreeState;

function items(state: State, ids: readonly string[]) {
    return ids.flatMap((id) => {
        const item = itemOf(state, id);
        return item ? [item] : [];
    });
}

function tabStop(state: State, features: ComposedFeatures): string | undefined {
    const focused = state.focusedItemId;
    if (focused !== null && isVisible(state, focused)) return focused;
    const index = visibleIndex(state);
    const preferred = features
        .tabStop(state as FeatureState)
        .filter((id) => index.has(id))
        .sort((a, b) => (index.get(a) ?? 0) - (index.get(b) ?? 0))[0];
    return preferred ?? visibleItems(state)[0]?.itemId;
}

function typeAheadMatch(
    state: State,
    text: string,
    fromItemId: string | null | undefined,
): string | undefined {
    const needle = text.toLocaleLowerCase();
    if (needle === "") return undefined;
    const visible = visibleItems(state);
    const start =
        fromItemId === null || fromItemId === undefined
            ? -1
            : (visibleIndex(state).get(fromItemId) ?? -1);
    for (let step = 1; step <= visible.length; step++) {
        const entry = visible[(start + step) % visible.length];
        const label = entry && itemOf(state, entry.itemId)?.label;
        if (label?.toLocaleLowerCase().startsWith(needle)) return entry?.itemId;
    }
    return undefined;
}

/** The keys of the core's own `model.get`, without the features'. */
type CoreGetKey = Exclude<ModelGetKey, OwnedBy<"get">>;
/** The keys of the core's own `model.is`, without the features'. */
type CoreIsKey = Exclude<ModelIsKey, OwnedBy<"is">>;

type Getters = {
    [K in CoreGetKey]: (
        state: State,
        payload: ModelGetPayload<AnyTypes, K>,
        features: ComposedFeatures,
    ) => ModelGetResult<AnyTypes, K>;
};

const GETTERS: Getters = {
    "tree-json": (state, _payload, features) => stateToJson(state, features),
    // computed once per model, in `createQueries`
    commands: () => [],
    features: (_state, _payload, features) => features.info,
    "item-attributes-by": (state, { itemId }, features) =>
        features.itemAttributes(state as FeatureState, itemId),
    "root-attributes": (state, _payload, features) =>
        features.rootAttributes(state as FeatureState),
    settings: (state) => state.settings,
    "item-by": (state, { id }) => itemOf(state, id),
    "item-parent-by": (state, { itemId }) => {
        const parent = parentOf(state, itemId);
        return typeof parent === "string" ? itemOf(state, parent) : undefined;
    },
    "child-items-by": (state, { itemId }) =>
        items(state, itemOf(state, itemId)?.childItemIds ?? []),
    "root-items": (state) => items(state, childIdsOf(state, null)),
    "visible-items": (state) => visibleItems(state),
    "item-path-by": (state, { itemId }) => pathOf(state, itemId),
    "check-state-by": (state, { itemId }) => checkStateOf(state, itemId),
    "children-status-by": (state, { itemId }) =>
        itemOf(state, itemId)?.childrenStatus,
    "type-ahead-match": (state, { text, fromItemId }) => {
        const id = typeAheadMatch(state, text, fromItemId);
        return id === undefined ? undefined : itemOf(state, id);
    },
    "tab-stop-item": (state, _payload, features) => {
        const id = tabStop(state, features);
        return id === undefined ? undefined : itemOf(state, id);
    },
};

type Questions = {
    [K in CoreIsKey]: (
        state: State,
        payload: ModelIsPayload<K>,
        features: ComposedFeatures,
    ) => boolean;
};

const QUESTIONS: Questions = {
    "item-expanded": (state, { itemId }) => expandedSet(state).has(itemId),
    "item-focused": (state, { itemId }) => state.focusedItemId === itemId,
    "item-checked": (state, { itemId }) => checkedSet(state).has(itemId),
    "item-renaming": (state, { itemId }) => state.renamingItemId === itemId,
    "item-loading": (state, { itemId }) =>
        itemOf(state, itemId)?.childrenStatus === "loading",
    "item-disabled": (state, { itemId }) =>
        itemOf(state, itemId)?.disabled === true,
    "item-movable": (state, { itemId }) => {
        const item = itemOf(state, itemId);
        const flags = item && resolveFlags(state.settings, item);
        return flags?.movable === true && !flags.disabled;
    },
    "item-renamable": (state, { itemId }) => {
        const item = itemOf(state, itemId);
        const flags = item && resolveFlags(state.settings, item);
        return flags?.renamable === true && !flags.disabled;
    },
    "item-leaf": (state, { itemId }) => {
        const item = itemOf(state, itemId);
        return item !== undefined && isLeaf(item);
    },
    "item-visible": (state, { itemId }) => isVisible(state, itemId),
    "item-tab-stop": (state, { itemId }, features) =>
        tabStop(state, features) === itemId,
    "item-descendant-of": (state, { itemId, ancestorItemId }) =>
        isDescendantOf(state, itemId, ancestorItemId),
};

const owned = (kind: "get" | "is") =>
    Object.values(FEATURE_KEYS).flatMap(
        (keys) => keys[kind] as readonly string[],
    );

/** Every key of `model.get`, the features' included, for documentation coverage. */
export const MODEL_GET_KEYS: readonly ModelGetKey[] = Object.freeze([
    ...Object.keys(GETTERS),
    ...owned("get"),
] as ModelGetKey[]);

/** Every key of `model.is`, the features' included, for documentation coverage. */
export const MODEL_IS_KEYS: readonly ModelIsKey[] = Object.freeze([
    ...Object.keys(QUESTIONS),
    ...owned("is"),
] as ModelIsKey[]);

/** A model's `get` and `is`: the core's keys and its features'. */
export interface Queries {
    get(state: State, key: string, payload: unknown): unknown;
    is(state: State, key: string, payload: unknown): boolean;
    /** the model's commands, described (`get("commands")`) */
    readonly commands: readonly CommandInfo[];
}

/** Composes a model's queries once (an unknown key reads `undefined` / answers `false`). */
export function createQueries(features: ComposedFeatures): Queries {
    const commands = commandInfo([...COMMANDS, ...features.commands.values()]);
    return {
        commands,
        get(state, key, payload) {
            if (key === "commands") return commands;
            if (Object.hasOwn(GETTERS, key)) {
                const getter = GETTERS[key as CoreGetKey] as (
                    state: State,
                    payload: unknown,
                    features: ComposedFeatures,
                ) => unknown;
                return getter(state, payload ?? {}, features);
            }
            return features.getters.get(key)?.(
                state as FeatureState,
                payload ?? {},
            );
        },
        is(state, key, payload) {
            if (Object.hasOwn(QUESTIONS, key)) {
                const question = QUESTIONS[key as CoreIsKey] as (
                    state: State,
                    payload: unknown,
                    features: ComposedFeatures,
                ) => boolean;
                return question(state, payload ?? {}, features);
            }
            return (
                features.questions.get(key)?.(
                    state as FeatureState,
                    payload ?? {},
                ) ?? false
            );
        },
    };
}
