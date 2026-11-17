// The structure: `item.add`, `item.remove`, `item.move`, and an item's own fields, `item.set-data`
// and `item.set-flags`. The move rules (cycles, `movable`, `droppable`, `disabled`) are in rules.ts,
// so `model.can("item.move", …)` answers what a drag asks.
import {
    idListSchema,
    itemFlagProperties,
    itemJsonSchema,
} from "../schema/tree";
import { inheritCheck, settleAncestors } from "../state/check-state";
import type { Draft } from "../state/draft";
import type { TreeItemInit } from "../state/json";
import { itemFromJson } from "../state/load";
import { childIdsOf, parentOf } from "../state/structure";
import type { TreeItem } from "../state/types";
import { visibleIndex } from "../state/visible-items";
import {
    defineCommand,
    type Failure,
    fail,
    ok,
    type ReduceContext,
} from "./define";
import { itemIdResult } from "./expansion";
import {
    checkMove,
    detach,
    forgetItems,
    insertChildren,
    isFailure,
    outermost,
    requireItem,
    requireTarget,
    resolveFlags,
    settleFocus,
    subtreeOf,
} from "./rules";

/**
 * A new item from its JSON (`item.add`, `item.set-children`): its id given (unused) or generated,
 * no children of its own yet, its data valid for its kind.
 */
export function newItem(
    context: ReduceContext,
    json: TreeItemInit,
    path: string,
    reserved: ReadonlySet<string> = new Set(),
): TreeItem | Failure {
    const { draft } = context;
    const childItemIds = json.childItemIds;
    if (Array.isArray(childItemIds) && childItemIds.length > 0) {
        return fail(
            "refused",
            "a new item has no children yet: add them after it (or give it a childrenStatus for the loader)",
            `${path}/childItemIds`,
        );
    }
    if (
        json.id !== undefined &&
        (draft.isUsed(json.id) || reserved.has(json.id))
    ) {
        return fail("refused", `the id "${json.id}" is taken`, `${path}/id`);
    }
    const invalidData = context.validateData(
        json.kind,
        json.data,
        `${path}/data`,
    );
    if (invalidData) return invalidData;
    const id =
        json.id ??
        draft.ids.next(
            (candidate) => draft.isUsed(candidate) || reserved.has(candidate),
        );
    return itemFromJson(id, json);
}

/** Removes the subtrees of `itemIds` (outermost first): every list forgets their items. */
export function removeSubtrees(
    draft: Draft,
    itemIds: readonly string[],
): string[] {
    const focused = draft.state.focusedItemId;
    const focusedAt =
        focused === null ? undefined : visibleIndex(draft.state).get(focused);
    const removed: string[] = [];
    const parents = new Set<string | null>();
    for (const id of outermost(draft, itemIds)) {
        const parent = parentOf(draft.state, id);
        if (parent === undefined) continue;
        detach(draft, parent, id);
        parents.add(parent);
        for (const gone of subtreeOf(draft, id)) {
            draft.deleteItem(gone);
            removed.push(gone);
        }
    }
    forgetItems(draft, new Set(removed), focusedAt);
    for (const parent of parents) {
        if (parent !== null && draft.item(parent))
            settleAncestors(draft, parent);
    }
    return removed;
}

export const itemAdd = defineCommand({
    name: "item.add",
    description:
        'Add a new item. `item` is its JSON: `kind` names what it is (a key of the app\'s registry), `label` its name and `data` its state (validated when the app registered a data schema); give it `childItemIds: []` for an empty parent, or `childrenStatus: "unloaded"` for a parent the loader fills. `to.parentItemId` is its parent (null for the root) and `to.index` its position (omitted: last). In cascade mode it inherits a checked parent. Refused for a parent that is a leaf or whose children are not loaded, or a taken id.',
    payloadSchema: {
        type: "object",
        properties: {
            item: { ...itemJsonSchema, description: "the new item" },
            to: {
                type: "object",
                properties: {
                    parentItemId: {
                        anyOf: [
                            { type: "string", minLength: 1 },
                            { type: "null" },
                        ],
                        description: "its parent; null for the root",
                    },
                    index: {
                        type: "integer",
                        minimum: 0,
                        description:
                            "its position among the parent's children (omitted or past the end: last)",
                    },
                },
                required: ["parentItemId"],
                additionalProperties: false,
                description: "where it goes",
            },
        },
        required: ["item", "to"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            itemId: { type: "string", description: "the new item's id" },
        },
        required: ["itemId"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (payload, context) => {
        const { draft } = context;
        const target = requireTarget(draft, payload.to.parentItemId);
        if (isFailure(target)) return target;
        const item = newItem(context, payload.item, "/item");
        if (isFailure(item)) return item;
        draft.setItem(item);
        const parentItemId = target?.id ?? null;
        const siblings = childIdsOf(draft.state, parentItemId);
        insertChildren(
            draft,
            parentItemId,
            [item.id],
            siblings[payload.to.index ?? siblings.length],
        );
        inheritCheck(draft, parentItemId, [item.id]);
        settleAncestors(draft, parentItemId);
        return ok({ itemId: item.id });
    },
});

export const itemRemove = defineCommand({
    name: "item.remove",
    description:
        "Remove items and everything inside them. The expanded, selected and checked lists forget them; when the focused item goes, the focus moves to the visible item now at its place. Ancestors' checkboxes are recomputed.",
    payloadSchema: {
        type: "object",
        properties: {
            itemIds: { ...idListSchema, description: "the items to remove" },
        },
        required: ["itemIds"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            removedItemIds: {
                ...idListSchema,
                description: "every item removed, descendants included",
            },
        },
        required: ["removedItemIds"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (payload, { draft }) => {
        for (const [i, id] of payload.itemIds.entries()) {
            const item = requireItem(draft, id, `/itemIds/${i}`);
            if (isFailure(item)) return item;
        }
        return ok({ removedItemIds: removeSubtrees(draft, payload.itemIds) });
    },
});

export const itemMove = defineCommand({
    name: "item.move",
    description:
        "Move items (and their subtrees) into a parent, before the child at `to.index` (counted among the parent's children as they are now, the moved items included; past the end: last). Several items keep their order in the tree; an item inside another moved one goes with it. Refused into an item itself or one of its descendants, into a leaf, an unloaded, disabled or non-droppable parent, and for a disabled or non-movable item. This is what a drop runs.",
    payloadSchema: {
        type: "object",
        properties: {
            itemIds: {
                ...idListSchema,
                minItems: 1,
                description: "the items to move",
            },
            to: {
                type: "object",
                properties: {
                    parentItemId: {
                        anyOf: [
                            { type: "string", minLength: 1 },
                            { type: "null" },
                        ],
                        description: "the new parent; null for the root",
                    },
                    index: {
                        type: "integer",
                        minimum: 0,
                        description:
                            "the child of the parent they go before, by its index now (past the end: last)",
                    },
                },
                required: ["parentItemId", "index"],
                additionalProperties: false,
                description: "where they go",
            },
        },
        required: ["itemIds", "to"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            itemIds: {
                ...idListSchema,
                description: "the items moved, in their new order",
            },
        },
        required: ["itemIds"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (payload, { draft }) => {
        const { parentItemId, index } = payload.to;
        const refused = checkMove(draft, payload.itemIds, parentItemId);
        if (refused) return refused;
        const moving = outermost(draft, payload.itemIds);
        const movingSet = new Set(moving);
        // the child they go before: the first one at `index` or after that is not moving
        const before = childIdsOf(draft.state, parentItemId)
            .slice(index)
            .find((id) => !movingSet.has(id));
        const from = new Set<string | null>();
        for (const id of moving) {
            const parent = parentOf(draft.state, id);
            if (parent === undefined) continue;
            from.add(parent);
            detach(draft, parent, id);
        }
        insertChildren(draft, parentItemId, moving, before);
        for (const parent of [...from, parentItemId]) {
            if (parent !== null) settleAncestors(draft, parent);
        }
        settleFocus(draft);
        return ok({ itemIds: moving });
    },
});

export const itemSetData = defineCommand({
    name: "item.set-data",
    description:
        "Replace an item's data (validated against its kind's data schema when the app registered one). Omit `data` to remove it.",
    payloadSchema: {
        type: "object",
        properties: {
            itemId: { type: "string", minLength: 1, description: "the item" },
            data: { description: "its new data (any JSON value)" },
        },
        required: ["itemId"],
        additionalProperties: false,
    },
    resultSchema: itemIdResult,
    transient: true,
    reduce: (payload, context) => {
        const { draft } = context;
        const item = requireItem(draft, payload.itemId);
        if (isFailure(item)) return item;
        const data = "data" in payload ? payload.data : undefined;
        const invalidData = context.validateData(item.kind, data, "/data");
        if (invalidData) return invalidData;
        draft.patchItem(item.id, {
            data: data === undefined ? undefined : structuredCloneJson(data),
        });
        return ok({ itemId: item.id });
    },
});

/** A copy of JSON data: the state is frozen, the caller's object must not be. */
function structuredCloneJson(value: unknown): unknown {
    return JSON.parse(JSON.stringify(value));
}

const nullableFlag = (description: string) =>
    ({
        anyOf: [{ type: "boolean" }, { type: "null" }],
        description: `${description}; null removes the item's own value (the tree's default applies)`,
    }) as const;

export const itemSetFlags = defineCommand({
    name: "item.set-flags",
    description:
        "Set an item's permission flags: disabled (focusable, not actionable), movable, renamable, droppable. A flag set to null takes the tree's default again (settings). A disabled item stops renaming.",
    payloadSchema: {
        type: "object",
        properties: {
            itemId: { type: "string", minLength: 1, description: "the item" },
            disabled: nullableFlag(itemFlagProperties.disabled.description),
            movable: nullableFlag(itemFlagProperties.movable.description),
            renamable: nullableFlag(itemFlagProperties.renamable.description),
            droppable: nullableFlag(itemFlagProperties.droppable.description),
        },
        required: ["itemId"],
        additionalProperties: false,
    },
    resultSchema: itemIdResult,
    transient: false,
    reduce: (payload, { draft }) => {
        const item = requireItem(draft, payload.itemId);
        if (isFailure(item)) return item;
        const patch: Record<string, boolean | undefined> = {};
        for (const flag of [
            "disabled",
            "movable",
            "renamable",
            "droppable",
        ] as const) {
            const value = payload[flag];
            if (value !== undefined) patch[flag] = value ?? undefined;
        }
        draft.patchItem(item.id, patch);
        const updated = draft.item(item.id);
        const flags = updated && resolveFlags(draft.settings, updated);
        if (flags?.disabled) {
            // a disabled item is never selected
            if (draft.state.selectedItemIds.includes(item.id)) {
                draft.set(
                    "selectedItemIds",
                    draft.state.selectedItemIds.filter((id) => id !== item.id),
                );
            }
            if (draft.state.selectionAnchorItemId === item.id) {
                draft.set("selectionAnchorItemId", null);
            }
        }
        if (
            flags &&
            (flags.disabled || !flags.renamable) &&
            draft.state.renamingItemId === item.id
        ) {
            draft.set("renamingItemId", null);
        }
        return ok({ itemId: item.id });
    },
});
