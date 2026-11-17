// The composables and helpers only the primitives call.
import {
    type AnyTypes,
    type CheckState,
    type FeatureModel,
    type FeatureState,
    type ItemOf,
    TREE_ROOT_PROPS,
    type TreeModel,
    type TreeRootProp,
} from "@fragiola/tree";
import { nextTick, onScopeDispose, watch } from "vue";
import type { TreeContextValue } from "../context";
import { dataAttributes, onClient } from "../utils/render";
import type { TreeItemState } from "./use-tree-item";

/**
 * @internal the state of an item of `context`'s tree. Call it in a render or a computed: it reads
 * the context's state, revision and engine, so it is computed again when the tree changes.
 */
export function treeItemState(
    context: TreeContextValue,
    item: ItemOf<AnyTypes>,
): TreeItemState {
    const { model } = context;
    const state = context.state.value;
    context.revision.value;
    const engine = context.engine.value;
    const itemId = item.id;
    const path = model.get("item-path-by", { itemId }) ?? "";
    const segments = path.split("/").filter((segment) => segment !== "");
    const parent = model.get("item-parent-by", { itemId });
    const siblings =
        parent === undefined
            ? state.rootItemIds.length
            : (parent.childItemIds?.length ?? 0);
    // the mixed state walks the item's subtree: only a tree with checkboxes pays for it
    const checkState: CheckState = context.checkboxes.value
        ? model.get("check-state-by", { itemId })
        : model.is("item-checked", { itemId })
          ? "checked"
          : "unchecked";
    const status = item.childrenStatus;
    const dropTarget = engine?.is("item-drop-target", { itemId }) ?? false;
    const attributes = engine?.adapter.itemAttributes(itemId) ?? NO_ATTRIBUTES;
    return {
        itemId,
        path,
        level: Math.max(1, segments.length),
        posinset: Number(segments.at(-1) ?? 0) + 1,
        setsize: siblings,
        expanded: model.is("item-expanded", { itemId }),
        selected: attributes["aria-selected"] === "true",
        focused: model.is("item-focused", { itemId }),
        tabStop: context.tabStopItemId.value === itemId,
        checkState,
        checked: checkState === "checked",
        indeterminate: checkState === "mixed",
        renaming: state.renamingItemId === itemId,
        loading: status === "loading",
        loadError: status === "error",
        disabled: item.disabled === true,
        leaf: model.is("item-leaf", { itemId }),
        dragging: engine?.is("item-dragging", { itemId }) ?? false,
        dropTarget,
        dropPosition: dropTarget
            ? engine?.get("drop-target")?.position
            : undefined,
        attributes,
    };
}

const NO_ATTRIBUTES: Readonly<Record<string, string | undefined>> =
    Object.freeze({});

/** @internal the installed features' attributes whose names start with `prefix` (`data-`, `aria-`) */
export function featureAttributes(
    attributes: Readonly<Record<string, string | undefined>>,
    prefix: "data-" | "aria-",
): Record<string, string | undefined> {
    const picked: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(attributes)) {
        if (key.startsWith(prefix)) picked[key] = value;
    }
    return picked;
}

/** @internal the `data-*` attributes every part of an item carries */
export function itemDataAttributes(state: TreeItemState) {
    return {
        ...dataAttributes({
            expanded: state.expanded,
            focused: state.focused,
            checked: state.checked,
            indeterminate: state.indeterminate,
            renaming: state.renaming,
            loading: state.loading,
            "load-error": state.loadError,
            disabled: state.disabled,
            leaf: state.leaf,
            dragging: state.dragging,
            "drop-target": state.dropTarget,
            "drop-position": state.dropPosition,
            depth: state.level - 1,
        }),
        ...featureAttributes(state.attributes, "data-"),
    };
}

/** @internal the structural style of an item's parts: the depth, for the indentation */
export function depthStyle(state: TreeItemState): Record<string, string> {
    return { "--tree-depth": String(state.level - 1) };
}

/** The `meta` of the commands that bring the model to the controlled props. */
export const CONTROLLED_META = Object.freeze({ source: "controlled" });

/** @internal the controlled props of `Tree.Root` (`v-model:expanded-item-ids`, …), by name */
export type ControlledProps = Readonly<Record<string, unknown>>;

/** @internal the event that reports a change of a controlled list: `update:<prop>` */
export type ControlledEvent = `update:${string}`;

/** The controlled lists of a model: the core's (`TREE_ROOT_PROPS`) and its features'. */
export function rootPropsOf(model: TreeModel): readonly TreeRootProp[] {
    return [
        ...TREE_ROOT_PROPS,
        ...model.get("features").flatMap((feature) => feature.rootProps),
    ];
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((id) => set.has(id));
}

/** The commands that bring the model's state to the controlled props. */
function sync(
    model: TreeModel,
    rootProps: readonly TreeRootProp[],
    props: ControlledProps,
): void {
    for (const rootProp of rootProps) {
        const value = props[rootProp.prop] as readonly string[] | undefined;
        if (value === undefined) continue;
        rootProp.sync(model as unknown as FeatureModel, value, {
            meta: CONTROLLED_META,
        });
    }
}

/** The controlled lists, by value: what decides whether the model must be brought to them. */
function controlledKey(
    rootProps: readonly TreeRootProp[],
    props: ControlledProps,
): string {
    return JSON.stringify(
        rootProps.map(({ prop }) => {
            const ids = props[prop] as readonly string[] | undefined;
            return ids === undefined ? null : [...ids].sort();
        }),
    );
}

/**
 * @internal controlled and uncontrolled state, through commands (as packages/react's
 * `useControlledState`): a controlled prop that differs from the model runs the commands that
 * bring the model to it (marked `meta.source: "controlled"`); every other commit that changes one
 * of the lists emits its `update:*` event with the new list. The lists are the core's
 * (`expandedItemIds`, `checkedItemIds`) and the installed features' (`selectedItemIds` with
 * `selection()`), mapped the same way. A controlled prop the app does not update reverts the
 * change.
 *
 * The model is brought to the props before the root mounts, once per change of their value,
 * and once after each commit of its own, when the app has had its flush to answer the event: what
 * the model then makes of them (a cascade checks a parent's children, an unknown id is dropped) is
 * settled, never fought over.
 */
export function useControlledState(
    model: TreeModel,
    props: ControlledProps,
    emit: (event: ControlledEvent, itemIds: string[]) => void,
): void {
    let pending = false;
    let stopped = false;
    const rootProps = rootPropsOf(model);
    watch(
        () => controlledKey(rootProps, props),
        () => sync(model, rootProps, props),
    );
    // on the client only, as React's layout effects: a server render neither changes a model
    // that may be shared by other requests, nor subscribes to it
    onClient(() => {
        sync(model, rootProps, props);
        onScopeDispose(() => {
            stopped = true;
        });
        onScopeDispose(
            model.subscribe((event) => {
                if (event.meta?.source === CONTROLLED_META.source) return;
                const before = event.before as FeatureState;
                const after = event.after as FeatureState;
                for (const { prop, read } of rootProps) {
                    const next = read(after);
                    if (!sameSet(read(before), next))
                        emit(`update:${prop}`, [...next]);
                }
                // once the app's answer (a new prop value, or none) has reached the root
                if (pending) return;
                pending = true;
                void nextTick(() => {
                    pending = false;
                    if (!stopped) sync(model, rootProps, props);
                });
            }),
        );
    });
}
